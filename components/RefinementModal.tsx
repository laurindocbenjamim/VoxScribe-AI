import React, { useState } from 'react';
import { SpeakerIcon, DownloadIcon, CopyIcon, MapIcon, EyeIcon, EyeOffIcon, RefreshIcon } from './Icons';

interface RefinementModalProps {
  originalText: string;
  refinedText: string;
  title?: string;
  onClose: () => void;
  onPlay: (text: string) => void;
  onDownloadAudio: (text: string) => void;
  onCopy: (text: string) => void;
  onVisualize: (text: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isPlaying: boolean;
  isGeneratingAudio: boolean;
}

const RefinementModal: React.FC<RefinementModalProps> = ({ 
  originalText, 
  refinedText, 
  title = "Refined Transcript",
  onClose,
  onPlay,
  onDownloadAudio,
  onCopy,
  onVisualize,
  onRegenerate,
  isRegenerating,
  isPlaying,
  isGeneratingAudio
}) => {
  const [showOriginal, setShowOriginal] = useState(true);

  // Helper to parse Markdown-like content into stylized HTML for the "Editor" view
  const renderContent = (text: string) => {
    // 1. Sanitize Basic HTML chars to prevent injection but allow our generated tags
    let safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Headers
    // H1
    safeText = safeText.replace(
        /^# (.*$)/gim, 
        '<h1 class="text-3xl font-bold text-slate-100 mt-6 mb-4 pb-2 border-b border-slate-700">$1</h1>'
    );
    // H2
    safeText = safeText.replace(
        /^## (.*$)/gim, 
        '<h2 class="text-2xl font-bold text-slate-100 mt-6 mb-3">$1</h2>'
    );
    // H3
    safeText = safeText.replace(
        /^### (.*$)/gim, 
        '<h3 class="text-xl font-semibold text-slate-200 mt-5 mb-2">$1</h3>'
    );

    // 3. Bold (**text**)
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

    // 4. Italic (*text*)
    safeText = safeText.replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>');

    // 5. Links ([Title](url)) - Render as blue clickable links
    safeText = safeText.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 transition-colors">$1</a>'
    );

    // 6. Citations ([1], [2]) - Highlight them
    safeText = safeText.replace(
        /(\[\d+\])/g, 
        '<span class="text-emerald-400 font-mono text-sm align-super ml-0.5">$1</span>'
    );

    // 7. Paragraphs: Split by double newline and wrap
    safeText = safeText.replace(/\n\n/g, '<div class="h-4"></div>'); // Spacer
    safeText = safeText.replace(/\n/g, '<br/>');

    return { __html: safeText };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col border border-slate-700 shadow-2xl transition-all duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
                {title}
                <span className="ml-3 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/50">
                    AI Enhanced
                </span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">Corrected using Deep Search & Grammar Analysis</p>
          </div>
          <div className="flex items-center space-x-2">
             <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className={`flex items-center space-x-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700 hover:border-slate-500 ${isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Regenerate Text"
            >
                <RefreshIcon className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium hidden sm:inline">{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>
             <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center space-x-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700 hover:border-slate-500"
                title={showOriginal ? "Hide Original Text" : "Show Original Text"}
            >
                {showOriginal ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                <span className="text-sm font-medium hidden sm:inline">{showOriginal ? 'Hide Original' : 'Show Original'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content Area - Added min-h-0 to allow scrolling within flex items */}
        <div className="flex-1 overflow-hidden p-0 bg-slate-950 flex flex-col md:flex-row min-h-0">
            {/* Original Text (Sidebar Style) */}
            {showOriginal && (
                <div className="w-full md:w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50 animate-slideIn min-h-0">
                    <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Transcript</h3>
                    </div>
                    <div className="flex-1 p-6 text-slate-400 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {originalText}
                    </div>
                </div>
            )}
            
            {/* Refined Text (Modern Editor Style) */}
            <div className={`flex-1 flex flex-col ${showOriginal ? 'md:w-2/3' : 'w-full'} bg-[#0B1120] min-h-0`}>
                 <div className="p-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
                    <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        Editor View
                    </h3>
                    <div className="text-xs text-slate-500">
                        Markdown Mode
                    </div>
                 </div>
                 
                 {/* The "Paper" / Editor Area */}
                 <div className="flex-1 overflow-y-auto relative scroll-smooth">
                     <div className="max-w-4xl mx-auto min-h-full bg-[#0B1120] p-8 md:p-12 shadow-sm">
                        <div 
                            className={`prose prose-invert prose-lg max-w-none text-slate-300 font-sans leading-8 ${isRegenerating ? 'opacity-50 blur-[1px]' : ''}`}
                            dangerouslySetInnerHTML={renderContent(refinedText)}
                        />
                         {/* Extra space at bottom to ensure easy scrolling to end */}
                        <div className="h-16"></div>
                     </div>
                 </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
                    <span>IEEE Standard</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                    <span>Deep Search Active</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onPlay(refinedText)}
                        disabled={isGeneratingAudio || isRegenerating}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        isPlaying 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
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
                        disabled={isRegenerating}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-500/30 rounded-lg font-medium transition-all text-sm disabled:opacity-50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Download Audio</span>
                    </button>

                    <button
                        onClick={() => onCopy(refinedText)}
                        disabled={isRegenerating}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg font-medium transition-all text-sm disabled:opacity-50"
                    >
                        <CopyIcon className="w-4 h-4" />
                        <span>Copy</span>
                    </button>

                    <button
                        onClick={() => onVisualize(refinedText)}
                        disabled={isRegenerating}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/25 text-sm disabled:opacity-50"
                    >
                        <MapIcon className="w-4 h-4" />
                        <span>Map</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RefinementModal;