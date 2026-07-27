import React, { useMemo, useEffect } from 'react';
import { Star } from 'lucide-react';
import { QuoteCard } from './QuoteCard';
import { Quote } from '../types';

interface FavoritosTabProps {
  quotes: Quote[];
  onOpenQuote: (quote: Quote, pool?: Quote[]) => void;
  onToggleFavorite: (quote: Quote) => void;
  isFavoriteLoading: boolean;
  onUpdatePool?: (pool: Quote[]) => void;
}

export const FavoritosTab: React.FC<FavoritosTabProps> = ({
  quotes,
  onOpenQuote,
  onToggleFavorite,
  isFavoriteLoading,
  onUpdatePool,
}) => {
  const favoriteQuotes = useMemo(() => {
    return quotes.filter((q) => q.categories['Favorito'] === true);
  }, [quotes]);

  // Sync active pool to App
  useEffect(() => {
    onUpdatePool?.(favoriteQuotes);
  }, [favoriteQuotes, onUpdatePool]);

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto px-4 sm:px-6 text-left">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-500/20" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold leading-none">
            Frases Favoritas ({favoriteQuotes.length})
          </h3>
        </div>
      </div>

      {favoriteQuotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {favoriteQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onOpen={(q) => onOpenQuote(q, favoriteQuotes)}
              onToggleFavorite={onToggleFavorite}
              isFavoriteLoading={isFavoriteLoading}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl bg-white/5">
          <div className="p-4 rounded-full bg-white/5 border border-white/10 w-fit mx-auto mb-4 text-white/30">
            <Star className="w-6 h-6 text-white/30" />
          </div>
          <h3 className="text-sm font-semibold text-white/70">Nenhum favorito selecionado</h3>
          <p className="text-white/40 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
            Navegue pelas abas &ldquo;Hoje&rdquo; ou &ldquo;Explorar&rdquo; e clique no ícone da estrela em qualquer card para adicioná-la aqui.
          </p>
        </div>
      )}
    </div>
  );
};
