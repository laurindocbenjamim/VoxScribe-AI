
import React, { useState } from 'react';
import { HistorySession, HistoryRecord } from '../types';
import { 
  CopyIcon, RefreshIcon, SparklesIcon, 
  HelpCircleIcon, WandIcon, AcademicIcon, MicIcon, SpeakerIcon, HistoryIcon 
} from './Icons';

interface HistoryModalProps {
  history: HistorySession[];
  onClose: () => void;
  onMigrateToNotebook: (content: string, title: string) => void;
  onCopy: (text: string) => void;
  onClearHistory: () => void;
  onSelectRecord: (session: HistorySession, record: HistoryRecord) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  history, 
  onClose, 
  onMigrateToNotebook, 
  onCopy,
  onClearHistory,
  onSelectRecord
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(history.length > 0 ? history[0].id : null);

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

  const activeSession = history.find(s => s.id === activeSessionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl h-[80vh] flex flex-col border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900 shrink-0">
          <div className="flex items-center space-x-3">
             <HistoryIcon className="w-6 h-6 text-blue-400" />
             <h2 className="text-2xl font-bold text-white">Archives</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => { if(window.confirm("Delete all history?")) onClearHistory(); }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Reset Archives
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content Split */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar Menu: Sessions */}
          <div className="w-72 border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
            {history.length === 0 ? (
               <div className="p-8 text-center text-slate-600 text-sm italic">No records found.</div>
            ) : (
              history.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`w-full text-left p-5 border-b border-slate-800 transition-all ${activeSessionId === session.id ? 'bg-blue-600/10 border-r-4 border-r-blue-500' : 'hover:bg-slate-800/50'}`}
                >
                  <h3 className={`font-bold text-sm truncate ${activeSessionId === session.id ? 'text-blue-400' : 'text-slate-300'}`}>
                    {session.mainTitle}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{new Date(session.createdAt).toLocaleDateString()}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded">{session.records.length} files</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Details Panel: Records */}
          <div className="flex-1 bg-slate-950 overflow-y-auto p-8">
            {activeSession ? (
              <div className="max-w-3xl mx-auto space-y-6">
                 <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{activeSession.mainTitle}</h1>
                        <p className="text-sm text-slate-500 mt-1">Source: {activeSession.audioName}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-slate-600 block">Session ID: {activeSession.id}</span>
                        <span className="text-xs text-slate-600 block">{new Date(activeSession.createdAt).toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                    {activeSession.records.map((record) => (
                      <div 
                        key={record.id} 
                        className="group bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:bg-slate-900 hover:border-slate-700 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div 
                            onClick={() => onSelectRecord(activeSession, record)}
                            className="flex items-start space-x-4 cursor-pointer flex-1"
                          >
                            <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                                {getIconForType(record.type)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                                {record.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">
                                {record.content.substring(0, 160)}...
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                            <button 
                              onClick={() => onCopy(record.content)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                              title="Copy Content"
                            >
                              <CopyIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                let content = record.content;
                                if (record.type === 'qa' && record.qa) {
                                  content = record.qa.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
                                }
                                onMigrateToNotebook(content, record.title);
                              }}
                              className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 transition-all"
                              title="Send to Notebook"
                            >
                              <SparklesIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-700">
                 <HistoryIcon className="w-16 h-16 mb-4 opacity-10" />
                 <p>Select a recording session from the menu</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
