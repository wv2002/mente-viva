import React, { useState, useEffect } from 'react';
import { QuoteCard } from './QuoteCard';
import { Quote } from '../types';
import { EyeOff, Settings, RefreshCw, KeyRound, Sparkles, Zap } from 'lucide-react';

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

// Fisher-Yates shuffle utilizing the deterministic generator
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

interface HojeTabProps {
  quotes: Quote[];
  onOpenQuote: (quote: Quote, pool?: Quote[]) => void;
  onToggleFavorite: (quote: Quote) => void;
  isFavoriteLoading: boolean;
  onUpdatePool?: (pool: Quote[]) => void;
}

export const HojeTab: React.FC<HojeTabProps> = ({
  quotes,
  onOpenQuote,
  onToggleFavorite,
  isFavoriteLoading,
  onUpdatePool,
}) => {
  const [dailyQuotes, setDailyQuotes] = useState<Quote[]>([]);
  const [dailySecretQuotes, setDailySecretQuotes] = useState<Quote[]>([]);
  const [dailyTreinarQuotes, setDailyTreinarQuotes] = useState<Quote[]>([]);

  const [showSecretMode, setShowSecretMode] = useState(false);
  const [showTreinarMode, setShowTreinarMode] = useState(false);

  const [secretCount, setSecretCount] = useState<number>(() => {
    const saved = localStorage.getItem('mente-viva-secret-count');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) return parsed;
    }
    return 3; // Default
  });

  const [treinarCount, setTreinarCount] = useState<number>(() => {
    const saved = localStorage.getItem('mente-viva-treinar-count');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) return parsed;
    }
    return 3; // Default
  });

  // Synchronize active pool back to App
  useEffect(() => {
    onUpdatePool?.([...dailyQuotes, ...dailySecretQuotes, ...dailyTreinarQuotes]);
  }, [dailyQuotes, dailySecretQuotes, dailyTreinarQuotes, onUpdatePool]);

  // Get current date string e.g. YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Human friendly Brazilian portuguese date
  const getFriendlyDate = () => {
    const d = new Date();
    const weekdays = [
      'DOMINGO',
      'SEGUNDA-FEIRA',
      'TERÇA-FEIRA',
      'QUARTA-FEIRA',
      'QUINTA-FEIRA',
      'SEXTA-FEIRA',
      'SÁBADO',
    ];
    const months = [
      'de Janeiro',
      'de Fevereiro',
      'de Março',
      'de Abril',
      'de Maio',
      'de Junho',
      'de Julho',
      'de Agosto',
      'de Setembro',
      'de Outubro',
      'de Novembro',
      'de Dezembro',
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} DE ${months[d.getMonth()].toUpperCase()}`;
  };

  // Draw or restore daily 5 quotes and daily secrets
  useEffect(() => {
    if (quotes.length === 0) return;

    const todayStr = getTodayStr();
    const savedSeedJson = localStorage.getItem('mente-viva-daily-seed');
    let seedData: { date: string; standardIds: number[]; secretIds: number[]; treinarIds?: number[] } | null = null;
    
    if (savedSeedJson) {
      try {
        seedData = JSON.parse(savedSeedJson);
      } catch (e) {
        seedData = null;
      }
    }

    // Standard quotes (where Privado and Treinar are false)
    const publicQuotes = quotes.filter((q) => !q.categories['Privado'] && !q.categories['Treinar']);
    // Secret quotes (where Privado is true)
    const privateQuotes = quotes.filter((q) => q.categories['Privado']);
    // Treinar quotes (where Treinar is true)
    const treinarQuotes = quotes.filter((q) => q.categories['Treinar']);

    if (
      seedData &&
      seedData.date === todayStr &&
      seedData.standardIds.length > 0 &&
      seedData.standardIds.every((id) => quotes.some((q) => q.id === id))
    ) {
      // Map stored IDs back to active quote objects
      const restoredStandards = seedData.standardIds
        .map((id) => quotes.find((q) => q.id === id))
        .filter(Boolean) as Quote[];
      
      const restoredSecrets = seedData.secretIds
        .map((id) => quotes.find((q) => q.id === id))
        .filter(Boolean) as Quote[];

      const restoredTreinar = (seedData.treinarIds || [])
        .map((id) => quotes.find((q) => q.id === id))
        .filter(Boolean) as Quote[];

      setDailyQuotes(restoredStandards);
      setDailySecretQuotes(restoredSecrets);
      setDailyTreinarQuotes(restoredTreinar);

      // Self-heal key if missing in previous seed data format
      if (!seedData.treinarIds) {
        const sortedTreinar = [...treinarQuotes].sort((a, b) => a.id - b.id);
        const rngTrn = seedRandom(todayStr + '-trn');
        const shuffledTreinar = deterministicShuffle(sortedTreinar, rngTrn);
        const selectedTreinar = shuffledTreinar.slice(0, treinarCount);
        setDailyTreinarQuotes(selectedTreinar);

        seedData.treinarIds = selectedTreinar.map((q) => q.id);
        localStorage.setItem('mente-viva-daily-seed', JSON.stringify(seedData));
      }
    } else {
      // Create new stable seeds for the day
      // 1. Draw 5 random standard quotes using stable deterministic PRNG
      const sortedPublic = [...publicQuotes].sort((a, b) => a.id - b.id);
      const rngStd = seedRandom(todayStr + '-std');
      const shuffledStandards = deterministicShuffle(sortedPublic, rngStd);
      const selectedStandards = shuffledStandards.slice(0, 5);

      // 2. Draw secretCount random secret quotes using stable deterministic PRNG
      const sortedPrivate = [...privateQuotes].sort((a, b) => a.id - b.id);
      const rngSec = seedRandom(todayStr + '-sec');
      const shuffledSecrets = deterministicShuffle(sortedPrivate, rngSec);
      const selectedSecrets = shuffledSecrets.slice(0, secretCount);

      // 3. Draw treinarCount random treinar quotes using stable PRNG
      const sortedTreinar = [...treinarQuotes].sort((a, b) => a.id - b.id);
      const rngTrn = seedRandom(todayStr + '-trn');
      const shuffledTreinar = deterministicShuffle(sortedTreinar, rngTrn);
      const selectedTreinar = shuffledTreinar.slice(0, treinarCount);

      setDailyQuotes(selectedStandards);
      setDailySecretQuotes(selectedSecrets);
      setDailyTreinarQuotes(selectedTreinar);

      // Save to localStorage
      const newSeed = {
        date: todayStr,
        standardIds: selectedStandards.map((q) => q.id),
        secretIds: selectedSecrets.map((q) => q.id),
        treinarIds: selectedTreinar.map((q) => q.id),
      };
      localStorage.setItem('mente-viva-daily-seed', JSON.stringify(newSeed));
    }
  }, [quotes]);

  // Adjust secrets when user changes the target Count settings
  const handleSecretCountChange = (newVal: number) => {
    if (isNaN(newVal) || newVal < 1) newVal = 1;
    if (newVal > 10) newVal = 10;
    
    setSecretCount(newVal);
    localStorage.setItem('mente-viva-secret-count', String(newVal));

    if (quotes.length === 0) return;
    const privateQuotes = quotes.filter((q) => q.categories['Privado']);
    
    const sortedPrivate = [...privateQuotes].sort((a, b) => a.id - b.id);
    const todayStr = getTodayStr();
    const rngSec = seedRandom(todayStr + '-sec');
    const shuffledSecrets = deterministicShuffle(sortedPrivate, rngSec);
    const selectedSecrets = shuffledSecrets.slice(0, newVal);
    setDailySecretQuotes(selectedSecrets);

    const savedSeedJson = localStorage.getItem('mente-viva-daily-seed');
    if (savedSeedJson) {
      try {
        const seedData = JSON.parse(savedSeedJson);
        seedData.secretIds = selectedSecrets.map((q) => q.id);
        localStorage.setItem('mente-viva-daily-seed', JSON.stringify(seedData));
      } catch (e) {
        // ignore
      }
    }
  };

  // Adjust Treinar session when user changes target count
  const handleTreinarCountChange = (newVal: number) => {
    if (isNaN(newVal) || newVal < 1) newVal = 1;
    if (newVal > 10) newVal = 10;

    setTreinarCount(newVal);
    localStorage.setItem('mente-viva-treinar-count', String(newVal));

    if (quotes.length === 0) return;
    const treinarQuotes = quotes.filter((q) => q.categories['Treinar']);

    const sortedTreinar = [...treinarQuotes].sort((a, b) => a.id - b.id);
    const todayStr = getTodayStr();
    const rngTrn = seedRandom(todayStr + '-trn');
    const shuffledTreinar = deterministicShuffle(sortedTreinar, rngTrn);
    const selectedTreinar = shuffledTreinar.slice(0, newVal);
    setDailyTreinarQuotes(selectedTreinar);

    const savedSeedJson = localStorage.getItem('mente-viva-daily-seed');
    if (savedSeedJson) {
      try {
        const seedData = JSON.parse(savedSeedJson);
        seedData.treinarIds = selectedTreinar.map((q) => q.id);
        localStorage.setItem('mente-viva-daily-seed', JSON.stringify(seedData));
      } catch (e) {
        // ignore
      }
    }
  };

  // Re-roll today's selection (if user manually triggers it)
  const handleReRollDaily = () => {
    const todayStr = getTodayStr();
    const publicQuotes = quotes.filter((q) => !q.categories['Privado'] && !q.categories['Treinar']);
    const privateQuotes = quotes.filter((q) => q.categories['Privado']);
    const treinarQuotes = quotes.filter((q) => q.categories['Treinar']);

    const shuffledStandards = [...publicQuotes].sort(() => 0.5 - Math.random());
    const selectedStandards = shuffledStandards.slice(0, 5);

    const shuffledSecrets = [...privateQuotes].sort(() => 0.5 - Math.random());
    const selectedSecrets = shuffledSecrets.slice(0, secretCount);

    const shuffledTreinar = [...treinarQuotes].sort(() => 0.5 - Math.random());
    const selectedTreinar = shuffledTreinar.slice(0, treinarCount);

    setDailyQuotes(selectedStandards);
    setDailySecretQuotes(selectedSecrets);
    setDailyTreinarQuotes(selectedTreinar);

    const newSeed = {
      date: todayStr,
      standardIds: selectedStandards.map((q) => q.id),
      secretIds: selectedSecrets.map((q) => q.id),
      treinarIds: selectedTreinar.map((q) => q.id),
    };
    localStorage.setItem('mente-viva-daily-seed', JSON.stringify(newSeed));
  };

  return (
    <div className="space-y-12 pb-16 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Date and Core Headings block */}
      <div className="text-center pt-8 space-y-2">
        <span className="text-[11px] md:text-xs font-mono tracking-[0.25em] text-white/40 font-semibold uppercase">
          {getFriendlyDate()}
        </span>
        <h2 className="text-3xl md:text-[38px] font-bold tracking-tighter bg-gradient-to-br from-white to-neutral-200 bg-clip-text text-transparent pt-0.5">
          ESTUDO DO DIA
        </h2>
        <div className="flex items-center justify-center gap-2.5 pt-1 text-white/40 text-xs md:text-sm">
          <span>5 frases aleatórias selecionadas para hoje.</span>
        </div>
      </div>

      {/* Main Study Deck Cards */}
      <div className="space-y-6">
        {dailyQuotes.length > 0 ? (
          dailyQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onOpen={(q) => onOpenQuote(q, dailyQuotes)}
              onToggleFavorite={onToggleFavorite}
              isFavoriteLoading={isFavoriteLoading}
            />
          ))
        ) : (
          <div className="text-center py-16 border border-dashed border-white/15 rounded-2xl bg-white/5">
            <p className="text-white/40 text-sm">Carregando as frases selecionadas de hoje...</p>
          </div>
        )}
      </div>

      {/* Deep bottom separator for hidden area */}
      <div className="border-t border-white/10 pt-10" />

      {/* Discreet Secrets Block at the bottom of the page */}
      <div className="flex flex-col items-center justify-center space-y-4 pt-2">
        
        {/* Treinar Mode Section */}
        {showTreinarMode && (
          <div className="w-full space-y-6 mb-8 text-left">
            <div className="bg-white/5 border border-white/15 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 text-amber-400 font-semibold">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold leading-none">
                    Sessão_Treinar ({dailyTreinarQuotes.length})
                  </h3>
                  <p className="text-[10px] text-white/40 leading-normal mt-1">
                    Estudo secreto diário da categoria Treinar. Altere a quantidade abaixo para redimensionar.
                  </p>
                </div>
              </div>

              {/* Treinar quantity controller box */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-[11px] text-white/40 font-mono">Exibir:</span>
                <input
                  type="number"
                  id="input-treinar-count"
                  min={1}
                  max={10}
                  value={treinarCount}
                  onChange={(e) => handleTreinarCountChange(parseInt(e.target.value, 10))}
                  className="bg-black/60 text-white font-mono font-semibold text-xs p-1.5 w-12 rounded-xl text-center border border-white/15 focus:outline-none focus:border-white/20"
                  title="Número de frases de treino diárias (padrão 3, limite 10)"
                />
                <button
                  onClick={() => setShowTreinarMode(false)}
                  className="text-[10px] text-white/60 hover:text-white px-2.5 py-1.5 bg-white/5 border border-white/15 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Ocultar
                </button>
              </div>
            </div>

            {/* Daily Treinar Cards pool */}
            <div className="space-y-6 mt-4">
              {dailyTreinarQuotes.length > 0 ? (
                dailyTreinarQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    onOpen={(q) => onOpenQuote(q, dailyTreinarQuotes)}
                    onToggleFavorite={onToggleFavorite}
                    isFavoriteLoading={isFavoriteLoading}
                  />
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                  <p className="text-white/40 text-xs font-mono">Nenhuma citação cadastrada como "Treinar".</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privado Mode Section */}
        {showSecretMode && (
          <div className="w-full space-y-6 mb-8 text-left">
            <div className="bg-white/5 border border-white/15 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 text-white/60 font-semibold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold leading-none">
                    Sessão_Privada ({dailySecretQuotes.length})
                  </h3>
                  <p className="text-[10px] text-white/40 leading-normal mt-1">
                    Estudo secreto diário. Altere a quantidade abaixo para redimensionar.
                  </p>
                </div>
              </div>

              {/* Secret quantity controller box */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-[11px] text-white/40 font-mono">Exibir:</span>
                <input
                  type="number"
                  id="input-secret-count"
                  min={1}
                  max={10}
                  value={secretCount}
                  onChange={(e) => handleSecretCountChange(parseInt(e.target.value, 10))}
                  className="bg-black/60 text-white font-mono font-semibold text-xs p-1.5 w-12 rounded-xl text-center border border-white/15 focus:outline-none focus:border-white/20"
                  title="Número de frases secretas diárias (padrão 3, limite 10)"
                />
                <button
                  onClick={() => setShowSecretMode(false)}
                  className="text-[10px] text-white/60 hover:text-white px-2.5 py-1.5 bg-white/5 border border-white/15 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Ocultar
                </button>
              </div>
            </div>

            {/* Daily Secret Cards pool */}
            <div className="space-y-6 mt-4">
              {dailySecretQuotes.length > 0 ? (
                dailySecretQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    onOpen={(q) => onOpenQuote(q, dailySecretQuotes)}
                    onToggleFavorite={onToggleFavorite}
                    isFavoriteLoading={isFavoriteLoading}
                  />
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                  <p className="text-white/40 text-xs font-mono">Nenhuma citação cadastrada como "Privado".</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buttons Launcher alignment */}
        <div className="flex flex-col items-center gap-4 py-4">
          {!showTreinarMode && (
            <button
              onClick={() => setShowTreinarMode(true)}
              id="btn-trigger-treinar"
              className="p-1.5 text-neutral-800 hover:text-amber-500 transition-colors cursor-default outline-none flex items-center justify-center bg-transparent border-0"
              title="⚡"
            >
              <Zap className="w-4 h-4 fill-transparent hover:fill-amber-500/10" />
            </button>
          )}

          {!showSecretMode && (
            <button
              onClick={() => setShowSecretMode(true)}
              id="btn-trigger-secret"
              className="w-2 h-2 rounded-full bg-neutral-800 hover:bg-neutral-600 transition-colors cursor-default outline-none flex items-center justify-center p-0 border-0"
              title="•"
            />
          )}
        </div>

      </div>
    </div>
  );
};
