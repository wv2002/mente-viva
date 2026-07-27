export interface Quote {
  id: number;
  rowIdx: number; // Row index in sheets (2-based or depending on sheet)
  frase: string;
  categories: { [key: string]: boolean }; // Key: category name, Value: is part of category (marked with 'X')
  tipo: 'Frase' | 'Imagem';
  imagem: string;
  notas: string;
}

export interface SpecialQuote {
  id: number;
  rowIdx: number;
  frase: string;
  topico: 'Expressões' | 'Palavras Rebuscadas' | 'Palavras Engraçadas' | string;
  categories: { [key: string]: boolean };
  tipo: 'Frase' | 'Imagem';
  imagem: string;
  notas: string;
}

export interface SheetsMetadata {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  categories: string[]; // List of categories dynamically parsed from headers
  columns: { [key: string]: number }; // Maps column name (e.g. "ID", "Frase", or category name) to its 0-based index
  headers: string[]; // List of all headers in Row 1
}

export interface SpecialSheetsMetadata {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  categories: string[]; // List of tags/categories (everything after Topico and before Tipo)
  columns: { [key: string]: number };
  headers: string[];
}

export type FilterState = 'include' | 'exclude' | 'neutral';

export interface CategoryFilter {
  [categoryName: string]: FilterState;
}
