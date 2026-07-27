import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Download, Share2, Plus, Check, Trash2, Edit3, Eye, Sliders, AlertTriangle, Star, Shuffle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Quote, SheetsMetadata } from '../types';

interface QuoteDetailModalProps {
  quote: Quote | null;
  onClose: () => void;
  metadata: SheetsMetadata | null;
  onSaveQuote: (updatedQuote: Quote) => Promise<void>;
  onDeleteQuote?: (quoteId: number, rowIdx: number) => Promise<void>;
  onAddNewCategory: (categoryName: string) => Promise<void>;
  isProcessing: boolean;
  onPickRandom?: () => void;
  onPrevQuote?: () => void;
  onNextQuote?: () => void;
  currentTab?: 'hoje' | 'explorar' | 'favoritos';
}

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
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
    setQuoteCategories({ ...quote.categories });
    setEditMode(false);
  }, [quote]);

  // Handle Share as Text
  const handleCopyText = async () => {
    // Only share the phrase text. If notes exist, append it. Do not share ID or categories.
    const textToShare = notas ? `"${frase}"\n\n— ${notas}` : `"${frase}"`;
    try {
      await navigator.clipboard.writeText(textToShare);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
    }
  };

  // Process and Draw quote on in-memory high-res Canvas for Sharing as Image
  const handleDownloadImage = async () => {
    try {
      setImageGenerating(true);
      
      // Standard landscape HD dimensions (1920x1080) for spectacular resolution
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
      ctx.font = '24px "Space Grotesk", sans-serif';
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
      const midPointOffset = (350 - totalBlockHeight) / 2;
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
      link.download = `mente-viva-frase-${quote.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Falha ao gerar e obter imagem:', err);
    } finally {
      setImageGenerating(false);
    }
  };

  // Toggle local representation of categories checkboxes
  const handleToggleCategory = (catName: string) => {
    setQuoteCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  // Create new category in sheet and auto-check it
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (metadata?.categories.includes(cleanName)) {
      alert('Esta categoria já existe!');
      return;
    }

    try {
      setIsCreatingCat(true);
      await onAddNewCategory(cleanName);
      
      // Auto-check this category on creation
      setQuoteCategories(prev => ({
        ...prev,
        [cleanName]: true
      }));
      setNewCatName('');
    } catch (err) {
      console.error('Erro ao criar categoria:', err);
      alert('Não foi possível adicionar a categoria no Sheets. Verifique a conexão.');
    } finally {
      setIsCreatingCat(false);
    }
  };

  // Submit edits back to App
  const handleSave = async () => {
    if (tipo !== 'Imagem' && !frase.trim()) {
      alert('A frase não pode estar em branco!');
      return;
    }

    const updated: Quote = {
      ...quote,
      frase: frase.trim(),
      notas: notas.trim(),
      tipo,
      imagem: tipo === 'Imagem' ? imagem.trim() : '',
      categories: quoteCategories,
    };

    await onSaveQuote(updated);
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!onDeleteQuote) return;
    const confirmed = window.confirm(
      `ATENÇÃO: Você deseja apagar definitivamente a frase #${quote.id} do seu Sheets? Essa ação é irreversível!`
    );
    if (!confirmed) return;

    await onDeleteQuote(quote.id, quote.rowIdx);
    onClose();
  };

  // Active external categories for visual tag lists (except standard Favorito and Privado)
  const activeTags = Object.keys(quote.categories).filter(
    cat => quote.categories[cat] && cat !== 'Favorito' && cat !== 'Privado'
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Dark overlay backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xl cursor-pointer"
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

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          id="quote-detail-dialog"
          className="relative bg-[#121214]/60 backdrop-blur-2xl border-2 border-white/15 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10 text-left shadow-2xl flex flex-col"
        >
          {/* Modal Header */}
          <div className="sticky top-0 bg-black/30 backdrop-blur-md border-b border-white/15 px-6 py-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1 rounded-xl bg-white/5 border border-white/15 text-white/50">
                {quote.id === 0 ? 'nova frase' : `#${quote.id}`}
              </span>
              {quote.categories['Privado'] && (
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-amber-400 bg-amber-400/5 border border-amber-400/20 px-2.5 py-1 rounded-xl">
                  secreto
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEditMode(!editMode)}
                id="btn-toggle-edit"
                className={`p-2 rounded-xl border transition-all duration-200 ${
                  editMode
                    ? 'bg-white text-black border-transparent'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                }`}
                title={editMode ? 'Visualizar Frase' : 'Editar Frase e Categorias'}
              >
                {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                id="btn-close-modal"
                className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white hover:bg-white/10 duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Content Column */}
          <div className="p-6 md:p-8 flex-grow overflow-y-auto space-y-6">
            {!editMode ? (
              /* ================= VISUALIZATION VIEW ================= */
              <div className="space-y-6">
                {/* Visual Card Backdrop resembling standard card detail */}
                <div className="bg-white/5 p-6 md:p-8 rounded-2xl border border-white/10 flex flex-col gap-4 backdrop-blur-md">
                  {quote.tipo === 'Imagem' && quote.imagem ? (
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 relative">
                      <img
                        src={quote.imagem}
                        alt="Background of Quote"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {quote.frase && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/50 to-transparent p-5">
                          <p className="text-white text-lg md:text-xl font-light tracking-wide leading-relaxed whitespace-pre-wrap">
                            &ldquo;{quote.frase}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white text-lg md:text-[22px] font-sans font-light leading-relaxed tracking-wide italic whitespace-pre-wrap">
                      &ldquo;{quote.frase}&rdquo;
                    </p>
                  )}

                  {quote.notes || quote.notas ? (
                    <div className="mt-2 border-l border-white/20 pl-4 py-1">
                      <h4 className="text-[10px] uppercase tracking-wider text-white/30 font-mono mb-1">Nota / Autor</h4>
                      <p className="text-white/60 text-xs md:text-sm italic leading-relaxed whitespace-pre-wrap">{quote.notas}</p>
                    </div>
                  ) : null}

                  {/* Active tags visual list */}
                  {activeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-4 border-t border-white/5">
                      {activeTags.map(tag => (
                        <span key={tag} className="text-[10px] font-mono text-white/40 bg-white/5 px-2.5 py-0.5 rounded-full lowercase border border-white/5">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operations Bar */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  {onPickRandom && (
                    <button
                      onClick={onPickRandom}
                      id="btn-modal-random"
                      className="flex-1 py-3.5 px-4 bg-white hover:bg-white/90 text-black rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      {currentTab === 'favoritos' ? (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                      ) : (
                        <Shuffle className="w-4 h-4 text-black/60" />
                      )}
                      Aleatório
                    </button>
                  )}

                  <button
                    onClick={handleCopyText}
                    id="btn-share-text"
                    className="flex-1 py-3.5 px-4 bg-white/5 text-white border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4 text-white/60" />
                    {copiedText ? 'Copiado!' : 'Compartilhar como Texto'}
                  </button>

                  <button
                    onClick={handleDownloadImage}
                    disabled={imageGenerating}
                    id="btn-share-image"
                    className="flex-1 py-3.5 px-4 bg-white/5 text-white border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-white/60" />
                    {imageGenerating ? 'Gerando Imagem...' : 'Compartilhar como Imagem'}
                  </button>
                </div>
              </div>
            ) : (
              /* ================= EDIT MODE FORM ================= */
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Phrase field */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                      Conteúdo / Citação
                    </label>
                    <textarea
                      id="edit-frase"
                      value={frase}
                      onChange={(e) => setFrase(e.target.value)}
                      rows={4}
                      className="w-full bg-black/40 text-white text-sm p-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 leading-relaxed"
                      placeholder="Insira a frase de conhecimento aqui..."
                    />
                  </div>

                  {/* Notes Field */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                      Notas / Autor (Opcional)
                    </label>
                    <input
                      type="text"
                      id="edit-notas"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className="w-full bg-black/40 text-white text-sm p-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/20"
                      placeholder="Ex: Marcus Aurelious, ou reflexão pessoal..."
                    />
                  </div>

                  {/* Quote Type selector */}
                  <div className="grid grid-cols-2 gap-3 font-sans">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                        Tipo de Card
                      </label>
                      <select
                        id="edit-tipo"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value as 'Frase' | 'Imagem')}
                        className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 focus:outline-none focus:border-white/20"
                      >
                        <option value="Frase">Frase</option>
                        <option value="Imagem">Imagem</option>
                      </select>
                    </div>

                    {tipo === 'Imagem' && (
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                          URL da Imagem Online
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
                                    ? 'text-amber-400 fill-amber-400'
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
                      Excluir Frase
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
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-white text-black font-semibold rounded-xl text-xs hover:bg-white/90 transition-all disabled:opacity-55 shadow-md"
                    >
                      {isProcessing ? 'Gravando...' : 'Gravar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
