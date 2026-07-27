import React from 'react';
import { Star, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Quote, SpecialQuote } from '../types';

interface QuoteCardProps {
  quote: Quote | SpecialQuote;
  onOpen: (quote: any) => void;
  onToggleFavorite?: (quote: any) => void;
  isFavoriteLoading?: boolean;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quote,
  onOpen,
  onToggleFavorite,
  isFavoriteLoading = false,
}) => {
  const isFav = quote.categories['Favorito'] || false;
  const isPrivate = quote.categories['Privado'] || false;

  // Gather other active categories for visual badges
  const activeCategories = Object.keys(quote.categories).filter(
    (cat) => quote.categories[cat] && cat !== 'Favorito' && cat !== 'Privado'
  );

  return (
    <div
      id={`quote-card-${quote.id}`}
      className="group relative bg-[#ffffff]/5 backdrop-blur-md border-2 border-white/10 hover:border-white/20 rounded-2xl p-6 hover:bg-[#ffffff]/10 transition-all duration-300 flex flex-col justify-between gap-5 cursor-pointer"
      onClick={() => onOpen(quote)}
    >
      {/* Background glow overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

      {/* Card Header Info */}
      <div className="flex items-center justify-between z-10">
        {/* Subtle ID */}
        <span className="text-xs font-mono tracking-wider text-white/40 group-hover:text-white/60 font-semibold transition-colors">
          #{quote.id}
        </span>

        {/* Action Toggles (Favorite Star + Private indicator) */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isPrivate && (
            <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-full bg-[#ffffff]/15 text-white/50 border border-white/10">
              Secret
            </span>
          )}

          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(quote)}
              disabled={isFavoriteLoading}
              id={`btn-favorite-${quote.id}`}
              className={`p-1.5 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                isFav
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/35 hover:bg-amber-400/20'
                  : 'bg-[#ffffff]/5 text-white/40 border-white/10 hover:text-white/70 hover:border-white/25'
              }`}
              title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Quote Body */}
      <div className="flex flex-col gap-4 z-10 flex-grow">
        {/* If quote is Image type and has URL */}
        {quote.tipo === 'Imagem' && quote.imagem ? (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5 border-2 border-white/10 transition-colors">
            <img
              src={quote.imagem}
              alt={quote.frase || 'Imagem de Conhecimento'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              onError={(e) => {
                // If loading fails, render placeholder
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Overlay if there's text inside the image card */}
            {quote.frase && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end">
                <p className="text-white text-base md:text-lg font-normal leading-relaxed whitespace-pre-wrap">
                  &ldquo;{quote.frase}&rdquo;
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Normal Phrase layout matching screenshot */
          <p className="text-white text-lg md:text-[20px] font-sans font-normal leading-relaxed tracking-wide text-left whitespace-pre-wrap">
            &ldquo;{quote.frase}&rdquo;
          </p>
        )}

        {/* Optional Notes */}
        {quote.notas && (
          <div className="border-l-2 border-white/20 pl-3 mt-1">
            <p className="text-xs md:text-[13px] text-white/50 font-sans italic leading-relaxed whitespace-pre-wrap">
              {quote.notas}
            </p>
          </div>
        )}
      </div>

      {/* Card Footer / Labels */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 z-10 text-[10px] font-mono">
        {/* Category badges */}
        <div className="flex flex-wrap gap-1">
          {activeCategories.length > 0 ? (
            activeCategories.map((cat) => {
              const capitalized = cat
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              return (
                <span
                  key={cat}
                  className="bg-white/5 text-white/50 border border-white/15 px-2.5 py-0.5 rounded-full text-[9px] font-semibold"
                >
                  {capitalized}
                </span>
              );
            })
          ) : (
            <span className="text-white/20 italic select-none">sem_categoria</span>
          )}
        </div>

        {/* Go to Details Link text */}
        <span className="text-white/50 group-hover:text-white/85 font-sans font-bold text-[11px] transition-colors flex items-center gap-1 shrink-0">
          Abrir <span className="transform group-hover:translate-x-0.5 transition-transform duration-200 font-bold">➔</span>
        </span>
      </div>
    </div>
  );
};
