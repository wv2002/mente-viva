import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, User, LogOut, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
  userEmail?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  setSpreadsheetId,
  onLogout,
  onRefresh,
  userEmail,
}) => {
  const [localId, setLocalId] = useState(spreadsheetId);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSpreadsheetId(localId);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onRefresh();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xl cursor-pointer"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative bg-[#121214]/80 backdrop-blur-3xl border-2 border-white/15 rounded-3xl w-full max-w-md overflow-hidden z-10 text-left shadow-2xl flex flex-col p-6 space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Configurações</h2>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white hover:bg-white/10 duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form items */}
          <div className="space-y-5">
            {/* Spreadsheet Section */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-semibold">
                <Database className="w-3.5 h-3.5 text-white/50" />
                Planilha no Google Sheets
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  placeholder="ID da planilha..."
                  className="flex-grow bg-black/40 text-white text-xs p-3 rounded-xl border border-white/15 focus:outline-none focus:border-white/20 font-mono"
                />
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-white text-black hover:bg-neutral-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0"
                >
                  {saved ? <Check className="w-3.5 h-3.5" /> : 'Salvar'}
                </button>
              </div>
              <p className="text-[10px] text-white/40 leading-normal">
                Insira o ID da planilha onde as frases e categorias estão salvas. Ele é salvo no seu dispositivo.
              </p>
            </div>

            {/* Account Info Section */}
            {userEmail && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <label className="text-xs font-mono uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-semibold">
                  <User className="w-3.5 h-3.5 text-white/50" />
                  Conta Conectada
                </label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-xs text-white font-semibold truncate">{userEmail}</p>
                    <p className="text-[9px] text-white/40 font-mono mt-0.5">Firebase Google Auth</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 bg-white/5 border border-white/10 rounded-xl duration-200 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Trocar Conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
