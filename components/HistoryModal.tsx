
import React, { useState } from 'react';
import { HistorySession, HistoryRecord } from '../types';
import { 
  CopyIcon, DownloadIcon, RefreshIcon, SparklesIcon, 
  HelpCircleIcon, WandIcon, AcademicIcon, MicIcon, SpeakerIcon, HistoryIcon
} from './Icons';

interface HistoryModalProps {
  history: HistorySession[];
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
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(history.length > 0 ? [history[0].id] : []));

  const toggleSession = (id: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSessions(newExpanded);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'transcription': return <MicIcon className="w-4 h-4 text-blue-400" />;
      case 'translation': return <SpeakerIcon className="w-4 h-4 text-green-400" />;
      case 'refinement': return <WandIcon className="w-4 h-4 text-teal-400" />;
      case 'scientific': return <AcademicIcon className="w-4 h-4 text-indigo-400" />;
      case 'qa': return <HelpCircleIcon className="w-4 h-4 text-purple-400" />;
      default: return <RefreshIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Document History</h2>
            <p className="text-sm text-slate-400 mt-1">Grouped by original recordings and AI operations</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => { if(window.confirm("Clear all history?")) onClearHistory(); }}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-500/30 rounded transition-colors"
            >
              Clear All
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
               <HistoryIcon className="w-12 h-12 mb-4 opacity-20" />
               <p>Your document vector store is currently empty.</p>
            </div>
          ) : (
            history.map((session) => (
              <div key={session.id} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                {/* Session Header */}
                <button 
                  onClick={() => toggleSession(session.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center space-x-4 text-left">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <MicIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100">{session.mainTitle}</h3>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-xs text-slate-500">{new Date(session.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">{session.records.length} items</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-500">
                    <svg className={`w-5 h-5 transition-transform ${expandedSessions.has(session.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {/* Session Records (Sub-items) */}
                {expandedSessions.has(session.id) && (
                  <div className="border-t border-slate-800 bg-slate-950/50 p-2 space-y-1">
                    {session.records.map((record) => (
                      <div key={record.id} className="ml-4 p-4 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900/40 transition-all group">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start space-x-3">
                            <div className="mt-1">{getIconForType(record.type)}</div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-300">{record.title}</h4>
                              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">
                                {new Date(record.timestamp).toLocaleTimeString()} • {record.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                let content = record.content;
                                if (record.type === 'qa' && record.qa) {
                                  content = record.qa.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
                                }
                                onMigrateToNotebook(content, record.title);
                              }}
                              className="p-1.5 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40"
                              title="To Notebook"
                            >
                              <SparklesIcon className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => onCopy(record.content)}
                              className="p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700"
                              title="Copy Content"
                            >
                              <CopyIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 line-clamp-2 italic leading-relaxed">
                          {record.content.substring(0, 150)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
