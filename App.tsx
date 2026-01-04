
import React, { useState, useRef, useEffect } from 'react';
import { 
  transcribeLargeAudio, 
  translateLongText, 
  generateSpeech, 
  generateMindMap, 
  refineTextWithSearch, 
  enhanceScientificText,
  extractTitle,
  generateQAFromTranscript
} from './services/geminiService';
import { getSubscription, addUsageMinutes, checkLimits, upgradePlan } from './services/subscriptionService';
import { getCurrentUser, login, signup, logout, loginWithProvider } from './services/authService';
import { AppStatus, TranscriptionResult, AudioMetadata, SubscriptionState, PlanTier, User, AppView, Note, HistorySession, HistoryRecord, QAItem } from './types';
import { TARGET_LANGUAGES, VOICE_OPTIONS } from './constants';
import { 
  MicIcon, UploadIcon, StopIcon, DownloadIcon, RefreshIcon, PlayIcon, 
  CheckIcon, SpeakerIcon, CopyIcon, LockIcon, SparklesIcon, MapIcon, 
  WandIcon, AcademicIcon, LayoutIcon, BookIcon, HistoryIcon, HelpCircleIcon
} from './components/Icons';
import AudioVisualizer from './components/AudioVisualizer';
import PricingModal from './components/PricingModal';
import MindMapModal from './components/MindMapModal';
import RefinementModal from './components/RefinementModal';
import RefinementInputModal from './components/RefinementInputModal';
import AuthModal from './components/AuthModal';
import Notebook from './components/Notebook';
import HistoryModal from './components/HistoryModal';
import QAModal from './components/QAModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [showOnboardingPlans, setShowOnboardingPlans] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioMetadata | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [targetLang, setTargetLang] = useState<string>('en'); 
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  
  // Audio Playback State
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [currentPlayingText, setCurrentPlayingText] = useState<string | null>(null);
  
  // Mind Map State
  const [mindMapCode, setMindMapCode] = useState<string | null>(null);
  const [visualizedText, setVisualizedText] = useState<string | null>(null);
  const [isMindMapModalOpen, setIsMindMapModalOpen] = useState(false);

  // Refinement State
  const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
  const [refinedText, setRefinedText] = useState<string | null>(null);
  const [refinementType, setRefinementType] = useState<'standard' | 'scientific'>('standard');
  const [showRefinementInput, setShowRefinementInput] = useState(false);

  // Q&A State
  const [isQAModalOpen, setIsQAModalOpen] = useState(false);
  const [qaData, setQaData] = useState<{ refinedText: string; qa: QAItem[] } | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistorySession[]>(() => {
    const saved = localStorage.getItem('voxscribe_sessions_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Notebook State
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('voxscribe_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('voxscribe_notes', JSON.stringify(notes));
    localStorage.setItem('voxscribe_sessions_v2', JSON.stringify(history));
  }, [notes, history]);

  // Subscription State
  const [subscription, setSubscription] = useState<SubscriptionState>(getSubscription());
  const [showPricing, setShowPricing] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const isDevUser = user?.email === 'feti@voxscribe.pt';

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setShowAuth(false);
    }
    setSubscription(getSubscription());
  }, []);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const handleTranslate = async () => {
    if (!result?.originalText) return;
    if (!subscription.canTranslate && !isDevUser) {
        setShowPricing(true);
        return;
    }

    setStatus(AppStatus.TRANSLATING);
    try {
        const langName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
        const translated = await translateLongText(result.originalText, langName);
        
        const translationRecord: HistoryRecord = {
          id: `rec-trans-${Date.now()}`,
          type: 'translation',
          title: `${result.title} - Translation (${targetLang.toUpperCase()})`,
          timestamp: Date.now(),
          content: translated,
          metadata: { language: targetLang }
        };
        
        addRecordToCurrentSession(translationRecord, result.title, audioData?.name || 'Manual Translation');
        setResult(prev => prev ? { ...prev, translatedText: translated, targetLanguage: targetLang } : null);
        setStatus(AppStatus.COMPLETED);
        showToast(`Translated to ${langName}`);
    } catch (err: any) {
        setError("Translation failed.");
        setStatus(AppStatus.COMPLETED);
    }
  };

  const handleProcess = async () => {
    if (!audioData) return;
    const estimatedDuration = audioData.duration || 60; 
    if (!checkLimits(subscription, estimatedDuration)) {
        setShowPricing(true);
        return;
    }
    setStatus(AppStatus.TRANSCRIBING);
    setError(null);
    
    try {
      const transcript = await transcribeLargeAudio(audioData.blob);
      const deducedTitle = await extractTitle(transcript);
      
      const newSubState = addUsageMinutes(estimatedDuration);
      setSubscription(newSubState);
      
      const transcriptionRecord: HistoryRecord = {
        id: `rec-${Date.now()}`,
        type: 'transcription',
        title: deducedTitle,
        timestamp: Date.now(),
        content: transcript,
        metadata: { audioName: audioData.name }
      };

      addRecordToCurrentSession(transcriptionRecord, deducedTitle, audioData.name);
      setResult({ title: deducedTitle, originalText: transcript });
      
      // Auto-translate if target language is not just standard English (or if user wants it)
      if (transcript && (subscription.canTranslate || isDevUser)) {
          setStatus(AppStatus.TRANSLATING);
          const langName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
          const translated = await translateLongText(transcript, langName);
          
          const translationRecord: HistoryRecord = {
            id: `rec-trans-${Date.now()}`,
            type: 'translation',
            title: `${deducedTitle} - Translation (${targetLang.toUpperCase()})`,
            timestamp: Date.now(),
            content: translated,
            metadata: { language: targetLang }
          };
          addRecordToCurrentSession(translationRecord, deducedTitle, audioData.name);
          setResult({ title: deducedTitle, originalText: transcript, translatedText: translated, targetLanguage: targetLang });
      }
      
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setStatus(AppStatus.ERROR);
    }
  };

  const addRecordToCurrentSession = (record: HistoryRecord, mainTitle: string, audioName: string) => {
    setHistory(prev => {
      let sessions = [...prev];
      let sessionId = currentSessionId;
      let sessionIndex = sessionId ? sessions.findIndex(s => s.id === sessionId) : -1;
      
      if (sessionIndex === -1) {
        const newSession: HistorySession = {
          id: Date.now().toString(),
          mainTitle: mainTitle,
          createdAt: Date.now(),
          audioName: audioName,
          records: [record]
        };
        setCurrentSessionId(newSession.id);
        return [newSession, ...sessions];
      } else {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          records: [record, ...sessions[sessionIndex].records]
        };
        return sessions;
      }
    });
  };

  const handleSelectHistoryRecord = (session: HistorySession, record: HistoryRecord) => {
    setCurrentView('dashboard');
    setCurrentSessionId(session.id);
    
    const transcription = session.records.find(r => r.type === 'transcription');
    const translation = session.records.find(r => r.type === 'translation');

    setResult({
        title: session.mainTitle,
        originalText: transcription?.content || "",
        translatedText: translation?.content || "",
        targetLanguage: translation?.metadata?.language || "en"
    });

    if (record.type === 'qa') {
        setQaData({ refinedText: record.content, qa: record.qa || [] });
        setIsQAModalOpen(true);
    } else if (record.type === 'refinement' || record.type === 'scientific') {
        setRefinedText(record.content);
        setRefinementType(record.type === 'scientific' ? 'scientific' : 'standard');
        setIsRefinementModalOpen(true);
    }

    setShowHistoryModal(false);
  };

  const handlePlayAudio = async (text: string) => {
    if (isPlayingAudio) {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsPlayingAudio(false);
      if (text === currentPlayingText) return;
    }
    if (!text) return;
    setIsGeneratingAudio(true);
    setCurrentPlayingText(text);
    try {
      const base64Audio = await generateSpeech(text, selectedVoice);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingAudio(false);
      audioSourceRef.current = source;
      source.start();
      setIsPlayingAudio(true);
    } catch (err) { setError("Failed to play audio."); } finally { setIsGeneratingAudio(false); }
  };

  const resetApp = () => {
    setStatus(AppStatus.IDLE);
    setAudioData(null);
    setResult(null);
    setError(null);
    setRecordingDuration(0);
    if (audioData?.url) URL.revokeObjectURL(audioData.url);
  };

  const handleMigrateToNotebook = (content: string, title: string) => {
    const newNote: Note = { id: Date.now().toString(), title, content, createdAt: Date.now(), updatedAt: Date.now() };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setCurrentView('notebook');
    setIsRefinementModalOpen(false);
    setShowHistoryModal(false);
    setIsQAModalOpen(false);
    showToast("Added to Notebook!");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      {showAuth && !user && <AuthModal onLogin={(e, p) => login(e, p).then(u => { setUser(u); setShowAuth(false); })} onSignup={(e, p) => signup(e, p).then(u => { setUser(u); setShowAuth(false); })} onSocialLogin={(p) => loginWithProvider(p).then(u => { setUser(u); setShowAuth(false); })} />}
      {showPricing && <PricingModal currentTier={subscription.tier} onUpgrade={(t) => { setSubscription(upgradePlan(t)); setShowPricing(false); }} onClose={() => setShowPricing(false)} />}
      
      {showHistoryModal && (
        <HistoryModal 
          history={history} 
          onClose={() => setShowHistoryModal(false)}
          onMigrateToNotebook={handleMigrateToNotebook}
          onCopy={(t) => { navigator.clipboard.writeText(t); showToast("Copied!"); }}
          onClearHistory={() => setHistory([])}
          onSelectRecord={handleSelectHistoryRecord}
        />
      )}

      {isRefinementModalOpen && refinedText && result && (
        <RefinementModal
            originalText={result.originalText}
            refinedText={refinedText}
            title={refinementType === 'scientific' ? "Scientific Refinement" : "Refined Transcript"}
            onClose={() => setIsRefinementModalOpen(false)}
            onPlay={handlePlayAudio}
            onDownloadAudio={() => {}}
            onCopy={(t) => { navigator.clipboard.writeText(t); showToast("Copied!"); }}
            onVisualize={() => {}}
            onRegenerate={() => {}}
            onMigrateToNotebook={handleMigrateToNotebook}
            isRegenerating={false}
            isPlaying={isPlayingAudio && currentPlayingText === refinedText}
            isGeneratingAudio={isGeneratingAudio && currentPlayingText === refinedText}
        />
      )}

      {isQAModalOpen && qaData && result && (
        <QAModal
            qa={qaData.qa}
            refinedText={qaData.refinedText}
            title={result.title}
            onClose={() => setIsQAModalOpen(false)}
            onCopy={(t) => { navigator.clipboard.writeText(t); showToast("Copied!"); }}
            onMigrateToNotebook={handleMigrateToNotebook}
        />
      )}

      {isMindMapModalOpen && mindMapCode && <MindMapModal mermaidCode={mindMapCode} onClose={() => setIsMindMapModalOpen(false)} />}

      {showRefinementInput && <RefinementInputModal title={refinementType === 'scientific' ? "Scientific Enrichment" : "Refinement"} onClose={() => setShowRefinementInput(false)} onConfirm={(obs) => { setShowRefinementInput(false); setStatus(AppStatus.PROCESSING); if(refinementType === 'scientific') { enhanceScientificText(result?.originalText || '', obs).then(t => { setRefinedText(t); setIsRefinementModalOpen(true); setStatus(AppStatus.COMPLETED); }); } else { refineTextWithSearch(result?.originalText || '', obs).then(t => { setRefinedText(t); setIsRefinementModalOpen(true); setStatus(AppStatus.COMPLETED); }); } }} />}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">VoxScribe AI</h1>
            <div className="flex items-center mt-4 space-x-6">
               <button onClick={() => setCurrentView('dashboard')} className={`text-sm font-medium pb-2 ${currentView === 'dashboard' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>Dashboard</button>
               <button onClick={() => setCurrentView('notebook')} className={`text-sm font-medium pb-2 ${currentView === 'notebook' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>Notebook</button>
               <button onClick={() => setShowHistoryModal(true)} className="text-sm font-medium pb-2 text-slate-500 hover:text-white transition-colors flex items-center gap-2"><HistoryIcon className="w-4 h-4" /> History</button>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 w-full md:w-64">
             <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Monthly Usage</span><span className="text-slate-200">{Math.floor(subscription.minutesUsed)} / {subscription.maxMinutes}m</span></div>
             <div className="w-full bg-slate-700 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min((subscription.minutesUsed / subscription.maxMinutes) * 100, 100)}%` }}></div></div>
          </div>
        </header>

        <main>
          {currentView === 'dashboard' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <section className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4 text-white">Input</h2>
                    <div className="space-y-4">
                      {!audioData && !isRecording ? (
                        <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-900/20">
                          <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { setAudioData({ blob: f, url: URL.createObjectURL(f), name: f.name, mimeType: f.type }); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <UploadIcon className="w-10 h-10 mx-auto mb-4 text-slate-600" />
                          <p className="text-sm text-slate-400">Click to upload or drag audio</p>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 flex items-center justify-between">
                          <div className="truncate pr-4"><p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Source Ready</p><p className="text-sm text-slate-200 truncate">{audioData?.name || 'Recording'}</p></div>
                          <button onClick={resetApp} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors"><RefreshIcon className="w-4 h-4" /></button>
                        </div>
                      )}
                      <div className="space-y-4 pt-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Language</label>
                        <div className="flex gap-2">
                           <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                             {TARGET_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} {(!subscription.canTranslate && l.code !== 'en' && !isDevUser) ? '🔒' : ''}</option>)}
                           </select>
                           {result?.originalText && (
                             <button onClick={handleTranslate} className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center" title="Re-translate">
                               <RefreshIcon className="w-4 h-4" />
                             </button>
                           )}
                        </div>
                        <button onClick={handleProcess} disabled={!audioData || status === AppStatus.TRANSCRIBING || status === AppStatus.TRANSLATING} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center space-x-3">
                          {status === AppStatus.TRANSCRIBING || status === AppStatus.TRANSLATING ? (
                             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                             <><PlayIcon className="w-5 h-5" /><span>Transcribe & Translate</span></>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="lg:col-span-8 space-y-6">
                   <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 min-h-[500px] flex flex-col">
                      <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                         <h2 className="text-xl font-bold text-white truncate max-w-[50%]">{result?.title || 'Processing Output'}</h2>
                         {result && (
                           <div className="flex space-x-2">
                             <button onClick={() => handlePlayAudio(result.translatedText || result.originalText)} className="p-2.5 bg-slate-900/50 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"><SpeakerIcon className="w-4 h-4" /></button>
                             <button onClick={() => { navigator.clipboard.writeText(result.translatedText || result.originalText); showToast("Copied!"); }} className="p-2.5 bg-slate-900/50 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"><CopyIcon className="w-4 h-4" /></button>
                           </div>
                         )}
                      </div>
                      <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                         <div>
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><MicIcon className="w-3 h-3" /> Original Transcript</h3>
                            {result?.originalText ? <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap selection:bg-blue-500/30">{result.originalText}</p> : <div className="py-20 text-center"><p className="text-slate-700 italic text-sm">Waiting for audio source...</p></div>}
                         </div>
                         <div className="pt-8 border-t border-slate-700/50">
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><SpeakerIcon className="w-3 h-3" /> Translation Output</h3>
                            {result?.translatedText ? <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-wrap selection:bg-blue-500/30">{result.translatedText}</p> : <div className="py-10 text-center"><p className="text-slate-800 italic text-xs">Translation will appear here.</p></div>}
                         </div>
                      </div>
                      {result && (
                        <div className="mt-8 pt-6 border-t border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                           <button onClick={() => { setStatus(AppStatus.GENERATING_QA); generateQAFromTranscript(result.originalText).then(d => { setQaData(d); setIsQAModalOpen(true); setStatus(AppStatus.COMPLETED); }); }} className="text-[10px] uppercase font-bold text-slate-400 border border-slate-700 rounded-xl py-3 hover:bg-slate-700 transition-all flex flex-col items-center group"><HelpCircleIcon className="w-5 h-5 mb-2 group-hover:text-blue-400" /><span>AI Analyze</span></button>
                           <button onClick={() => { setRefinementType('standard'); setShowRefinementInput(true); }} className="text-[10px] uppercase font-bold text-slate-400 border border-slate-700 rounded-xl py-3 hover:bg-slate-700 transition-all flex flex-col items-center group"><WandIcon className="w-5 h-5 mb-2 group-hover:text-teal-400" /><span>Fix Gaps</span></button>
                           <button onClick={() => { setRefinementType('scientific'); setShowRefinementInput(true); }} className="text-[10px] uppercase font-bold text-slate-400 border border-slate-700 rounded-xl py-3 hover:bg-slate-700 transition-all flex flex-col items-center group"><AcademicIcon className="w-5 h-5 mb-2 group-hover:text-indigo-400" /><span>High Quality</span></button>
                           <button onClick={() => { setStatus(AppStatus.PROCESSING); generateMindMap(result.originalText).then(c => { setMindMapCode(c); setIsMindMapModalOpen(true); setStatus(AppStatus.COMPLETED); }); }} className="text-[10px] uppercase font-bold text-slate-400 border border-slate-700 rounded-xl py-3 hover:bg-slate-700 transition-all flex flex-col items-center group"><MapIcon className="w-5 h-5 mb-2 group-hover:text-amber-400" /><span>Mind Map</span></button>
                        </div>
                      )}
                   </div>
                </section>
             </div>
          ) : (
             <Notebook notes={notes} activeNoteId={activeNoteId} onSaveNote={(n) => setNotes(prev => prev.map(old => old.id === n.id ? n : old))} onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))} onSelectNote={setActiveNoteId} onCreateNote={() => { const n = { id: Date.now().toString(), title: "Meeting Notes " + new Date().toLocaleDateString(), content: "", createdAt: Date.now(), updatedAt: Date.now() }; setNotes([n, ...notes]); setActiveNoteId(n.id); }} />
          )}
        </main>
      </div>
      {toast.show && <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full border border-slate-700 shadow-2xl flex items-center space-x-3 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300"><CheckIcon className="w-4 h-4 text-green-400" /><span>{toast.message}</span></div>}
    </div>
  );
};

export default App;
