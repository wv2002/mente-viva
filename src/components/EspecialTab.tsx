import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smile, 
  MessagesSquare, 
  BookMarked, 
  Search, 
  Sliders, 
  Plus, 
  Star, 
  BookOpen, 
  CalendarDays, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { QuoteCard } from './QuoteCard';
import { SpecialQuote, SpecialSheetsMetadata } from '../types';

// Deterministic seed-based pseudo-random number generator (Mulberry32)
const seedRandom = (seedStr: string) => {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
  }
  return () => {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const deterministicShuffle = <T,>(array: T[], rng: () => number): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
};

interface EspecialTabProps {
  specialQuotes: SpecialQuote[];
  metadata: SpecialSheetsMetadata | null;
  onOpenQuote: (quote: SpecialQuote, pool?: SpecialQuote[]) => void;
  onToggleFavorite: (quote: SpecialQuote) => void;
  isFavoriteLoading: boolean;
  onTriggerNewSpecial: (topic: string) => void;
  onUpdatePool?: (pool: SpecialQuote[]) => void;
}

type TopicType = 'Expressões' | 'Palavras Rebuscadas' | 'Palavras Engraçadas';

export const EspecialTab: React.FC<EspecialTabProps> = ({
  specialQuotes,
  metadata,
  onOpenQuote,
  onToggleFavorite,
  isFavoriteLoading,
  onTriggerNewSpecial,
  onUpdatePool,
}) => {
  // Topic selection
  const [activeTopic, setActiveTopic] = useState<TopicType>('Expressões');
  // Sub tab selection
  const [activeSubTab, setActiveSubTab] = useState<'hoje' | 'explorar' | 'favoritos'>('hoje');

  // Search and Category filter state for Explorar (Todos)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCats, setSelectedCats] = useState<{ [category: string]: 'include' | 'exclude' | 'neutral' }>({});

  const topics: { id: TopicType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'Expressões',
      label: 'Expressões',
      desc: 'Expressões idiomáticas, gírias e ditos interessantes.',
      icon: <MessagesSquare className="w-5 h-5" />,
      color: 'from-cyan-500/10 to-teal-500/5 border-cyan-500/20 text-cyan-400',
    },
    {
      id: 'Palavras Rebuscadas',
      label: 'Palavras Rebuscadas',
      desc: 'Vocabulário sofisticado, cultismos e termos elegantes.',
      icon: <BookMarked className="w-5 h-5" />,
      color: 'from-purple-500/10 to-violet-500/5 border-purple-500/20 text-purple-400',
    },
    {
      id: 'Palavras Engraçadas',
      label: 'Palavras Engraçadas',
      desc: 'Termos divertidos, curiosos ou hilários da língua.',
      icon: <Smile className="w-5 h-5" />,
      color: 'from-yellow-500/10 to-amber-500/5 border-yellow-500/20 text-yellow-400',
    },
  ];

  // Reset page-level filters when changing topics
  useEffect(() => {
    setSearchQuery('');
    setSelectedCats({});
    setActiveSubTab('hoje');
  }, [activeTopic]);

  // Determine standard categories from metadata
  const categoriesList = useMemo(() => {
    if (!metadata) return [];
    return metadata.categories;
  }, [metadata]);

  // Toggle dynamic category filters
  const handleToggleFilter = (cat: string) => {
    setSelectedCats(prev => {
      const current = prev[cat] || 'neutral';
      let next: 'include' | 'exclude' | 'neutral' = 'neutral';
      if (current === 'neutral') next = 'include';
      else if (current === 'include') next = 'exclude';
      return { ...prev, [cat]: next };
    });
  };

  // Get current date representation for seeded random stable draws
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // 1. Filter elements by active topic
  const topicQuotes = useMemo(() => {
    return specialQuotes.filter(q => q.topico.toLowerCase() === activeTopic.toLowerCase());
  }, [specialQuotes, activeTopic]);

  // 2. Select 5 stable random elements of today for each topic
  const dailyQuotes = useMemo(() => {
    if (topicQuotes.length === 0) return [];
    
    // Sort quotes strictly by ID so order is always identical before shuffling
    const sortedQuotes = [...topicQuotes].sort((a, b) => a.id - b.id);
    const todayStr = getTodayStr();
    const seed = `special-${activeTopic}-${todayStr}`;
    const rng = seedRandom(seed);
    const shuffled = deterministicShuffle(sortedQuotes, rng);
    
    // Return up to 5 elements
    return shuffled.slice(0, 5);
  }, [topicQuotes, activeTopic]);

  // 3. Filter for explorer tab
  const explorerFilteredQuotes = useMemo(() => {
    return topicQuotes.filter(q => {
      // Search matching
      const matchesSearch = 
        q.frase.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.notas.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Category matching
      for (const cat of Object.keys(selectedCats)) {
        const filterState = selectedCats[cat];
        if (filterState === 'include' && !q.categories[cat]) return false;
        if (filterState === 'exclude' && q.categories[cat]) return false;
      }

      return true;
    });
  }, [topicQuotes, searchQuery, selectedCats]);

  // 4. Filter for favorites tab
  const favoriteFilteredQuotes = useMemo(() => {
    return topicQuotes.filter(q => q.categories['Favorito'] === true || q.categories['Favoritos'] === true);
  }, [topicQuotes]);

  // Sync page pool with App component so the SpecialQuoteDetailModal has precise navigation context
  useEffect(() => {
    if (onUpdatePool) {
      if (activeSubTab === 'hoje') {
        onUpdatePool(dailyQuotes);
      } else if (activeSubTab === 'explorar') {
        onUpdatePool(explorerFilteredQuotes);
      } else if (activeSubTab === 'favoritos') {
        onUpdatePool(favoriteFilteredQuotes);
      }
    }
  }, [activeTopic, activeSubTab, dailyQuotes, explorerFilteredQuotes, favoriteFilteredQuotes, onUpdatePool]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 text-left">
      {/* Description header */}
      <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          Sessão Especial
        </h2>
      </div>

      {/* Grid of the three Topics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topics.map(t => {
          const isActive = activeTopic === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setActiveTopic(t.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between gap-4 ${
                isActive
                  ? `bg-white/5 hover:bg-white/10 ${t.color.split(' ').slice(2).join(' ')}`
                  : 'bg-neutral-950/40 border-white/5 text-white/50 hover:text-white/80 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`p-2.5 rounded-xl border ${
                  isActive ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/5'
                }`}>
                  {t.icon}
                </span>
                {isActive && (
                  <span className="text-[9px] uppercase font-mono tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-black">
                    Ativo
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white">{t.label}</h3>
                <p className="text-white/40 text-xs mt-1 font-light leading-relaxed">{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inner Active Topic Workspace */}
      <div className="bg-[#111113] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
        
        {/* Topic Title & Inner navigation tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="text-base font-bold text-white tracking-tight">{activeTopic}</h3>
            </div>
            <p className="text-white/40 text-xs mt-0.5">Explore, favorite e memorize termos filtrados.</p>
          </div>

          <div className="flex items-center space-x-1.5 bg-neutral-900 border border-white/10 rounded-xl p-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('hoje')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === 'hoje'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Sorteio Hoje
            </button>
            <button
              onClick={() => setActiveSubTab('explorar')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === 'explorar'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Todos ({topicQuotes.length})
            </button>
            <button
              onClick={() => setActiveSubTab('favoritos')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === 'favoritos'
                  ? 'bg-white/10 text-amber-400 font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              Favoritos ({favoriteFilteredQuotes.length})
            </button>
          </div>
        </div>

        {/* ----------------- SUB TAB PANELS ----------------- */}

        {/* 1. HOJE SPLIT PANEL */}
        {activeSubTab === 'hoje' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="flex items-center gap-2 text-white/50 bg-white/5 border border-white/10 px-4 py-3 rounded-xl w-fit">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-mono font-medium">Sorteio Diário: 5 aleatórios de hoje</span>
            </div>

            {dailyQuotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dailyQuotes.map(q => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    onOpen={(selected) => onOpenQuote(selected, dailyQuotes)}
                    onToggleFavorite={onToggleFavorite}
                    isFavoriteLoading={isFavoriteLoading}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <HelpCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/50">Nenhuma palavra cadastrada neste tópico.</p>
                <button
                  onClick={() => onTriggerNewSpecial(activeTopic)}
                  className="mt-3 px-4 py-2 bg-white/5 text-white border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold transition-colors"
                >
                  Adicionar Primeiro Item
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. EXPLORAR ALL ELEMENTS PANEL */}
        {activeSubTab === 'explorar' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* Filtering Controls box */}
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Pesquisar em frases, significados ou notas de ${activeTopic}...`}
                  className="w-full bg-black/40 text-white pl-10 pr-4 py-3 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 text-sm font-sans"
                />
              </div>

              {/* Dynamic categories check matrix */}
              {categoriesList.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Filtrar por Tags do Sheets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriesList.map(cat => {
                      const state = selectedCats[cat] || 'neutral';
                      const isFavorito = cat === 'Favorito' || cat === 'Favoritos';
                      
                      let badgeStyle = 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10';
                      if (state === 'include') {
                        badgeStyle = isFavorito 
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold'
                          : 'bg-white/10 border-white/30 text-white font-semibold';
                      } else if (state === 'exclude') {
                        badgeStyle = 'bg-rose-550/10 border-rose-500/30 text-rose-400 font-medium';
                      }

                      return (
                        <button
                          key={cat}
                          onClick={() => handleToggleFilter(cat)}
                          className={`px-3 py-1.5 border rounded-lg text-xs leading-none font-mono transition-all duration-150 flex items-center gap-1 cursor-pointer ${badgeStyle}`}
                        >
                          {state === 'include' && '+'}
                          {state === 'exclude' && '-'}
                          {cat}
                          {isFavorito && (
                            <Star className={`w-3 h-3 ${state === 'include' ? 'text-amber-400 fill-amber-400' : 'text-amber-550'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* List results */}
            {explorerFilteredQuotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {explorerFilteredQuotes.map(q => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    onOpen={(selected) => onOpenQuote(selected, explorerFilteredQuotes)}
                    onToggleFavorite={onToggleFavorite}
                    isFavoriteLoading={isFavoriteLoading}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <p className="text-sm text-white/40">Nenhuma palavra corresponde aos critérios de pesquisa.</p>
              </div>
            )}
          </div>
        )}

        {/* 3. FAVORITOS PANEL */}
        {activeSubTab === 'favoritos' && (
          <div className="space-y-6 animate-fade-in text-left">
            {favoriteFilteredQuotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {favoriteFilteredQuotes.map(q => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    onOpen={(selected) => onOpenQuote(selected, favoriteFilteredQuotes)}
                    onToggleFavorite={onToggleFavorite}
                    isFavoriteLoading={isFavoriteLoading}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <Star className="w-8 h-8 text-amber-500/30 mx-auto mb-2" />
                <p className="text-sm text-white/50">Nenhum favorito neste tópico ainda.</p>
                <p className="text-white/30 text-xs mt-1">Marque uma estrela nas palavras preferidas para visualizá-las aqui.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action: New special word/expression composition button */}
      {activeSubTab === 'explorar' && (
        <div className="fixed bottom-6 right-6 z-35 animate-fade-in">
          <button
            onClick={() => onTriggerNewSpecial(activeTopic)}
            id="btn-add-special-floating"
            className="p-4 bg-amber-500 text-black hover:bg-amber-400 rounded-full shadow-2xl flex items-center justify-center gap-2 duration-250 transition-all font-black text-sm active:scale-95 group border border-amber-600/20 cursor-pointer"
            title={`Adicionar novo item ao tópico ${activeTopic}`}
          >
            <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap">
              Adicionar {activeTopic === 'Expressões' ? 'Expressão' : 'Palavra'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
