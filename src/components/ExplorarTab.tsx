import React, { useState, useMemo, useEffect } from 'react';
import { Search, Shuffle, Filter, Check, Eye, EyeOff, Info, ToggleLeft, HelpCircle } from 'lucide-react';
import { Quote, SheetsMetadata, CategoryFilter, FilterState } from '../types';
import { QuoteCard } from './QuoteCard';

interface ExplorarTabProps {
  quotes: Quote[];
  metadata: SheetsMetadata | null;
  onOpenQuote: (quote: Quote, pool?: Quote[]) => void;
  onToggleFavorite: (quote: Quote) => void;
  isFavoriteLoading: boolean;
  onUpdatePool?: (pool: Quote[]) => void;
}

export const ExplorarTab: React.FC<ExplorarTabProps> = ({
  quotes,
  metadata,
  onOpenQuote,
  onToggleFavorite,
  isFavoriteLoading,
  onUpdatePool,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CategoryFilter>({});
  const [showPrivadoCategory, setShowPrivadoCategory] = useState(false);

  // Filter items dynamically based on inputs and active filters
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      // 1. Handle Privado secrecy
      const isPrivate = q.categories['Privado'] || false;
      if (!showPrivadoCategory && isPrivate) {
        return false; // strictly exclude private quotes by default
      }

      // 2. Search match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const fraseMatch = q.frase.toLowerCase().includes(term);
        const notasMatch = (q.notas || '').toLowerCase().includes(term);
        if (!fraseMatch && !notasMatch) {
          return false;
        }
      }

      // 3. Multi-State Category Filters match
      for (const catName of Object.keys(filters)) {
        const state = filters[catName];
        if (state === 'include') {
          // Quote MUST have this category checked
          if (!q.categories[catName]) return false;
        } else if (state === 'exclude') {
          // Quote MUST NOT have this category checked
          if (q.categories[catName]) return false;
        }
      }

      return true;
    });
  }, [quotes, searchTerm, filters, showPrivadoCategory]);

  // Sync active pool to App
  useEffect(() => {
    onUpdatePool?.(filteredQuotes);
  }, [filteredQuotes, onUpdatePool]);

  // Cycle filter state: neutral -> include -> exclude -> neutral
  const handleToggleFilter = (catName: string) => {
    setFilters((prev) => {
      const current = prev[catName] || 'neutral';
      let next: FilterState = 'neutral';
      if (current === 'neutral') next = 'include';
      else if (current === 'include') next = 'exclude';
      else if (current === 'exclude') next = 'neutral';

      return {
        ...prev,
        [catName]: next,
      };
    });
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // Handle Pick Random Quote from the current results
  const handlePickRandom = () => {
    const listToPick = filteredQuotes.length > 0 ? filteredQuotes : quotes;
    if (listToPick.length === 0) return;
    const randomIndex = Math.floor(Math.random() * listToPick.length);
    onOpenQuote(listToPick[randomIndex]);
  };

  // Render list of categories available (respecting "Privado" visibility)
  const renderedCategories = useMemo(() => {
    if (!metadata) return [];
    return metadata.categories.filter((cat) => {
      if (cat === 'Favorito') return false; // Favorito is redundant here, we search it elsewhere
      if (cat === 'Privado' && !showPrivadoCategory) return false;
      return true;
    });
  }, [metadata, showPrivadoCategory]);

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto px-4 sm:px-6 text-left">
      {/* Search Header layout */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input Icon wrapper */}
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
          <input
            type="text"
            id="input-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por palavras nas frases ou nas notas..."
            className="w-full bg-black/40 text-white text-sm pl-12 pr-4 py-3 border border-white/10 rounded-2xl focus:outline-none focus:border-white/20 backdrop-blur-md placeholder:text-white/30"
          />
        </div>

        {/* Action Button: Aleatório */}
        <button
          onClick={handlePickRandom}
          id="btn-random-quote"
          className="py-3 px-5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl duration-200 transition-colors flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer shrink-0"
          title="Abrir uma frase de conhecimento aleatória"
        >
          <Shuffle className="w-4 h-4 text-white/60" />
          Aleatório
        </button>
      </div>

      {/* Category filters container board */}
      <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col gap-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/50" />
          </div>

          <div className="flex items-center gap-3">
            {/* Discreet toggle dot for Privado */}
            <div
              onClick={() => {
                const nextVal = !showPrivadoCategory;
                setShowPrivadoCategory(nextVal);
                if (!nextVal) {
                  setFilters((prev) => {
                    const copy = { ...prev };
                    delete copy['Privado'];
                    return copy;
                  });
                }
              }}
              id="btn-toggle-private-categories"
              className="w-2 h-2 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-default"
              title="•"
            />

            {/* Clear filters trigger */}
            {(searchTerm || Object.values(filters).some(st => st !== 'neutral')) && (
              <button
                onClick={handleClearFilters}
                className="text-[10px] text-white/40 hover:text-red-400 font-mono transition-colors border border-white/15 px-2 py-0.5 rounded-full hover:bg-white/10"
              >
                limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Badges Box Grid */}
        {renderedCategories.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1 font-mono leading-none">
            {renderedCategories.map((cat) => {
              const state = filters[cat] || 'neutral';
              let badgeStyle = 'bg-white/5 text-white/40 border-white/15 hover:border-white/35';
              if (state === 'include') {
                badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold';
              } else if (state === 'exclude') {
                badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold line-through decoration-rose-500/50';
              }

              return (
                <button
                  key={cat}
                  onClick={() => handleToggleFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono lowercase border transition-all duration-200 cursor-pointer ${badgeStyle}`}
                >
                  {state === 'include' && '+ '}
                  {state === 'exclude' && '- '}
                  {cat}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/30 italic text-center p-2 font-mono">Sem categorias cadastradas na planilha.</p>
        )}
      </div>

      {/* Grid displaying the resulting card list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-white/30 font-mono">
          <span>{filteredQuotes.length} de {quotes.length} itens correspondentes</span>
        </div>

        {filteredQuotes.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {filteredQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onOpen={(q) => onOpenQuote(q, filteredQuotes)}
                onToggleFavorite={onToggleFavorite}
                isFavoriteLoading={isFavoriteLoading}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-white/15 rounded-2xl bg-white/5">
            <Shuffle className="w-8 h-8 text-white/25 mx-auto mb-3 animate-pulse" />
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              Nenhuma frase corresponde aos termos digitados ou filtros selecionados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
