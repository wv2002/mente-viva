/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HojeTab } from './components/HojeTab';
import { ExplorarTab } from './components/ExplorarTab';
import { FavoritosTab } from './components/FavoritosTab';
import { EspecialTab } from './components/EspecialTab';
import { QuoteDetailModal } from './components/QuoteDetailModal';
import { SpecialQuoteDetailModal } from './components/SpecialQuoteDetailModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { SettingsModal } from './components/SettingsModal';
import { initAuth, googleSignIn, logout, setCachedAccessToken, silentTokenRefresh } from './lib/firebaseAuth';
import { 
  getSpreadsheetData, 
  updateQuoteInSpreadsheet, 
  addCategoryColumn, 
  addQuoteToSpreadsheet,
  getSpecialSpreadsheetData,
  updateSpecialQuoteInSpreadsheet,
  addSpecialQuoteToSpreadsheet,
  addSpecialCategoryColumn
} from './lib/sheetsService';
import { Quote, SheetsMetadata, SpecialQuote, SpecialSheetsMetadata } from './types';
import { Star, ShieldAlert, CheckCircle2, Sparkles, Loader2, Plus, Info, ExternalLink } from 'lucide-react';
import { User } from 'firebase/auth';

const SPREADSHEET_ID_KEY = 'mente-viva-spreadsheet-id';
const DEFAULT_SPREADSHEET_ID = '1N5CNGICJECRdDA8nLuqwTsIDiPBtAc1pmPDaULcOzGU'; // TESTE: "Mente Viva - Claude" (cópia). Trocar pelo ID original antes de ir para produção definitiva.

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sheets data states
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [metadata, setMetadata] = useState<SheetsMetadata | null>(null);
  const [specialQuotes, setSpecialQuotes] = useState<SpecialQuote[]>([]);
  const [specialMetadata, setSpecialMetadata] = useState<SpecialSheetsMetadata | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem(SPREADSHEET_ID_KEY) || DEFAULT_SPREADSHEET_ID;
  });

  // Action states
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [activeTab, setActiveTab] = useState<'hoje' | 'explorar' | 'favoritos' | 'especial'>('hoje');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedSpecialQuote, setSelectedSpecialQuote] = useState<SpecialQuote | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'refreshed' | 'error'; message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activePool, setActivePool] = useState<Quote[]>([]);
  const [activeSpecialPool, setActiveSpecialPool] = useState<SpecialQuote[]>([]);

  // Pick random quote from currently active tab's pool
  const handlePickRandomFromPool = () => {
    if (activePool.length === 0) return;
    
    let candidates = activePool;
    if (selectedQuote) {
      if (selectedQuote.categories['Privado']) {
        candidates = activePool.filter((q) => q.categories['Privado']);
      } else if (selectedQuote.categories['Treinar']) {
        candidates = activePool.filter((q) => q.categories['Treinar']);
      } else if (activeTab === 'hoje') {
        candidates = activePool.filter((q) => !q.categories['Privado'] && !q.categories['Treinar']);
      }
    }

    const otherQuotes = candidates.filter((q) => q.id !== selectedQuote?.id);
    const finalCandidates = otherQuotes.length > 0 ? otherQuotes : candidates;
    if (finalCandidates.length === 0) return;

    const nextQuote = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    setSelectedQuote(nextQuote);
  };

  // Touch Swiping detection on mobile/tablet devices
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const minSwipeDistance = 120;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchStartY === null || touchEndX === null || touchEndY === null) return;
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;

    // Reject vertical scrolls
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    const isLeftSwipe = deltaX > minSwipeDistance;
    const isRightSwipe = deltaX < -minSwipeDistance;

    if (isLeftSwipe) {
      if (activeTab === 'hoje') {
        setActiveTab('explorar');
      } else if (activeTab === 'explorar') {
        setActiveTab('favoritos');
      }
    } else if (isRightSwipe) {
      if (activeTab === 'favoritos') {
        setActiveTab('explorar');
      } else if (activeTab === 'explorar') {
        setActiveTab('hoje');
      }
    }
  };

  // Save spreadsheet ID inside cache
  const handleUpdateSpreadsheetId = (newId: string) => {
    const cleanId = newId.trim();
    setSpreadsheetId(cleanId);
    localStorage.setItem(SPREADSHEET_ID_KEY, cleanId);
  };

  // Triggers visual notifications
  const triggerNotification = (type: 'success' | 'refreshed' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auth bootstrap on load
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      (currentUser, activeToken) => {
        setUser(currentUser);
        setToken(activeToken);
        setNeedsAuth(false);
        setIsAuthLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setIsAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch or Synchronize spreadsheet values
  const synchronizeData = async (userToken: string) => {
    if (!spreadsheetId.trim()) return;
    setIsDataLoading(true);
    try {
      const [standardData, specialData] = await Promise.all([
        getSpreadsheetData(spreadsheetId, userToken),
        getSpecialSpreadsheetData(spreadsheetId, userToken)
      ]);

      setQuotes(standardData.quotes);
      setMetadata(standardData.metadata);
      setSpecialQuotes(specialData.quotes);
      setSpecialMetadata(specialData.metadata);
      triggerNotification('refreshed', 'Sincronizado com sucesso com o Google Sheets!');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'TOKEN_EXPIRED') {
        const refreshedToken = await silentTokenRefresh();
        if (refreshedToken) {
          setToken(refreshedToken);
          // synchronizeData will be re-triggered by the token change (see useEffect below)
        } else {
          handleLogout();
          triggerNotification('error', 'Sua conexão com o Google expirou. Conecte-se novamente.');
        }
      } else {
        triggerNotification('error', `Falha ao carregar dados: ${err.message || err}`);
      }
    } finally {
      setIsDataLoading(false);
    }
  };

  // Watch token and update values
  useEffect(() => {
    if (token) {
      synchronizeData(token);
    }
  }, [token, spreadsheetId]);

  // Sign In Trigger Button Handle
  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      triggerNotification('error', `Falha ao conectar com o Google: ${err.message || err}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Sign Out trigger
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setQuotes([]);
      setMetadata(null);
      setSpecialQuotes([]);
      setSpecialMetadata(null);
      setNeedsAuth(true);
      setActiveTab('hoje');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Quick favorite card state toggle
  const handleToggleFavorite = async (quote: Quote) => {
    if (!token || !metadata) return;

    // Fast local optimistic update
    const isCurrentlyFav = quote.categories['Favorito'] || false;
    const toggledCategories = {
      ...quote.categories,
      Favorito: !isCurrentlyFav,
    };

    const updatedQuote: Quote = {
      ...quote,
      categories: toggledCategories,
    };

    // Update state locally first for instant click responsive feel
    setQuotes((prev) => prev.map((q) => (q.id === quote.id ? updatedQuote : q)));
    if (selectedQuote?.id === quote.id) {
      setSelectedQuote(updatedQuote);
    }

    try {
      await updateQuoteInSpreadsheet(spreadsheetId, metadata, updatedQuote, token);
      triggerNotification(
        'success',
        isCurrentlyFav
          ? `Frase #${quote.id} removida dos Favoritos`
          : `Frase #${quote.id} adicionada aos Favoritos!`
      );
    } catch (err: any) {
      console.error(err);
      // Revert upon Sheets failure
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? quote : q)));
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote(quote);
      }
      triggerNotification('error', `Falha ao gravar favorito no Sheets: ${err.message}`);
    }
  };

  // Save edits of Quote details (from modal)
  const handleSaveQuoteDetail = async (updatedQuote: Quote) => {
    if (!token || !metadata) return;

    setIsWriting(true);
    try {
      if (updatedQuote.id === 0) {
        // Adding a NEW Quote
        const nextId = Math.max(...quotes.map((q) => q.id), 0) + 1;
        const savedQuote = await addQuoteToSpreadsheet(spreadsheetId, metadata, updatedQuote, nextId, token);
        
        setQuotes((prev) => [...prev, savedQuote]);
        setSelectedQuote(null); // close modal
        triggerNotification('success', `Nova frase #${savedQuote.id} criada com sucesso no Sheets!`);
      } else {
        // Editing an EXISTING Quote
        await updateQuoteInSpreadsheet(spreadsheetId, metadata, updatedQuote, token);
        setQuotes((prev) => prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)));
        setSelectedQuote(updatedQuote); // update modal visualization state
        triggerNotification('success', `Alterações na frase #${updatedQuote.id} salvas com sucesso!`);
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification('error', `Falha ao gravar no Sheets: ${err.message}`);
    } finally {
      setIsWriting(false);
    }
  };

  // Push new category column
  const handleAddNewCategory = async (categoryName: string) => {
    if (!token || !metadata) return;

    setIsWriting(true);
    const cleanName = categoryName.trim();
    try {
      // 1. Insert column on sheet & rewrite metadata structure
      const updatedMetadata = await addCategoryColumn(spreadsheetId, metadata, cleanName, token);
      
      // 2. Adjust local list of quotes to set this new category toggle to false/default
      setQuotes((prev) =>
        prev.map((q) => ({
          ...q,
          categories: {
            ...q.categories,
            [cleanName]: false,
          },
        }))
      );
      if (selectedQuote) {
        setSelectedQuote((prev) =>
          prev
            ? {
                ...prev,
                categories: {
                  ...prev.categories,
                  [cleanName]: false,
                },
              }
            : null
        );
      }

      setMetadata(updatedMetadata);
      triggerNotification('success', `Categoria "${cleanName}" adicionada no Google Sheets!`);
    } catch (err: any) {
      console.error(err);
      triggerNotification('error', `Falha ao criar nova categoria: ${err.message}`);
      throw err;
    } finally {
      setIsWriting(false);
    }
  };

  // Trigger empty Quote composition modal
  const handleTriggerNewQuote = () => {
    const emptyQuote: Quote = {
      id: 0,
      rowIdx: 0,
      frase: '',
      categories: metadata
        ? metadata.categories.reduce((acc, cat) => {
            acc[cat] = false;
            return acc;
          }, {} as { [key: string]: boolean })
        : {},
      tipo: 'Frase',
      imagem: '',
      notas: '',
    };
    setSelectedQuote(emptyQuote);
  };

  const handleOpenQuote = (quote: Quote, customPool?: Quote[]) => {
    if (customPool) {
      setActivePool(customPool);
    }
    setSelectedQuote(quote);
  };

  const handleOpenSpecialQuote = (quote: SpecialQuote, customPool?: SpecialQuote[]) => {
    if (customPool) {
      setActiveSpecialPool(customPool);
    }
    setSelectedSpecialQuote(quote);
  };

  const handlePrevQuote = () => {
    if (!selectedQuote || activePool.length <= 1) return;
    const index = activePool.findIndex((q) => q.id === selectedQuote.id);
    if (index !== -1) {
      const prevIndex = (index - 1 + activePool.length) % activePool.length;
      setSelectedQuote(activePool[prevIndex]);
    }
  };

  const handleNextQuote = () => {
    if (!selectedQuote || activePool.length <= 1) return;
    const index = activePool.findIndex((q) => q.id === selectedQuote.id);
    if (index !== -1) {
      const nextIndex = (index + 1) % activePool.length;
      setSelectedQuote(activePool[nextIndex]);
    }
  };

  const handlePrevSpecialQuote = () => {
    if (!selectedSpecialQuote || activeSpecialPool.length <= 1) return;
    const index = activeSpecialPool.findIndex((q) => q.id === selectedSpecialQuote.id);
    if (index !== -1) {
      const prevIndex = (index - 1 + activeSpecialPool.length) % activeSpecialPool.length;
      setSelectedSpecialQuote(activeSpecialPool[prevIndex]);
    }
  };

  const handleNextSpecialQuote = () => {
    if (!selectedSpecialQuote || activeSpecialPool.length <= 1) return;
    const index = activeSpecialPool.findIndex((q) => q.id === selectedSpecialQuote.id);
    if (index !== -1) {
      const nextIndex = (index + 1) % activeSpecialPool.length;
      setSelectedSpecialQuote(activeSpecialPool[nextIndex]);
    }
  };

  // Special section handlers
  const handleToggleSpecialFavorite = async (quote: SpecialQuote) => {
    if (!token || !specialMetadata) return;

    const isCurrentlyFav = quote.categories['Favorito'] || quote.categories['Favoritos'] || false;
    const toggledCategories = {
      ...quote.categories,
      Favorito: !isCurrentlyFav,
    };

    const updatedSpecialQuote: SpecialQuote = {
      ...quote,
      categories: toggledCategories,
    };

    setSpecialQuotes((prev) => prev.map((q) => (q.id === quote.id ? updatedSpecialQuote : q)));
    if (selectedSpecialQuote?.id === quote.id) {
      setSelectedSpecialQuote(updatedSpecialQuote);
    }

    try {
      await updateSpecialQuoteInSpreadsheet(spreadsheetId, specialMetadata, updatedSpecialQuote, token);
      triggerNotification(
        'success',
        isCurrentlyFav
          ? `Removido dos favoritos especial!`
          : `Adicionado aos favoritos especial!`
      );
    } catch (err: any) {
      console.error(err);
      // revert local update
      setSpecialQuotes((prev) => prev.map((q) => (q.id === quote.id ? quote : q)));
      if (selectedSpecialQuote?.id === quote.id) {
        setSelectedSpecialQuote(quote);
      }
      triggerNotification('error', `Falha ao gravar favorito especial: ${err.message}`);
    }
  };

  const handleSaveSpecialQuoteDetail = async (updatedSpecialQuote: SpecialQuote) => {
    if (!token || !specialMetadata) return;

    setIsWriting(true);
    try {
      if (updatedSpecialQuote.id === 0) {
        const nextId = Math.max(...specialQuotes.map((q) => q.id), 0) + 1;
        const savedSpecialQuote = await addSpecialQuoteToSpreadsheet(
          spreadsheetId,
          specialMetadata,
          updatedSpecialQuote,
          nextId,
          token
        );
        setSpecialQuotes((prev) => [...prev, savedSpecialQuote]);
        setSelectedSpecialQuote(null);
        triggerNotification('success', `Item #${savedSpecialQuote.id} criado com sucesso no Sheets Especial!`);
      } else {
        await updateSpecialQuoteInSpreadsheet(spreadsheetId, specialMetadata, updatedSpecialQuote, token);
        setSpecialQuotes((prev) => prev.map((q) => (q.id === updatedSpecialQuote.id ? updatedSpecialQuote : q)));
        setSelectedSpecialQuote(updatedSpecialQuote);
        triggerNotification('success', `Item #${updatedSpecialQuote.id} atualizado no Sheets Especial!`);
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification('error', `Falha ao gravar item especial: ${err.message}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleAddNewSpecialCategory = async (categoryName: string) => {
    if (!token || !specialMetadata) return;

    setIsWriting(true);
    const cleanName = categoryName.trim();
    try {
      const updatedSpecialMetadata = await addSpecialCategoryColumn(spreadsheetId, specialMetadata, cleanName, token);
      setSpecialQuotes((prev) =>
        prev.map((q) => ({
          ...q,
          categories: {
            ...q.categories,
            [cleanName]: false,
          },
        }))
      );
      if (selectedSpecialQuote) {
        setSelectedSpecialQuote((prev) =>
          prev
            ? {
                ...prev,
                categories: {
                  ...prev.categories,
                  [cleanName]: false,
                },
              }
            : null
        );
      }
      setSpecialMetadata(updatedSpecialMetadata);
      triggerNotification('success', `Categoria "${cleanName}" adicionada no Sheets Especial!`);
    } catch (err: any) {
      console.error(err);
      triggerNotification('error', `Falha ao adicionar categoria especial: ${err.message}`);
      throw err;
    } finally {
      setIsWriting(false);
    }
  };

  const handleTriggerNewSpecial = (topic: string) => {
    const emptySpecialQuote: SpecialQuote = {
      id: 0,
      rowIdx: 0,
      frase: '',
      topico: topic,
      categories: specialMetadata
        ? specialMetadata.categories.reduce((acc, cat) => {
            acc[cat] = false;
            return acc;
          }, {} as { [key: string]: boolean })
        : {},
      tipo: 'Frase',
      imagem: '',
      notas: '',
    };
    setSelectedSpecialQuote(emptySpecialQuote);
  };

  return (
    <div id="mente-viva-app" className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 text-gray-100 flex flex-col font-sans transition-all selection:bg-white selection:text-black">
      
      {/* Visual Header Notifications */}
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50">
          <div className={`shadow-2xl rounded-full px-5 py-3 flex items-center gap-2 border text-xs font-semibold backdrop-blur-xl ${
            notification.type === 'error'
              ? 'bg-rose-955/80 text-rose-300 border-rose-500/20'
              : 'bg-black/60 text-white border-white/10'
          }`}>
            {notification.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* ================= AUTH SHELL WALL ================= */}
      {needsAuth ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="bg-[#ffffff]/5 border border-[#ffffff]/10 backdrop-blur-xl rounded-3xl p-8 md:p-10 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 bg-white/5 border border-[#ffffff]/10 rounded-2xl flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-white to-neutral-200 bg-clip-text text-transparent pt-2">
                MENTE VIVA
              </h1>
              <p className="text-white/50 text-xs max-w-sm mx-auto font-light leading-relaxed pt-3">
                Acesse seu estudo diário e catálogo de citações integrados diretamente à sua planilha do Google Sheets.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <GoogleSignInButton onClick={handleLogin} isLoading={isAuthLoading} />

              <div className="text-[10px] text-white/30 max-w-xs mx-auto leading-relaxed font-mono">
                Utilizamos o Firebase para autenticação segura. Suas frases e categorias são lidas em tempo real da sua própria conta do Sheets.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= AUTHENTICATED SYSTEM CONTENT ================= */
        <div className="flex flex-col flex-grow">
          {/* Top Navbar */}
          <Navbar
            currentTab={activeTab}
            setTab={setActiveTab}
            onRefresh={() => synchronizeData(token!)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isLoading={isDataLoading}
          />

          {/* Core Contents */}
          <main 
            className="flex-grow py-6 sm:py-10"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isDataLoading && quotes.length === 0 ? (
              /* Initial full loading overlay */
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-white/35" />
                <p className="text-sm text-white/40 font-mono">Conectando ao Sheets e estruturando frases...</p>
              </div>
            ) : (
              /* Switched active Tab panels */
              <div className="relative">
                {activeTab === 'hoje' && (
                  <HojeTab
                    quotes={quotes}
                    onOpenQuote={handleOpenQuote}
                    onToggleFavorite={handleToggleFavorite}
                    isFavoriteLoading={isWriting}
                    onUpdatePool={setActivePool}
                  />
                )}

                {activeTab === 'explorar' && (
                  <ExplorarTab
                    quotes={quotes}
                    metadata={metadata}
                    onOpenQuote={handleOpenQuote}
                    onToggleFavorite={handleToggleFavorite}
                    isFavoriteLoading={isWriting}
                    onUpdatePool={setActivePool}
                  />
                )}

                {activeTab === 'favoritos' && (
                  <FavoritosTab
                    quotes={quotes}
                    onOpenQuote={handleOpenQuote}
                    onToggleFavorite={handleToggleFavorite}
                    isFavoriteLoading={isWriting}
                    onUpdatePool={setActivePool}
                  />
                )}

                {activeTab === 'especial' && (
                  <EspecialTab
                    specialQuotes={specialQuotes}
                    metadata={specialMetadata}
                    onOpenQuote={handleOpenSpecialQuote}
                    onToggleFavorite={handleToggleSpecialFavorite}
                    isFavoriteLoading={isWriting}
                    onTriggerNewSpecial={handleTriggerNewSpecial}
                    onUpdatePool={setActiveSpecialPool}
                  />
                )}
              </div>
            )}
          </main>

          {/* Bottom Floating Action: Nova Frase compositor (Shown inside Explorar to keep screens uncluttered) */}
          {!isDataLoading && quotes.length > 0 && activeTab === 'explorar' && (
            <div className="fixed bottom-6 right-6 z-35">
              <button
                onClick={handleTriggerNewQuote}
                id="btn-add-quote-floating"
                className="p-4 bg-white text-black hover:bg-neutral-100 rounded-full shadow-2xl flex items-center justify-center gap-2 duration-250 transition-all font-bold text-sm active:scale-95 group border border-white/10"
                title="Adicionar nova frase à planilha"
              >
                <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap">
                  Nova Frase
                </span>
              </button>
            </div>
          )}

          {/* ================= DETAIL MODULE MODAL OVERLAY ================= */}
          <QuoteDetailModal
            quote={selectedQuote}
            onClose={() => setSelectedQuote(null)}
            metadata={metadata}
            onSaveQuote={handleSaveQuoteDetail}
            onAddNewCategory={handleAddNewCategory}
            isProcessing={isWriting}
            onPickRandom={handlePickRandomFromPool}
            onPrevQuote={handlePrevQuote}
            onNextQuote={handleNextQuote}
            currentTab={activeTab}
          />

          {/* ================= SPECIAL DETAIL MODULE MODAL OVERLAY ================= */}
          <SpecialQuoteDetailModal
            quote={selectedSpecialQuote}
            onClose={() => setSelectedSpecialQuote(null)}
            metadata={specialMetadata}
            onSaveQuote={handleSaveSpecialQuoteDetail}
            onAddNewCategory={handleAddNewSpecialCategory}
            isProcessing={isWriting}
            onPrevQuote={handlePrevSpecialQuote}
            onNextQuote={handleNextSpecialQuote}
            currentTab={activeTab}
            onPickRandom={
              selectedSpecialQuote
                ? () => {
                    const matched = specialQuotes.filter(
                      (q) => q.topico.toLowerCase() === selectedSpecialQuote.topico.toLowerCase()
                    );
                    if (matched.length > 1) {
                      const candidates = matched.filter((q) => q.id !== selectedSpecialQuote.id);
                      const nextQuote = candidates[Math.floor(Math.random() * candidates.length)];
                      setSelectedSpecialQuote(nextQuote);
                    }
                  }
                : undefined
            }
          />

          {/* ================= CONFIGURAÇÕES OVERLAY MODAL ================= */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            spreadsheetId={spreadsheetId}
            setSpreadsheetId={handleUpdateSpreadsheetId}
            onLogout={handleLogout}
            onRefresh={() => synchronizeData(token!)}
            userEmail={user?.email}
          />
        </div>
      )}
    </div>
  );
}
