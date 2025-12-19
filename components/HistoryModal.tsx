
import React from 'react';
import { HistoryItem } from '../types';
import { CopyIcon, DownloadIcon, RefreshIcon, SparklesIcon } from './Icons';

interface HistoryModalProps {
  history: HistoryItem[];
  onClose: () => void;
  onMigrateToNotebook: (content: string, title: string) => void;
  onCopy: (text: string) => void;
  onClearHistory: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  history, 
  onClose, 
  onMigrateToNotebook, 
  onCopy,
  onClearHistory
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Activity History</h2>
            <p className="text-sm text-slate-400 mt-1">Consult your past transcriptions and refinements</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={onClearHistory}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-500/30 rounded"
            >
              Clear All
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
               <RefreshIcon className="w-12 h-12 mb-4 opacity-20" />
               <p>No history found. Start transcribing to build your history.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-200">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(item.timestamp).toLocaleString()} • {item.audioName || 'Direct Recording'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onMigrateToNotebook(item.refinedText || item.translatedText || item.originalText, item.title)}
                      className="p-2 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40 transition-colors"
                      title="Send to Notebook"
                    >
                      <SparklesIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onCopy(item.originalText)}
                      className="p-2 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors"
                      title="Copy Original"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 h-32 overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Original</span>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{item.originalText}</p>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 h-32 overflow-y-auto">
                    <span className="text-[10px] font-bold text-blue-500 uppercase block mb-1">Refined / Translated</span>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">{item.refinedText || item.translatedText || "No refinement available"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
