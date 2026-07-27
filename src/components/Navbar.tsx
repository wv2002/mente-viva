import React from 'react';
import { RefreshCw, Settings } from 'lucide-react';

interface NavbarProps {
  currentTab: 'hoje' | 'explorar' | 'favoritos' | 'especial';
  setTab: (tab: 'hoje' | 'explorar' | 'favoritos' | 'especial') => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  isLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setTab,
  onRefresh,
  onOpenSettings,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-md border-b border-white/15 px-6 py-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand/System Name with bright gradient */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tighter bg-gradient-to-br from-white to-neutral-200 bg-clip-text text-transparent">
              MENTE VIVA
            </h1>
          </div>
        </div>

        {/* Tab Switching Menu with Separated "Especial" Framed Button */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          <div className="flex items-center space-x-1.5 bg-white/5 border border-white/15 rounded-full p-1 shadow-inner">
            <button
              id="tab-hoje"
              onClick={() => setTab('hoje')}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                currentTab === 'hoje'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              id="tab-explorar"
              onClick={() => setTab('explorar')}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                currentTab === 'explorar'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Explorar
            </button>
            <button
              id="tab-favoritos"
              onClick={() => setTab('favoritos')}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                currentTab === 'favoritos'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Favoritos
            </button>
          </div>

          {/* Visual Divider line */}
          <div className="h-6 w-px bg-white/15 hidden sm:block"></div>

          {/* Separate "Moldura" (special distinct container) for Especial tab */}
          <div className="p-0.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full transition-all duration-300 shadow-inner">
            <button
              id="tab-especial"
              onClick={() => setTab('especial')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                currentTab === 'especial'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Especial
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            id="btn-refresh"
            className="p-2 text-white/70 hover:text-white bg-white/5 border border-white/15 rounded-xl duration-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Sincronizar com o Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-white' : ''}`} />
          </button>

          <button
            onClick={onOpenSettings}
            id="btn-settings"
            className="p-2 text-white/70 hover:text-white bg-white/5 border border-white/15 rounded-xl duration-200 transition-colors cursor-pointer"
            title="Configurações e Planilha"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
