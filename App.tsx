import React, { useState, useRef, useEffect } from 'react';
import { 
  transcribeAudio, 
  transcribeLargeAudio, 
  translateLongText, 
  generateSpeech, 
  generateMindMap, 
  refineTextWithSearch, 
  enhanceScientificText 
} from './services/geminiService';
import { getSubscription, addUsageMinutes, checkLimits, upgradePlan } from './services/subscriptionService';
import { getCurrentUser, login, signup, logout, loginWithProvider } from './services/authService';
import { AppStatus, TranscriptionResult, AudioMetadata, SubscriptionState, PlanTier, User, AppView, Note } from './types';
import { TARGET_LANGUAGES, VOICE_OPTIONS } from './constants';
import { 
  MicIcon, UploadIcon, StopIcon, DownloadIcon, RefreshIcon, PlayIcon, 
  CheckIcon, SpeakerIcon, CopyIcon, LockIcon, SparklesIcon, MapIcon, 
  WandIcon, AcademicIcon 
} from './components/Icons';
import AudioVisualizer from './components/AudioVisualizer';
import PricingModal from './components/PricingModal';
import MindMapModal from './components/MindMapModal';
import RefinementModal from './components/RefinementModal';
import RefinementInputModal from './components/RefinementInputModal';
import AuthModal from './components/AuthModal';
import Notebook from './components/Notebook';

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
  const [isRegeneratingRefinement, setIsRegeneratingRefinement] = useState(false);
  const [refinementType, setRefinementType] = useState<'standard' | 'scientific'>('standard');
  const [showRefinementInput, setShowRefinementInput] = useState(false);
  
  // Notebook State
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('voxscribe_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('voxscribe_notes', JSON.stringify(notes));
  }, [notes]);

  // Subscription State
  const [subscription, setSubscription] = useState<SubscriptionState>(getSubscription());
  const [showPricing, setShowPricing] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Audio Context State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const isDevUser = user?.email === 'feti@voxscribe.pt';

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setShowAuth(false);
    }
    setSubscription(getSubscription());
  }, []);

  useEffect(() => {
    if (audioSourceRef.current && isPlayingAudio) {
      audioSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate, isPlayingAudio]);

  // Auth Handlers
  const handleLogin = async (email: string, password: string) => {
    try {
        const u = await login(email, password);
        setUser(u);
        setShowAuth(false);
        setSubscription(getSubscription());
    } catch (e) {
        showToast("Login failed. Please check credentials.");
    }
  };

  const handleSignup = async (email: string, password: string) => {
    try {
        const u = await signup(email, password);
        setUser(u);
        setShowAuth(false);
        setSubscription(getSubscription());
        if (email !== 'feti@voxscribe.pt') {
           setShowOnboardingPlans(true);
        }
    } catch (e) {
        showToast("Signup failed");
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    try {
        const u = await loginWithProvider(provider);
        setUser(u);
        setShowAuth(false);
        setSubscription(getSubscription());
        setShowOnboardingPlans(true);
    } catch (e) {
        showToast(`Failed to login with ${provider}`);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setShowAuth(true);
    resetApp();
  };

  const resetApp = () => {
    setStatus(AppStatus.IDLE);
    setAudioData(null);
    setResult(null);
    setError(null);
    setRecordingDuration(0);
    setGeneratedAudioBase64(null);
    setCurrentPlayingText(null);
    setMindMapCode(null);
    setVisualizedText(null);
    setRefinedText(null);
    stopAudioPlayback();
    if (audioData?.url) {
      URL.revokeObjectURL(audioData.url);
    }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const getAudioDuration = async (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(blob));
      const timeout = setTimeout(() => {
        const sizeInBytes = blob.size;
        let estimatedSeconds = 0;
        if (blob.type.includes('wav')) {
             estimatedSeconds = sizeInBytes / 32000;
        } else {
             estimatedSeconds = sizeInBytes / 16000;
        }
        resolve(estimatedSeconds);
      }, 2000); 

      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        if (audio.duration === Infinity || isNaN(audio.duration)) {
             const sizeInBytes = blob.size;
             let estimatedSeconds = 0;
             if (blob.type.includes('wav')) {
                 estimatedSeconds = sizeInBytes / 32000;
             } else {
                 estimatedSeconds = sizeInBytes / 16000;
             }
             resolve(estimatedSeconds);
        } else {
            resolve(audio.duration);
        }
      };
    });
  };

  const startRecording = async () => {
    if (!checkLimits(subscription, 1)) {
        setShowPricing(true);
        return;
    }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioData({
          blob,
          url,
          name: `recording-${new Date().toISOString()}.webm`,
          mimeType: 'audio/webm',
          duration: recordingDuration 
        });
        setStatus(AppStatus.IDLE);
        setIsRecording(false);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setStatus(AppStatus.RECORDING);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError("File size too large. Please upload files under 2GB.");
      return;
    }
    resetApp();
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);
    setAudioData({
      blob: file,
      url,
      name: file.name,
      mimeType: file.type || 'audio/mp3',
      duration
    });
  };

  const handleProcess = async () => {
    if (!audioData) return;
    const estimatedDuration = audioData.duration && audioData.duration > 0 ? audioData.duration : 60; 
    if (!checkLimits(subscription, estimatedDuration)) {
        setShowPricing(true);
        setError("Usage limit reached. Please update your plan to continue.");
        return;
    }
    setStatus(AppStatus.TRANSCRIBING);
    setError(null);
    stopAudioPlayback();
    setGeneratedAudioBase64(null); 
    setCurrentPlayingText(null);
    setMindMapCode(null);
    setVisualizedText(null);
    setRefinedText(null);
    try {
      let transcript = await transcribeLargeAudio(audioData.blob);
      const newSubState = addUsageMinutes(estimatedDuration);
      setSubscription(newSubState);
      const intermediateResult: TranscriptionResult = { originalText: transcript };
      setResult(intermediateResult);
      setStatus(AppStatus.TRANSLATING);
      if (transcript) {
        if (targetLang !== 'en' && !subscription.canTranslate) {
            setResult({ ...intermediateResult, translatedText: "Upgrade to Advanced Plan to unlock translation.", targetLanguage: targetLang });
        } else {
            const selectedLangName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
            const translation = await translateLongText(transcript, selectedLangName);
            setResult({ ...intermediateResult, translatedText: translation, targetLanguage: targetLang });
        }
      }
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleExportReport = () => {
    if (!result) return;
    const timestamp = new Date().toLocaleString();
    const content = `VOXSCRIBE AI - TRANSCRIPTION REPORT\nDate: ${timestamp}\nFile: ${audioData?.name || 'Recording'}\nDuration: ${audioData?.duration ? formatTime(audioData.duration) : 'Unknown'}\nTarget Language: ${TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}\n\n---------------------------------------------------\nORIGINAL TRANSCRIPT\n---------------------------------------------------\n${result.originalText || "(No transcript available)"}\n\n---------------------------------------------------\nTRANSLATION (${targetLang.toUpperCase()})\n---------------------------------------------------\n${result.translatedText || "(No translation available)"}\n\n---------------------------------------------------\nGenerated by VoxScribe AI\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoxScribe_Report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpgrade = (tier: PlanTier) => {
    const newState = upgradePlan(tier);
    setSubscription(newState);
    showToast(`Successfully upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan!`);
    setShowPricing(false);
    setShowOnboardingPlans(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  };

  const handleRefineClick = () => {
    if (!result?.originalText) return;
    setRefinementType('standard');
    setShowRefinementInput(true);
  };

  const handleScientificClick = () => {
    if (!result?.originalText) return;
    setRefinementType('scientific');
    setShowRefinementInput(true);
  };

  const executeRefinement = async (observation: string) => {
    setShowRefinementInput(false);
    const textToRefine = result?.originalText;
    if (!textToRefine) return;
    setStatus(AppStatus.PROCESSING);
    try {
        let corrected = (refinementType === 'scientific') 
            ? await enhanceScientificText(textToRefine, observation)
            : await refineTextWithSearch(textToRefine, observation);
        setRefinedText(corrected);
        setStatus(AppStatus.COMPLETED);
        setIsRefinementModalOpen(true);
    } catch (err: any) {
        setError("Failed to refine text. Please try again.");
        setStatus(AppStatus.COMPLETED);
    }
  };

  const handleRegenerateRefinement = async () => {
    const textToRefine = result?.originalText;
    if (!textToRefine) return;
    setIsRegeneratingRefinement(true);
    try {
        let corrected = (refinementType === 'scientific') 
            ? await enhanceScientificText(textToRefine)
            : await refineTextWithSearch(textToRefine);
        setRefinedText(corrected);
        if (isPlayingAudio && currentPlayingText === refinedText) stopAudioPlayback();
    } catch (err: any) {
        setError("Failed to regenerate refined text.");
    } finally {
        setIsRegeneratingRefinement(false);
    }
  };

  const handleGenerateMindMap = async (text: string) => {
    if (!text) return;
    if (isRefinementModalOpen) setIsRefinementModalOpen(false);
    try {
        if (text !== visualizedText || !mindMapCode) {
            setStatus(AppStatus.PROCESSING);
            const code = await generateMindMap(text);
            setMindMapCode(code);
            setVisualizedText(text);
            setStatus(AppStatus.COMPLETED);
        }
        setIsMindMapModalOpen(true);
    } catch (err: any) {
        setError("Failed to generate mind map.");
        setStatus(AppStatus.COMPLETED);
    }
  };

  const stopAudioPlayback = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handlePlayAudio = async (text: string) => {
    if (isPlayingAudio) {
      stopAudioPlayback();
      if (text === currentPlayingText) return; 
    }
    if (!text) return;
    setIsGeneratingAudio(true);
    setCurrentPlayingText(text);
    try {
      let base64Audio = generatedAudioBase64;
      if (text !== currentPlayingText || !base64Audio) {
          base64Audio = await generateSpeech(text, selectedVoice);
          setGeneratedAudioBase64(base64Audio); 
      }
      if (!base64Audio) return;
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
         await audioContextRef.current.resume();
      }
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const audioBuffer = audioContextRef.current.createBuffer(1, frameCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate; 
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingAudio(false);
      audioSourceRef.current = source;
      source.start();
      setIsPlayingAudio(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to play audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadAudio = async (text: string) => {
    let base64ToDownload = generatedAudioBase64;
    if (text !== currentPlayingText || !base64ToDownload) {
        try { base64ToDownload = await generateSpeech(text, selectedVoice); } catch (e) { return; }
    }
    if (!base64ToDownload) return;
    const binaryString = atob(base64ToDownload);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32Samples = new Float32Array(dataInt16.length);
    for(let i=0; i<dataInt16.length; i++) float32Samples[i] = dataInt16[i] / 32768.0;
    const buffer = new ArrayBuffer(44 + float32Samples.length * 2);
    const view = new DataView(buffer);
    const sampleRate = 24000;
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + float32Samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, float32Samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < float32Samples.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    const wavBlob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-output.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Notebook Handlers
  const handleSaveNote = (updatedNote: Note) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm("Are you sure you want to delete this note?")) {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
    }
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const handleMigrateToNotebook = (content: string, title: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: title,
      content: content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setCurrentView('notebook');
    setIsRefinementModalOpen(false);
    showToast("Successfully migrated to Notebook!");
  };

  const UsageBar = () => {
    const percent = Math.min((subscription.minutesUsed / subscription.maxMinutes) * 100, 100);
    const isLow = percent > 80;
    return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 w-full md:w-64">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Monthly Usage</span>
                <span className={`${isLow ? 'text-amber-400' : 'text-slate-200'}`}>
                    {Math.floor(subscription.minutesUsed)} / {subscription.maxMinutes} mins
                </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${isLow ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
            </div>
            {subscription.tier === 'free' && !isDevUser && (
                <button onClick={() => setShowPricing(true)} className="text-xs text-blue-400 hover:text-blue-300 mt-2 w-full text-center">Upgrade to remove limits</button>
            )}
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      {showAuth && !user && (
         <AuthModal onLogin={handleLogin} onSignup={handleSignup} onSocialLogin={handleSocialLogin} />
      )}
      {showOnboardingPlans && !isDevUser && (
         <PricingModal currentTier={'free'} onUpgrade={handleUpgrade} onClose={() => {}} isOnboarding={true} />
      )}
      {showPricing && !showOnboardingPlans && !isDevUser && (
          <PricingModal currentTier={subscription.tier} onUpgrade={handleUpgrade} onClose={() => setShowPricing(false)} />
      )}
      {showRefinementInput && (
        <RefinementInputModal title={refinementType === 'scientific' ? "Scientific Enhancement Context" : "Refinement Context"} onClose={() => setShowRefinementInput(false)} onConfirm={executeRefinement} />
      )}
      {isMindMapModalOpen && mindMapCode && (
        <MindMapModal mermaidCode={mindMapCode} onClose={() => setIsMindMapModalOpen(false)} />
      )}
      {isRefinementModalOpen && refinedText && result?.originalText && (
        <RefinementModal
            originalText={result.originalText}
            refinedText={refinedText}
            title={refinementType === 'scientific' ? "Scientific Enhancement (IEEE)" : "Refined Transcript"}
            onClose={() => setIsRefinementModalOpen(false)}
            onPlay={handlePlayAudio}
            onDownloadAudio={handleDownloadAudio}
            onCopy={handleCopy}
            onVisualize={handleGenerateMindMap}
            onRegenerate={handleRegenerateRefinement}
            onMigrateToNotebook={handleMigrateToNotebook}
            isRegenerating={isRegeneratingRefinement}
            isPlaying={isPlayingAudio && currentPlayingText === refinedText}
            isGeneratingAudio={isGeneratingAudio && currentPlayingText === refinedText}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">VoxScribe AI</h1>
                {subscription.tier === 'advanced' && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs border border-purple-500/50 flex items-center">
                        <SparklesIcon className="w-3 h-3 mr-1" /> PRO
                    </span>
                )}
            </div>
            <div className="flex items-center mt-3 space-x-6">
               <button 
                  onClick={() => setCurrentView('dashboard')}
                  className={`text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-slate-500 hover:text-slate-300'}`}
               >
                  Dashboard
               </button>
               <button 
                  onClick={() => setCurrentView('notebook')}
                  className={`text-sm font-medium transition-colors ${currentView === 'notebook' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-slate-500 hover:text-slate-300'}`}
               >
                  Notebook
               </button>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-3">
             <div className="flex items-center space-x-4">
                {user && (
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">{user.name.charAt(0).toUpperCase()}</div>
                        <span className="text-sm text-slate-300 hidden sm:block">{user.email}</span>
                        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 ml-2">Logout</button>
                    </div>
                )}
             </div>
            <UsageBar />
          </div>
        </header>

        <main className={`${(showAuth || showOnboardingPlans) ? 'blur-sm pointer-events-none' : ''}`}>
          {currentView === 'dashboard' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <section className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4 text-white">Audio Source</h2>
                    <div className="mb-6">
                      {!audioData && !isRecording ? (
                        <div className="space-y-4">
                          <button onClick={startRecording} disabled={subscription.minutesUsed >= subscription.maxMinutes} className={`w-full h-16 flex items-center justify-center space-x-3 rounded-xl border transition-all group ${subscription.minutesUsed >= subscription.maxMinutes ? 'bg-slate-700 border-slate-600 text-slate-500' : 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20 text-red-400'}`}>
                            {subscription.minutesUsed >= subscription.maxMinutes ? <span><LockIcon className="w-5 h-5 mr-2"/> Limit Reached</span> : <><MicIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /><span className="font-medium">Start Recording</span></>}
                          </button>
                          <div className="flex items-center justify-center text-slate-500 text-sm"><span className="px-2 bg-slate-800">OR</span></div>
                          <div className="relative">
                            <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={subscription.minutesUsed >= subscription.maxMinutes} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className={`w-full h-24 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${subscription.minutesUsed >= subscription.maxMinutes ? 'border-slate-700 bg-slate-800 text-slate-600' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-700/50 text-slate-400'}`}>
                              {subscription.minutesUsed >= subscription.maxMinutes ? <LockIcon className="w-6 h-6 mb-2" /> : <><UploadIcon className="w-6 h-6 mb-2" /><span>Upload Audio File</span></>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {isRecording ? (
                            <div className="flex flex-col items-center space-y-4 py-4">
                              <div className="text-4xl font-mono text-red-400 animate-pulse">{formatTime(recordingDuration)}</div>
                              <AudioVisualizer isRecording={isRecording} stream={streamRef.current} />
                              <button onClick={stopRecording} className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-red-500/25 flex items-center space-x-2"><StopIcon /><span>Stop</span></button>
                            </div>
                          ) : (
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                              <div className="flex items-center justify-between mb-3"><span className="text-sm font-medium text-blue-400">File Ready</span><button onClick={resetApp} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"><RefreshIcon className="w-4 h-4" /></button></div>
                              <audio controls src={audioData?.url} className="w-full h-8 opacity-80" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-4 border-t border-slate-700 space-y-4">
                      <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-2.5">
                        {TARGET_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                      </select>
                      <button onClick={handleProcess} disabled={!audioData || isRecording} className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center space-x-2">Transcribe & Translate</button>
                    </div>
                  </div>
                </section>
                <section className="lg:col-span-7 space-y-6">
                  <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white">Transcript</h2>
                      <div className="flex flex-wrap gap-2">
                        {result?.originalText && <button onClick={handleRefineClick} className="text-xs bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-600/30 px-3 py-1.5 rounded-md flex items-center space-x-1"><WandIcon className="w-3 h-3" /><span>Fix Gaps</span></button>}
                        {result?.originalText && <button onClick={handleScientificClick} className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-md flex items-center space-x-1"><AcademicIcon className="w-3 h-3" /><span>Refine Content</span></button>}
                        {result?.originalText && <button onClick={() => handleGenerateMindMap(result.originalText)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md flex items-center space-x-1"><MapIcon className="w-3 h-3" /><span>Visualize</span></button>}
                        {result?.originalText && <button onClick={handleExportReport} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md flex items-center space-x-1"><DownloadIcon className="w-3 h-3" /><span>Export</span></button>}
                      </div>
                    </div>
                    <div className="flex-1 min-h-[200px] p-4 bg-slate-900 rounded-xl border border-slate-700 overflow-y-auto max-h-[300px] mb-6">
                       {result?.originalText ? <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{result.originalText}</p> : <p className="text-slate-600 text-center mt-20">No transcription yet.</p>}
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-4">Translation</h2>
                    <div className="flex-1 min-h-[200px] p-4 bg-slate-900 rounded-xl border border-slate-700 overflow-y-auto max-h-[300px]">
                       {result?.translatedText ? <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{result.translatedText}</p> : <p className="text-slate-600 text-center mt-20">No translation yet.</p>}
                    </div>
                  </div>
                </section>
             </div>
          ) : (
            <Notebook 
              notes={notes}
              activeNoteId={activeNoteId}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              onSelectNote={setActiveNoteId}
              onCreateNote={handleCreateNote}
            />
          )}
        </main>
      </div>

      <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toast.show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3">
          <CheckIcon className="w-4 h-4 text-green-400" />
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      </div>
    </div>
  );
};

export default App;
