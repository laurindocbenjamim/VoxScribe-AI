import React from 'react';
import { SpeakerIcon, DownloadIcon, CopyIcon, MapIcon } from './Icons';

interface RefinementModalProps {
  originalText: string;
  refinedText: string;
  onClose: () => void;
  onPlay: (text: string) => void;
  onDownloadAudio: (text: string) => void;
  onCopy: (text: string) => void;
  onVisualize: (text: string) => void;
  isPlaying: boolean;
  isGeneratingAudio: boolean;
}

const RefinementModal: React.FC<RefinementModalProps> = ({ 
  originalText, 
  refinedText, 
  onClose,
  onPlay,
  onDownloadAudio,
  onCopy,
  onVisualize,
  isPlaying,
  isGeneratingAudio
}) => {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
                Refined Transcript
                <span className="ml-3 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/50">
                    AI Enhanced
                </span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">Corrected using Deep Search & Grammar Analysis</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Original */}
            <div className="flex flex-col">
                 <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Original</h3>
                 <div className="flex-1 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 overflow-y-auto max-h-[50vh] whitespace-pre-wrap">
                    {originalText}
                 </div>
            </div>
            
            {/* Refined */}
            <div className="flex flex-col">
                 <h3 className="text-sm font-semibold text-green-500 uppercase tracking-wider mb-2">Refined & Corrected</h3>
                 <div className="flex-1 p-4 rounded-xl bg-slate-800/50 border border-green-500/30 text-slate-200 overflow-y-auto max-h-[50vh] whitespace-pre-wrap shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    {refinedText}
                 </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-700 bg-slate-900 rounded-b-2xl">
            <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                    onClick={() => onPlay(refinedText)}
                    disabled={isGeneratingAudio}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    isPlaying 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                >
                    {isGeneratingAudio ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                    <SpeakerIcon className="w-4 h-4" />
                    )}
                    <span>{isPlaying ? 'Stop' : 'Listen'}</span>
                </button>

                <button
                    onClick={() => onDownloadAudio(refinedText)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 rounded-lg font-medium transition-all"
                >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Download Audio</span>
                </button>

                <button
                    onClick={() => onCopy(refinedText)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                >
                    <CopyIcon className="w-4 h-4" />
                    <span>Copy Text</span>
                </button>

                <button
                    onClick={() => onVisualize(refinedText)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/25"
                >
                    <MapIcon className="w-4 h-4" />
                    <span>Visualize Map</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RefinementModal;
