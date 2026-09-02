import { Quote, SheetsMetadata, SpecialQuote, SpecialSheetsMetadata } from '../types';

/**
 * Converts a 0-based column index to its Excel letter representation (e.g., 0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
export function getColLetter(index: number): string {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Fetches spreadsheet metadata (sheetName and sheetId)
 */
export async function fetchSpreadsheetMetadata(spreadsheetId: string, accessToken: string): Promise<{ sheetId: number; sheetName: string }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errText = await response.text();
    throw new Error(`Failed to fetch spreadsheet metadata. Status: ${response.status}. Error: ${errText}`);
  }

  const data = await response.json();
  const sheets = data.sheets;
  if (!sheets || sheets.length === 0) {
    throw new Error('No sheets found in this spreadsheet.');
  }

  // Use the first sheet in the spreadsheet
  const firstSheet = sheets[0];
  return {
    sheetId: firstSheet.properties.sheetId,
    sheetName: firstSheet.properties.title,
  };
}

/**
 * Reads all quotes and builds index metadata for categories and helper columns
 */
export async function getSpreadsheetData(
  spreadsheetId: string,
  accessToken: string
): Promise<{ quotes: Quote[]; metadata: SheetsMetadata }> {
  // 1. Fetch metadata to resolve Sheet Name & ID
  const { sheetId, sheetName } = await fetchSpreadsheetMetadata(spreadsheetId, accessToken);

  // 2. Read cell values from row 1 to 5000 (adjust as needed)
  const range = `'${sheetName}'!A1:Z10000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errText = await response.text();
    throw new Error(`Failed to fetch sheet values. Status: ${response.status}. Error: ${errText}`);
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  if (rows.length === 0) {
    throw new Error('Spreadsheet is empty.');
  }

  const headers = rows[0].map(h => (h || '').trim());

  // Detect critical column mappings
  const idColIdx = headers.findIndex(h => h.toLowerCase() === 'id');
  const fraseColIdx = headers.findIndex(h => h.toLowerCase() === 'frase');
  const tipoColIdx = headers.findIndex(h => h.toLowerCase() === 'tipo');
  const imagemColIdx = headers.findIndex(h => h.toLowerCase() === 'imagem');
  const notasColIdx = headers.findIndex(h => h.toLowerCase() === 'notas');

  // Validate critical columns. If index not found, use default placeholders
  const resolvedIdIdx = idColIdx !== -1 ? idColIdx : 0;
  const resolvedFraseIdx = fraseColIdx !== -1 ? fraseColIdx : 1;
  const resolvedTipoIdx = tipoColIdx !== -1 ? tipoColIdx : 16; // Col Q fallback
  const resolvedImagemIdx = imagemColIdx !== -1 ? imagemColIdx : 17; // Col R fallback
  const resolvedNotasIdx = notasColIdx !== -1 ? notasColIdx : 18; // Col S fallback

  // Category columns lie after the Quote column (typically column C, index 2) up to the 'Tipo' column
  // (strictly before Tipo).
  const categoryStartIndex = 2;
  const categories: string[] = [];
  const columns: { [key: string]: number } = {};

  // Register headers inside columns directory map
  headers.forEach((hdr, idx) => {
    columns[hdr] = idx;
  });

  for (let i = categoryStartIndex; i < resolvedTipoIdx; i++) {
    if (i < headers.length && headers[i]) {
      categories.push(headers[i]);
    }
  }

  const quotes: Quote[] = [];

  // Parse remaining rows (Row 2 onwards)
  // rowIdx represents 1-indexed Sheets row number
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowIdx = r + 1; // Row 1 is header

    // Padding row if it is shorter than headers
    const rowPadded = [...row];
    while (rowPadded.length < headers.length) {
      rowPadded.push('');
    }

    const idStr = rowPadded[resolvedIdIdx];
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      continue; // Skip empty/invalid rows but preserve others
    }

    const frase = rowPadded[resolvedFraseIdx] || '';
    const tipoVal = (rowPadded[resolvedTipoIdx] || 'Frase').trim();
    const tipo = (tipoVal.toLowerCase() === 'imagem' ? 'Imagem' : 'Frase') as 'Frase' | 'Imagem';
    const imagem = rowPadded[resolvedImagemIdx] || '';
    const notas = rowPadded[resolvedNotasIdx] || '';

    // Parse category toggles (any columns index 2 up to resolvedTipoIdx)
    const quoteCategories: { [key: string]: boolean } = {};
    categories.forEach(catName => {
      const idx = columns[catName];
      const val = rowPadded[idx] || '';
      quoteCategories[catName] = val.trim().toLowerCase() === 'x';
    });

    quotes.push({
      id,
      rowIdx,
      frase,
      categories: quoteCategories,
      tipo,
      imagem,
      notas,
    });
  }

  const metadata: SheetsMetadata = {
    spreadsheetId,
    sheetId,
    sheetName,
    categories,
    columns,
    headers,
  };

  return { quotes, metadata };
}

/**
 * Updates a specific Quote record (entire row) in the Spreadsheet
 */
export async function updateQuoteInSpreadsheet(
  spreadsheetId: string,
  metadata: SheetsMetadata,
  quote: Quote,
  accessToken: string
): Promise<void> {
  const { sheetName, headers, columns } = metadata;

  // Build the cell row value matching the header index structure
  const updatedRowValues = new Array(headers.length).fill('');

  // 1. Set ID
  const idIdx = columns['ID'] !== undefined ? columns['ID'] : 0;
  updatedRowValues[idIdx] = String(quote.id);

  // 2. Set Frase
  const fraseIdx = columns['Frase'] !== undefined ? columns['Frase'] : 1;
  updatedRowValues[fraseIdx] = quote.frase;

  // 3. Set categories dynamically
  metadata.categories.forEach(cat => {
    const colIdx = columns[cat];
    if (colIdx !== undefined) {
      updatedRowValues[colIdx] = quote.categories[cat] ? 'X' : '';
    }
  });

  // 4. Set Tipo
  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.indexOf('Tipo');
  if (tipoIdx !== -1) {
    updatedRowValues[tipoIdx] = quote.tipo;
  }

  // 5. Set Imagem
  const imagemIdx = columns['Imagem'] !== undefined ? columns['Imagem'] : headers.indexOf('Imagem');
  if (imagemIdx !== -1) {
    updatedRowValues[imagemIdx] = quote.imagem;
  }

  // 6. Set Notas
  const notasIdx = columns['Notas'] !== undefined ? columns['Notas'] : headers.indexOf('Notas');
  if (notasIdx !== -1) {
    updatedRowValues[notasIdx] = quote.notas;
  }

  // Range in Sheets API e.g. 'Sheet1'!A15:S15
  const rowNum = quote.rowIdx;
  const startLetter = 'A';
  const endLetter = getColLetter(headers.length - 1);
  const range = `'${sheetName}'!${startLetter}${rowNum}:${endLetter}${rowNum}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [updatedRowValues],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to update quote in sheets. Status: ${response.status}. Error: ${errText}`);
  }
}

/**
 * Creates and appends a new Quote record to the Spreadsheet
 */
export async function addQuoteToSpreadsheet(
  spreadsheetId: string,
  metadata: SheetsMetadata,
  newQuoteData: Omit<Quote, 'id' | 'rowIdx'>,
  nextId: number,
  accessToken: string
): Promise<Quote> {
  const { sheetName, headers, columns } = metadata;

  // Build row values
  const newRowValues = new Array(headers.length).fill('');

  const idIdx = columns['ID'] !== undefined ? columns['ID'] : 0;
  newRowValues[idIdx] = String(nextId);

  const fraseIdx = columns['Frase'] !== undefined ? columns['Frase'] : 1;
  newRowValues[fraseIdx] = newQuoteData.frase;

  metadata.categories.forEach(cat => {
    const colIdx = columns[cat];
    if (colIdx !== undefined) {
      newRowValues[colIdx] = newQuoteData.categories[cat] ? 'X' : '';
    }
  });

  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.findIndex(h => h.toLowerCase() === 'tipo');
  if (tipoIdx !== -1) {
    newRowValues[tipoIdx] = newQuoteData.tipo;
  }

  const imagemIdx = columns['Imagem'] !== undefined ? columns['Imagem'] : headers.findIndex(h => h.toLowerCase() === 'imagem');
  if (imagemIdx !== -1) {
    newRowValues[imagemIdx] = newQuoteData.imagem;
  }

  const notasIdx = columns['Notas'] !== undefined ? columns['Notas'] : headers.findIndex(h => h.toLowerCase() === 'notas');
  if (notasIdx !== -1) {
    newRowValues[notasIdx] = newQuoteData.notas;
  }

  const range = `'${sheetName}'!A:A`; // Appends at the end
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [newRowValues],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to append new quote. Status: ${response.status}. Error: ${errText}`);
  }

  const data = await response.json();
  // Extract inserted row number from response range e.g. "Sheet1!A15:S15"
  const updatedRange = data.updates.updatedRange;
  const match = updatedRange.match(/A(\d+):/);
  const rowIdx = match ? parseInt(match[1], 10) : nextId + 1; // fallback prediction

  return {
    id: nextId,
    rowIdx,
    frase: newQuoteData.frase,
    categories: newQuoteData.categories,
    tipo: newQuoteData.tipo,
    imagem: newQuoteData.imagem,
    notas: newQuoteData.notas,
  };
}

/**
 * Inserts a new category column into the spreadsheet dynamically
 * Adds it right before the 'Tipo' column, maintaining the categories block intact.
 */
export async function addCategoryColumn(
  spreadsheetId: string,
  metadata: SheetsMetadata,
  newCategoryName: string,
  accessToken: string
): Promise<SheetsMetadata> {
  const { sheetId, sheetName, headers, columns } = metadata;

  // Let's find index where Categories block list ends. It ends exactly before 'Tipo'
  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.findIndex(h => h.toLowerCase() === 'tipo');
  if (tipoIdx === -1) {
    throw new Error("Could not locate the 'Tipo' column in spreadsheet to insert new category.");
  }

  // 1. Insert empty column at index of Tipo (tipoIdx) from spreadsheets batch update
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const insertRequest = {
    requests: [
      {
        insertDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: tipoIdx,
            endIndex: tipoIdx + 1,
          },
          inheritFromBefore: true,
        },
      },
    ],
  };

  const insertResponse = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(insertRequest),
  });

  if (!insertResponse.ok) {
    const errText = await insertResponse.text();
    throw new Error(`Failed to insert category column in Sheets. Status: ${insertResponse.status}. Error: ${errText}`);
  }

  // 2. Set the header name in cell Row 1 of this newly created column
  const newColLetter = getColLetter(tipoIdx);
  const cellRange = `'${sheetName}'!${newColLetter}1`;
  const setHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`;

  const setHeaderResponse = await fetch(setHeaderUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: cellRange,
      majorDimension: 'ROWS',
      values: [[newCategoryName]],
    }),
  });

  if (!setHeaderResponse.ok) {
    const errText = await setHeaderResponse.text();
    throw new Error(`Failed to set category header text. Status: ${setHeaderResponse.status}. Error: ${errText}`);
  }

  // 3. Build the updated metadata columns map & headers arrays locally
  const updatedHeaders = [...headers];
  // Insert the new header name in position 'tipoIdx'
  updatedHeaders.splice(tipoIdx, 0, newCategoryName);

  const updatedColumns: { [key: string]: number } = {};
  updatedHeaders.forEach((hdr, idx) => {
    updatedColumns[hdr] = idx;
  });

  const updatedCategories = [...metadata.categories];
  // Add the new category name to the categories array
  updatedCategories.push(newCategoryName);

  return {
    ...metadata,
    categories: updatedCategories,
    headers: updatedHeaders,
    columns: updatedColumns,
  };
}

/**
 * Fetches or creates the "Especial" tab, reads special quotes, and returns them with metadata
 */
export async function getSpecialSpreadsheetData(
  spreadsheetId: string,
  accessToken: string
): Promise<{ quotes: SpecialQuote[]; metadata: SpecialSheetsMetadata }> {
  // 1. Fetch spreadsheet to list all sheets
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errText = await response.text();
    throw new Error(`Failed to fetch spreadsheet. Status: ${response.status}. Error: ${errText}`);
  }

  const data = await response.json();
  const sheets = data.sheets || [];
  
  let especialSheet = sheets.find((s: any) => s.properties.title.toLowerCase() === 'especial');
  let sheetName = especialSheet ? especialSheet.properties.title : 'Especial';
  let sheetId = especialSheet ? especialSheet.properties.sheetId : null;

  // 2. If it does not exist, create it!
  if (!especialSheet) {
    const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const createBody = {
      requests: [
        {
          addSheet: {
            properties: {
              title: 'Especial',
            },
          },
        },
      ],
    };

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    if (!createResp.ok) {
      const errText = await createResp.text();
      throw new Error(`Failed to create 'Especial' sheet. Status: ${createResp.status}. Error: ${errText}`);
    }

    const createData = await createResp.json();
    const addedSheetProperties = createData.replies[0].addSheet.properties;
    sheetName = addedSheetProperties.title;
    sheetId = addedSheetProperties.sheetId;

    // Seed the empty sheet with default headers and sample rows including Brazilian Expressions, Fancy Words, Funny Words
    const seedRange = `'Especial'!A1:H10`;
    const seedValues = [
      ['ID', 'Frase', 'Tópico', 'Favorito', 'Estudar', 'Tipo', 'Imagem', 'Notas'],
      ['1', 'Dar com os burros n\'água', 'Expressões', 'X', 'X', 'Frase', '', 'Significa fracassar em uma tentativa.'],
      ['2', 'Cair a ficha', 'Expressões', '', 'X', 'Frase', '', 'Compreender um fato repentinamente.'],
      ['3', 'Chutar o balde', 'Expressões', '', 'X', 'Frase', '', 'Perder a paciência, desistir de tudo.'],
      ['4', 'Pusilânime', 'Palavras Rebuscadas', '', 'X', 'Frase', '', 'Que demonstra fraqueza de ânimo; covarde ou sem coragem.'],
      ['5', 'Procrastinar', 'Palavras Rebuscadas', 'X', 'X', 'Frase', '', 'Adiar ou delongar uma ação para outro dia; deixar para depois.'],
      ['6', 'Inexorável', 'Palavras Rebuscadas', '', 'X', 'Frase', '', 'Que não cede a rogos nem se abala; implacável, inevitável.'],
      ['7', 'Serelepe', 'Palavras Engraçadas', '', 'X', 'Frase', '', 'Que se movimenta com rapidez e agilidade; travesso.'],
      ['8', 'Fanfarrão', 'Palavras Engraçadas', 'X', 'X', 'Frase', '', 'Pessoa que gaba-se de qualidades que não possui.'],
      ['9', 'Ziquizira', 'Palavras Engraçadas', '', 'X', 'Frase', '', 'Má sorte, feitiço ou mal-estar inexplicável.'],
    ];

    const seedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(seedRange)}?valueInputOption=USER_ENTERED`;
    const seedResp = await fetch(seedUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: seedRange,
        majorDimension: 'ROWS',
        values: seedValues,
      }),
    });

    if (!seedResp.ok) {
      const errText = await seedResp.text();
      throw new Error(`Failed to seed 'Especial' sheet. Status: ${seedResp.status}. Error: ${errText}`);
    }
  }

  // 3. Read cell values from row 1 to 10000 from 'Especial'
  const range = `'${sheetName}'!A1:Z10000`;
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const valuesResp = await fetch(valuesUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!valuesResp.ok) {
    const errText = await valuesResp.text();
    throw new Error(`Failed to fetch 'Especial' sheet values. Status: ${valuesResp.status}. Error: ${errText}`);
  }

  const valuesData = await valuesResp.json();
  const rows: string[][] = valuesData.values || [];

  if (rows.length === 0) {
    throw new Error('Especial spreadsheet is empty.');
  }

  const headers = rows[0].map(h => (h || '').trim());

  // Detect critical column mappings
  const idColIdx = headers.findIndex(h => h.toLowerCase() === 'id');
  const fraseColIdx = headers.findIndex(h => h.toLowerCase() === 'frase');
  const topicoColIdx = headers.findIndex(h => h.toLowerCase() === 'tópico' || h.toLowerCase() === 'topico');
  const tipoColIdx = headers.findIndex(h => h.toLowerCase() === 'tipo');
  const imagemColIdx = headers.findIndex(h => h.toLowerCase() === 'imagem');
  const notasColIdx = headers.findIndex(h => h.toLowerCase() === 'notas');

  // Validate critical columns. If indices not found, use defaults
  const resolvedIdIdx = idColIdx !== -1 ? idColIdx : 0;
  const resolvedFraseIdx = fraseColIdx !== -1 ? fraseColIdx : 1;
  const resolvedTopicoIdx = topicoColIdx !== -1 ? topicoColIdx : 2;
  const resolvedTipoIdx = tipoColIdx !== -1 ? tipoColIdx : 5; 
  const resolvedImagemIdx = imagemColIdx !== -1 ? imagemColIdx : 6; 
  const resolvedNotasIdx = notasColIdx !== -1 ? notasColIdx : 7; 

  const columns: { [key: string]: number } = {};
  headers.forEach((hdr, idx) => {
    columns[hdr] = idx;
  });

  // Dynamic tags/categories lie after Tópico column strictly before Tipo
  const categories: string[] = [];
  const startCatIndex = resolvedTopicoIdx + 1;
  for (let i = startCatIndex; i < resolvedTipoIdx; i++) {
    if (i < headers.length && headers[i]) {
      categories.push(headers[i]);
    }
  }

  const quotes: SpecialQuote[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowIdx = r + 1;

    const rowPadded = [...row];
    while (rowPadded.length < headers.length) {
      rowPadded.push('');
    }

    const idStr = rowPadded[resolvedIdIdx];
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      continue;
    }

    const frase = rowPadded[resolvedFraseIdx] || '';
    const topico = rowPadded[resolvedTopicoIdx] || 'Expressões';
    const tipoVal = (rowPadded[resolvedTipoIdx] || 'Frase').trim();
    const tipo = (tipoVal.toLowerCase() === 'imagem' ? 'Imagem' : 'Frase') as 'Frase' | 'Imagem';
    const imagem = rowPadded[resolvedImagemIdx] || '';
    const notas = rowPadded[resolvedNotasIdx] || '';

    const quoteCategories: { [key: string]: boolean } = {};
    categories.forEach(catName => {
      const idx = columns[catName];
      const val = rowPadded[idx] || '';
      quoteCategories[catName] = val.trim().toLowerCase() === 'x';
    });

    quotes.push({
      id,
      rowIdx,
      frase,
      topico,
      categories: quoteCategories,
      tipo,
      imagem,
      notas,
    });
  }

  const metadata: SpecialSheetsMetadata = {
    spreadsheetId,
    sheetId: sheetId as number,
    sheetName,
    categories,
    columns,
    headers,
  };

  return { quotes, metadata };
}

/**
 * Updates a specific SpecialQuote record in the Spreadsheet
 */
export async function updateSpecialQuoteInSpreadsheet(
  spreadsheetId: string,
  metadata: SpecialSheetsMetadata,
  quote: SpecialQuote,
  accessToken: string
): Promise<void> {
  const { sheetName, headers, columns } = metadata;

  const updatedRowValues = new Array(headers.length).fill('');

  const idIdx = columns['ID'] !== undefined ? columns['ID'] : 0;
  updatedRowValues[idIdx] = String(quote.id);

  const fraseIdx = columns['Frase'] !== undefined ? columns['Frase'] : 1;
  updatedRowValues[fraseIdx] = quote.frase;

  const topicoIdx = columns['Tópico'] !== undefined ? columns['Tópico'] : (columns['Topico'] !== undefined ? columns['Topico'] : 2);
  updatedRowValues[topicoIdx] = quote.topico;

  metadata.categories.forEach(cat => {
    const colIdx = columns[cat];
    if (colIdx !== undefined) {
      updatedRowValues[colIdx] = quote.categories[cat] ? 'X' : '';
    }
  });

  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.indexOf('Tipo');
  if (tipoIdx !== -1) {
    updatedRowValues[tipoIdx] = quote.tipo;
  }

  const imagemIdx = columns['Imagem'] !== undefined ? columns['Imagem'] : headers.indexOf('Imagem');
  if (imagemIdx !== -1) {
    updatedRowValues[imagemIdx] = quote.imagem;
  }

  const notasIdx = columns['Notas'] !== undefined ? columns['Notas'] : headers.indexOf('Notas');
  if (notasIdx !== -1) {
    updatedRowValues[notasIdx] = quote.notas;
  }

  const rowNum = quote.rowIdx;
  const startLetter = 'A';
  const endLetter = getColLetter(headers.length - 1);
  const range = `'${sheetName}'!${startLetter}${rowNum}:${endLetter}${rowNum}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [updatedRowValues],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to update special quote. Status: ${response.status}. Error: ${errText}`);
  }
}

/**
 * Creates and appends a new SpecialQuote to the Spreadsheet
 */
export async function addSpecialQuoteToSpreadsheet(
  spreadsheetId: string,
  metadata: SpecialSheetsMetadata,
  newQuoteData: Omit<SpecialQuote, 'id' | 'rowIdx'>,
  nextId: number,
  accessToken: string
): Promise<SpecialQuote> {
  const { sheetName, headers, columns } = metadata;

  const newRowValues = new Array(headers.length).fill('');

  const idIdx = columns['ID'] !== undefined ? columns['ID'] : 0;
  newRowValues[idIdx] = String(nextId);

  const fraseIdx = columns['Frase'] !== undefined ? columns['Frase'] : 1;
  newRowValues[fraseIdx] = newQuoteData.frase;

  const topicoIdx = columns['Tópico'] !== undefined ? columns['Tópico'] : (columns['Topico'] !== undefined ? columns['Topico'] : 2);
  newRowValues[topicoIdx] = newQuoteData.topico;

  metadata.categories.forEach(cat => {
    const colIdx = columns[cat];
    if (colIdx !== undefined) {
      newRowValues[colIdx] = newQuoteData.categories[cat] ? 'X' : '';
    }
  });

  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.findIndex(h => h.toLowerCase() === 'tipo');
  if (tipoIdx !== -1) {
    newRowValues[tipoIdx] = newQuoteData.tipo;
  }

  const imagemIdx = columns['Imagem'] !== undefined ? columns['Imagem'] : headers.findIndex(h => h.toLowerCase() === 'imagem');
  if (imagemIdx !== -1) {
    newRowValues[imagemIdx] = newQuoteData.imagem;
  }

  const notasIdx = columns['Notas'] !== undefined ? columns['Notas'] : headers.findIndex(h => h.toLowerCase() === 'notas');
  if (notasIdx !== -1) {
    newRowValues[notasIdx] = newQuoteData.notas;
  }

  const range = `'${sheetName}'!A:A`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [newRowValues],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to append special quote. Status: ${response.status}. Error: ${errText}`);
  }

  const data = await response.json();
  const updatedRange = data.updates.updatedRange;
  const match = updatedRange.match(/A(\d+):/);
  const rowIdx = match ? parseInt(match[1], 10) : nextId + 1;

  return {
    id: nextId,
    rowIdx,
    frase: newQuoteData.frase,
    topico: newQuoteData.topico,
    categories: newQuoteData.categories,
    tipo: newQuoteData.tipo,
    imagem: newQuoteData.imagem,
    notas: newQuoteData.notas,
  };
}

/**
 * Inserts a new category/tag column into the Especial sheet
 */
export async function addSpecialCategoryColumn(
  spreadsheetId: string,
  metadata: SpecialSheetsMetadata,
  newCategoryName: string,
  accessToken: string
): Promise<SpecialSheetsMetadata> {
  const { sheetId, sheetName, headers, columns } = metadata;

  const tipoIdx = columns['Tipo'] !== undefined ? columns['Tipo'] : headers.findIndex(h => h.toLowerCase() === 'tipo');
  if (tipoIdx === -1) {
    throw new Error("Could not locate the 'Tipo' column in Especial sheet to insert new category.");
  }

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const insertRequest = {
    requests: [
      {
        insertDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: tipoIdx,
            endIndex: tipoIdx + 1,
          },
          inheritFromBefore: true,
        },
      },
    ],
  };

  const insertResponse = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(insertRequest),
  });

  if (!insertResponse.ok) {
    const errText = await insertResponse.text();
    throw new Error(`Failed to insert category column in Sheets. Status: ${insertResponse.status}. Error: ${errText}`);
  }

  const newColLetter = getColLetter(tipoIdx);
  const cellRange = `'${sheetName}'!${newColLetter}1`;
  const setHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`;

  const setHeaderResponse = await fetch(setHeaderUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: cellRange,
      majorDimension: 'ROWS',
      values: [[newCategoryName]],
    }),
  });

  if (!setHeaderResponse.ok) {
    const errText = await setHeaderResponse.text();
    throw new Error(`Failed to set category header text. Status: ${setHeaderResponse.status}. Error: ${errText}`);
  }

  const updatedHeaders = [...headers];
  updatedHeaders.splice(tipoIdx, 0, newCategoryName);

  const updatedColumns: { [key: string]: number } = {};
  updatedHeaders.forEach((hdr, idx) => {
    updatedColumns[hdr] = idx;
  });

  const updatedCategories = [...metadata.categories];
  updatedCategories.push(newCategoryName);

  return {
    ...metadata,
    categories: updatedCategories,
    headers: updatedHeaders,
    columns: updatedColumns,
  };
}
