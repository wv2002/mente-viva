import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Download, Plus, Check, Trash2, Edit3, Eye, Sliders, Star, Shuffle, ChevronLeft, ChevronRight } from 'lucide-react';
import { SpecialQuote, SpecialSheetsMetadata } from '../types';

interface SpecialQuoteDetailModalProps {
  quote: SpecialQuote | null;
  onClose: () => void;
  metadata: SpecialSheetsMetadata | null;
  onSaveQuote: (updatedQuote: SpecialQuote) => Promise<void>;
  onDeleteQuote?: (quoteId: number, rowIdx: number) => Promise<void>;
  onAddNewCategory: (categoryName: string) => Promise<void>;
  isProcessing: boolean;
  onPickRandom?: () => void;
  onPrevQuote?: () => void;
  onNextQuote?: () => void;
  currentTab?: 'hoje' | 'explorar' | 'favoritos';
}

export const SpecialQuoteDetailModal: React.FC<SpecialQuoteDetailModalProps> = ({
  quote,
  onClose,
  metadata,
  onSaveQuote,
  onDeleteQuote,
  onAddNewCategory,
  isProcessing,
  onPickRandom,
  onPrevQuote,
  onNextQuote,
  currentTab,
}) => {
  if (!quote) return null;

  const [editMode, setEditMode] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  
  // Edit Form States
  const [frase, setFrase] = useState(quote.frase);
  const [notas, setNotas] = useState(quote.notas);
  const [tipo, setTipo] = useState<'Frase' | 'Imagem'>(quote.tipo);
  const [imagem, setImagem] = useState(quote.imagem);
  const [topico, setTopico] = useState(quote.topico);
  const [quoteCategories, setQuoteCategories] = useState<{ [key: string]: boolean }>({ ...quote.categories });

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  // Sync state when quote changes
  useEffect(() => {
    setFrase(quote.frase);
    setNotas(quote.notas);
    setTipo(quote.tipo);
    setImagem(quote.imagem);
    setTopico(quote.topico);
    setQuoteCategories({ ...quote.categories });
    setEditMode(false);
  }, [quote]);

  // Handle Share as Text
  const handleCopyText = async () => {
    const textToShare = notas ? `"${frase}"\n\n— ${notas}` : `"${frase}"`;
    try {
      await navigator.clipboard.writeText(textToShare);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
    }
  };

  // Draw quote on in-memory Canvas for Sharing as Image
  const handleDownloadImage = async () => {
    if (imageGenerating) return;
    setImageGenerating(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background (solid dark gray matching Mente Viva)
      ctx.fillStyle = '#0f0f11';
      ctx.fillRect(0, 0, 1200, 675);

      // Add a quote mark icon watermark moved lower to not overlap with logo
      ctx.fillStyle = '#161619';
      ctx.font = '350px serif';
      ctx.fillText('“', 80, 420);

      // Draw Mente Viva branding header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('MENTE VIVA', 80, 90);

      // Wrap and Draw actual quote text preserving user newlines \n
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'italic 300 38px "Inter", sans-serif';
      
      const textToDraw = frase;
      const maxWidth = 1040;
      const x = 80;
      let y = 240;
      const lineHeight = 55;

      const paragraphs = textToDraw.split('\n');
      const lines: string[] = [];

      for (const para of paragraphs) {
        if (para.trim() === '') {
          lines.push('');
          continue;
        }
        const words = para.split(' ');
        let currentLine = '';
        for (let n = 0; n < words.length; n++) {
          const testLine = currentLine + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            lines.push(currentLine.trim());
            currentLine = words[n] + ' ';
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine.trim());
      }

      // Vertically center the block if it has multiple lines
      const totalBlockHeight = lines.length * lineHeight;
      const midPointOffset = (250 - totalBlockHeight) / 2;
      y = y + (midPointOffset > 0 ? midPointOffset : 0);

      for (let i = 0; i < lines.length; i++) {
        if (lines[i] !== '') {
          ctx.fillText(lines[i], x, y + (i * lineHeight));
        }
      }

      // Draw horizontal separator line
      const separatorY = y + totalBlockHeight + 35;
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(80, separatorY);
      ctx.lineTo(240, separatorY);
      ctx.stroke();

      // Draw notes / credits under separator
      if (notas) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '500 21px "Inter", sans-serif';
        ctx.fillText(notas, 80, separatorY + 45);
      }

      // Save to blob
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `menteviva_especial_${quote.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image share asset:', err);
    } finally {
      setImageGenerating(false);
    }
  };

  const handleToggleCategory = (catName: string) => {
    setQuoteCategories(prev => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName || isCreatingCat) return;

    setIsCreatingCat(true);
    try {
      await onAddNewCategory(cleanName);
      setQuoteCategories(prev => ({
        ...prev,
        [cleanName]: true,
      }));
      setNewCatName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCat(false);
    }
  };

  const handleSave = async () => {
    const updated: SpecialQuote = {
      ...quote,
      frase,
      notas,
      tipo,
      imagem,
      topico,
      categories: quoteCategories,
    };

    await onSaveQuote(updated);
    setEditMode(false);
  };

  const handleDelete = () => {
    if (!onDeleteQuote) return;
    const confirmed = window.confirm('Tem certeza de que deseja deletar permanentemente esta citação do seu Sheets Especial?');
    if (confirmed) {
      onDeleteQuote(quote.id, quote.rowIdx);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          id="modal-backdrop"
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Left Arrow Button */}
        {onPrevQuote && (
          <button
            onClick={onPrevQuote}
            className="fixed left-2 sm:left-4 md:left-6 lg:left-12 top-1/2 -translate-y-1/2 z-55 p-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer hover:scale-110 shadow-lg active:scale-95"
            id="btn-prev-quote"
            title="Anterior"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}

        {/* Modal Sheet Container */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          id="modal-content"
          className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-neutral-950">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full font-bold">
                Cópia Especial #{quote.id || 'Nova'}
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-1 bg-white/5 border border-white/10 text-white/50 rounded-full">
                {quote.topico}
              </span>
            </div>
            <button
              onClick={onClose}
              id="btn-close-modal"
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-full duration-150 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Main Body */}
          <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6">
            {!editMode ? (
              /* ================= READ ONLY VIEW ================= */
              <div className="space-y-6">
                {/* Content Presentational Container */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-6 md:p-8 relative min-h-[160px] flex flex-col justify-center">
                  {quote.tipo === 'Imagem' && quote.imagem ? (
                    <div className="relative rounded-xl overflow-hidden max-h-[350px] flex items-center justify-center bg-black/60 aspect-video select-none shadow-inner border border-white/5 mb-4">
                      <img
                        src={quote.imagem}
                        alt="Especial"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {quote.frase && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/50 to-transparent p-5">
                          <p className="text-white text-lg md:text-xl font-light tracking-wide leading-relaxed whitespace-pre-wrap">
                            {quote.frase}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white text-lg md:text-[22px] font-sans font-light leading-relaxed tracking-wide italic whitespace-pre-wrap">
                      &ldquo;{quote.frase}&rdquo;
                    </p>
                  )}

                  {quote.notas ? (
                    <div className="mt-4 border-l border-white/20 pl-4 py-1">
                      <h4 className="text-[10px] uppercase tracking-wider text-white/30 font-mono mb-1">Nota / Significado</h4>
                      <p className="text-white/60 text-xs md:text-sm italic leading-relaxed whitespace-pre-wrap">{quote.notas}</p>
                    </div>
                  ) : null}

                  {/* Active tags tags list */}
                  <div className="flex flex-wrap gap-1.5 mt-5 pt-3 border-t border-white/5">
                    {Object.keys(quote.categories)
                      .filter(c => quote.categories[c])
                      .map(c => (
                        <span key={c} className="text-[10px] font-mono lowercase px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 rounded-md">
                          #{c}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Primary Interaction Buttons Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleCopyText}
                    id="btn-copy-text"
                    className="py-3.5 px-4 bg-white/5 text-white border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-white/60" />
                    {copiedText ? 'Copiado!' : 'Copiar Texto'}
                  </button>

                  <button
                    onClick={handleDownloadImage}
                    disabled={imageGenerating}
                    id="btn-share-image"
                    className="py-3.5 px-4 bg-white/5 text-white border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-white/60" />
                    {imageGenerating ? 'Gerando...' : 'Compartilhar Imagem'}
                  </button>

                  {onPickRandom && (
                    <button
                      onClick={onPickRandom}
                      id="btn-modal-random"
                      className="col-span-2 sm:col-span-1 py-3.5 px-4 bg-white hover:bg-white/90 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      {currentTab === 'favoritos' ? (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                      ) : (
                        <Shuffle className="w-4 h-4 text-black/60" />
                      )}
                      Aleatório
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ================= ACTIVE EDIT FORM VIEW ================= */
              <div className="space-y-6">
                {/* Phrase Content Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">
                    Termo / Expressão / Frase
                  </label>
                  <textarea
                    id="edit-frase"
                    value={frase}
                    onChange={(e) => setFrase(e.target.value)}
                    rows={4}
                    className="w-full bg-black/40 text-white p-4 rounded-xl border border-white/10 focus:outline-none focus:border-white/20 text-sm leading-relaxed font-sans"
                    placeholder="Digite a frase ou palavra especial aqui..."
                  />
                </div>

                {/* Optional Note / Meaning text fields */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">
                    Significado / Notas
                  </label>
                  <input
                    type="text"
                    id="edit-notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full bg-black/40 text-white p-4 rounded-xl border border-white/10 focus:outline-none focus:border-white/20 text-sm font-sans"
                    placeholder="Ex: Significa que algo é maravilhoso..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Topic Select */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">
                      Tópico Especial
                    </label>
                    <select
                      id="edit-topico"
                      value={topico}
                      onChange={(e) => setTopico(e.target.value)}
                      className="w-full bg-black/40 text-white text-sm p-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/20"
                    >
                      <option value="Expressões">Expressões</option>
                      <option value="Palavras Rebuscadas">Palavras Rebuscadas</option>
                      <option value="Palavras Engraçadas">Palavras Engraçadas</option>
                    </select>
                  </div>

                  {/* Card type configs */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-3 font-sans">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                          Tipo de Card
                        </label>
                        <select
                          id="edit-tipo"
                          value={tipo}
                          onChange={(e) => setTipo(e.target.value as 'Frase' | 'Imagem')}
                          className="w-full bg-black/40 text-white text-sm p-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/20"
                        >
                          <option value="Frase">Frase</option>
                          <option value="Imagem">Imagem</option>
                        </select>
                      </div>

                      {tipo === 'Imagem' && (
                        <div>
                          <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                            URL da Imagem
                          </label>
                          <input
                            type="url"
                            id="edit-imagem-url"
                            value={imagem}
                            onChange={(e) => setImagem(e.target.value)}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 focus:outline-none focus:border-white/20"
                            placeholder="https://exemplo.com/imagem.jpg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Categories Checkbox Matrix */}
                <div className="border-t border-white/10 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5 font-semibold">
                      <Sliders className="w-4 h-4 text-white/40" />
                      Categorias no Sheets
                    </h3>
                  </div>

                  {metadata ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {metadata.categories.map(cat => {
                        const isChecked = quoteCategories[cat] || false;
                        const isFavorito = cat === 'Favorito' || cat === 'Favoritos';
                        return (
                          <div
                            key={cat}
                            onClick={() => handleToggleCategory(cat)}
                            className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                              isChecked
                                ? isFavorito
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-350 font-semibold'
                                  : 'bg-white/10 border-white/30 text-white font-medium'
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/15'
                            }`}
                          >
                            {isFavorito ? (
                              <Star
                                className={`w-4 h-4 transition-all duration-200 ${
                                  isChecked
                                    ? 'text-amber-450 fill-amber-450'
                                    : 'text-white/20 fill-none'
                                }`}
                              />
                            ) : (
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                isChecked ? 'bg-white border-transparent' : 'border-white/20'
                              }`}>
                                {isChecked && <Check className="w-3 h-3 text-black stroke-[3]" />}
                              </div>
                            )}
                            <span className={`text-xs truncate lowercase font-mono ${
                              isChecked && isFavorito ? 'text-amber-300' : ''
                            }`}>{cat}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic font-mono">Carregando categorias...</p>
                  )}

                  {/* Form to insert a Brand New Category column dynamically */}
                  <form onSubmit={handleCreateCategory} className="flex gap-2 pt-3 max-w-sm">
                    <input
                      type="text"
                      id="input-new-category"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Adicionar nova categoria..."
                      disabled={isCreatingCat}
                      className="bg-black/40 text-white text-xs px-3.5 py-2.5 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 flex-grow placeholder:text-white/30"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingCat || !newCatName.trim()}
                      id="btn-create-category"
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1 border border-white/10 disabled:opacity-50 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </form>
                </div>

                {/* Confirm Edits or Trigger Delete Actions */}
                <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {onDeleteQuote ? (
                    <button
                      onClick={handleDelete}
                      disabled={isProcessing}
                      id="btn-delete-quote"
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 text-rose-450 hover:bg-rose-500/20 rounded-xl text-xs font-bold duration-200 transition-colors flex items-center justify-center gap-1.5 border border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 text-white/50 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition-all"
                    >
                      Sair sem Salvar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isProcessing}
                      id="btn-save-quote"
                      className="flex-grow sm:flex-none px-6 py-2.5 bg-white hover:bg-white/90 text-black rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls (Switching between Read mode vs Edit mode) */}
          {!editMode && (
            <div className="p-4 bg-neutral-950 border-t border-white/5 text-right">
              <button
                onClick={() => setEditMode(true)}
                id="btn-trigger-edit"
                className="px-5 py-2.5 bg-white/5 text-white/80 hover:text-white border border-white/10 rounded-xl text-xs font-bold duration-200 transition-colors flex items-center gap-2 ml-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar no Sheets
              </button>
            </div>
          )}
        </motion.div>

        {/* Right Arrow Button */}
        {onNextQuote && (
          <button
            onClick={onNextQuote}
            className="fixed right-2 sm:right-4 md:right-6 lg:right-12 top-1/2 -translate-y-1/2 z-55 p-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer hover:scale-110 shadow-lg active:scale-95"
            id="btn-next-quote"
            title="Próximo"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}
      </div>
    </AnimatePresence>
  );
};
