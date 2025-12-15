import React, { useState, useRef, useEffect } from 'react';
import { transcribeAudio, transcribeLargeAudio, translateText, translateLongText, generateSpeech, generateMindMap, refineTextWithSearch, enhanceScientificText } from './services/geminiService';
import { getSubscription, addUsageMinutes, checkLimits, upgradePlan } from './services/subscriptionService';
import { getCurrentUser, login, signup, logout, loginWithProvider } from './services/authService';
import { AppStatus, ProcessingState, TranscriptionResult, AudioMetadata, LanguageOption, SubscriptionState, PlanTier, User } from './types';
import { TARGET_LANGUAGES, VOICE_OPTIONS } from './constants';
import { MicIcon, UploadIcon, StopIcon, DownloadIcon, RefreshIcon, PlayIcon, CheckIcon, ShareIcon, SpeakerIcon, CopyIcon, LockIcon, SparklesIcon, MapIcon, WandIcon, AcademicIcon } from './components/Icons';
import AudioVisualizer from './components/AudioVisualizer';
import PricingModal from './components/PricingModal';
import MindMapModal from './components/MindMapModal';
import RefinementModal from './components/RefinementModal';
import AuthModal from './components/AuthModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [showOnboardingPlans, setShowOnboardingPlans] = useState(false);

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
    // Check for existing session
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setShowAuth(false);
    }
    // Refresh subscription on load
    setSubscription(getSubscription());
  }, []);

  // Update playback rate dynamically if playing
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
        // Update subscription in case it's a developer or returning user with stored state
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
        // Show plans immediately after signup, UNLESS it is the dev user
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
        // Show plans immediately after signup/login first time
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

  // Helper to reset app state
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
    // Cleanup existing blobs
    if (audioData?.url) {
      URL.revokeObjectURL(audioData.url);
    }
  };

  // Helper to show toast
  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Helper to get audio duration
  const getAudioDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      // Fallback for types that might fail metadata load quickly
      setTimeout(() => resolve(0), 1000); 
    });
  };

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    // Check limits before starting (approximating 1 second to start)
    if (!checkLimits(subscription, 1)) {
        setShowPricing(true);
        // We set error to null because showing pricing modal is the action
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
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioData({
          blob,
          url,
          name: `recording-${new Date().toISOString()}.webm`,
          mimeType: 'audio/webm',
          duration: recordingDuration // We know duration from timer
        });
        setStatus(AppStatus.IDLE);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(AppStatus.RECORDING);
      
      // Start Timer
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // --- File Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // No hard 100MB limit for upload here, let the service handle large file logic via File API
    // But we might want a reasonable sanity check e.g. 2GB
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

  // --- Processing Logic ---
  const handleProcess = async () => {
    if (!audioData) return;

    // 1. Check Usage Limits
    const estimatedDuration = audioData.duration || 60; // Fallback 1 min if unknown
    if (!checkLimits(subscription, estimatedDuration)) {
        setShowPricing(true);
        setError("Usage limit reached. Please update your plan to continue.");
        return;
    }

    setStatus(AppStatus.TRANSCRIBING);
    setError(null);
    stopAudioPlayback();
    setGeneratedAudioBase64(null); // Reset audio when reprocessing
    setCurrentPlayingText(null);
    setMindMapCode(null);
    setVisualizedText(null);
    setRefinedText(null);

    try {
      let transcript = "";
      
      // Use transcribeLargeAudio which now smartly handles large files via File API
      transcript = await transcribeLargeAudio(audioData.blob);
      
      // 2. Deduct Usage
      const newSubState = addUsageMinutes(estimatedDuration);
      setSubscription(newSubState);

      const intermediateResult: TranscriptionResult = {
        originalText: transcript,
      };
      
      setResult(intermediateResult);
      setStatus(AppStatus.TRANSLATING);

      // 3. Translate (if text exists AND allowed)
      if (transcript) {
        if (targetLang !== 'en' && !subscription.canTranslate) {
            // Skip translation if not allowed, but keep transcript
            setResult({
                ...intermediateResult,
                translatedText: "Upgrade to Advanced Plan to unlock translation.",
                targetLanguage: targetLang
            });
        } else {
            const selectedLangName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
            // Use new translateLongText to handle larger payloads safely
            const translation = await translateLongText(transcript, selectedLangName);
            
            setResult({
              ...intermediateResult,
              translatedText: translation,
              targetLanguage: targetLang
            });
        }
      }

      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
      setStatus(AppStatus.ERROR);
    }
  };

  // --- Export Report Logic ---
  const handleExportReport = () => {
    if (!result) return;
    
    const timestamp = new Date().toLocaleString();
    const content = `
VOXSCRIBE AI - TRANSCRIPTION REPORT
Date: ${timestamp}
File: ${audioData?.name || 'Recording'}
Duration: ${audioData?.duration ? formatTime(audioData.duration) : 'Unknown'}
Target Language: ${TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}

---------------------------------------------------
ORIGINAL TRANSCRIPT
---------------------------------------------------
${result.originalText || "(No transcript available)"}

---------------------------------------------------
TRANSLATION (${targetLang.toUpperCase()})
---------------------------------------------------
${result.translatedText || "(No translation available)"}

---------------------------------------------------
Generated by VoxScribe AI
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoxScribe_Report_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Plan Upgrade Logic ---
  const handleUpgrade = (tier: PlanTier) => {
    const newState = upgradePlan(tier);
    setSubscription(newState);
    showToast(`Successfully upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan!`);
    // Close modals
    setShowPricing(false);
    setShowOnboardingPlans(false);
  };

  // --- Share/Copy Logic ---
  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: text,
        });
      } catch (err) {
        // Share cancelled
      }
    } else {
      navigator.clipboard.writeText(text);
      showToast("Copied to clipboard!");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  };

  // --- Refinement Logic ---
  const handleRefineText = async () => {
    const textToRefine = result?.originalText;
    if (!textToRefine) return;

    setRefinementType('standard');
    try {
        if (!refinedText) {
            setStatus(AppStatus.PROCESSING);
            const corrected = await refineTextWithSearch(textToRefine);
            setRefinedText(corrected);
            setStatus(AppStatus.COMPLETED);
        }
        setIsRefinementModalOpen(true);
    } catch (err: any) {
        setError("Failed to refine text. Please try again.");
        setStatus(AppStatus.COMPLETED);
    }
  };
  
  const handleScientificEnhance = async () => {
    const textToRefine = result?.originalText;
    if (!textToRefine) return;

    setRefinementType('scientific');
    try {
        // Always regenerate for scientific enhancement as it's a specific action
        setStatus(AppStatus.PROCESSING);
        const enhanced = await enhanceScientificText(textToRefine);
        setRefinedText(enhanced);
        setStatus(AppStatus.COMPLETED);
        setIsRefinementModalOpen(true);
    } catch (err: any) {
        setError("Failed to enhance scientific text. Please try again.");
        setStatus(AppStatus.COMPLETED);
    }
  };

  const handleRegenerateRefinement = async () => {
    const textToRefine = result?.originalText;
    if (!textToRefine) return;

    setIsRegeneratingRefinement(true);
    
    try {
        let corrected = "";
        if (refinementType === 'scientific') {
            corrected = await enhanceScientificText(textToRefine);
        } else {
            corrected = await refineTextWithSearch(textToRefine);
        }
        setRefinedText(corrected);
        // If we are currently playing the old text, stop it
        if (isPlayingAudio && currentPlayingText === refinedText) {
            stopAudioPlayback();
        }
    } catch (err: any) {
        setError("Failed to regenerate refined text.");
    } finally {
        setIsRegeneratingRefinement(false);
    }
  };

  // --- Mind Map Logic ---
  const handleGenerateMindMap = async (text: string) => {
    if (!text) return;
    
    // Close refinement modal if open to show map
    if (isRefinementModalOpen) setIsRefinementModalOpen(false);

    try {
        // Only regenerate if the text is different from what we last visualized
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

  // --- TTS Logic ---
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
      // If pressing play on the same text, just stop.
      // If pressing play on different text, stop current and start new.
      if (text === currentPlayingText) {
          return; 
      }
    }

    if (!text) return;

    setIsGeneratingAudio(true);
    setCurrentPlayingText(text);

    try {
      let base64Audio = generatedAudioBase64;
      
      // If text is different from what we generated before, we must regenerate
      // We are only caching one audio for simplicity (or strictly playing one at a time)
      if (text !== currentPlayingText || !base64Audio) {
          base64Audio = await generateSpeech(text, selectedVoice);
          setGeneratedAudioBase64(base64Audio); // Cache this session
      }

      if (!base64Audio) return;
      
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
         await audioContextRef.current.resume();
      }

      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const audioBuffer = audioContextRef.current.createBuffer(1, frameCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate; // Apply Speed
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
    // We need to ensure we have the audio data for the *specific* text requested.
    // If it matches cache, use it, otherwise generate temp.
    let base64ToDownload = generatedAudioBase64;

    if (text !== currentPlayingText || !base64ToDownload) {
        // Generate on the fly if we haven't played it or it's different
        try {
            base64ToDownload = await generateSpeech(text, selectedVoice);
        } catch (e) {
            setError("Failed to generate audio for download.");
            return;
        }
    }

    if (!base64ToDownload) return;
    
    const binaryString = atob(base64ToDownload);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
       bytes[i] = binaryString.charCodeAt(i);
    }
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32Samples = new Float32Array(dataInt16.length);
    for(let i=0; i<dataInt16.length; i++) {
        float32Samples[i] = dataInt16[i] / 32768.0;
    }

    // WAV Header construction
    const buffer = new ArrayBuffer(44 + float32Samples.length * 2);
    const view = new DataView(buffer);
    const sampleRate = 24000;
    
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Usage Bar Component
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
                <div 
                    className={`h-2 rounded-full transition-all duration-500 ${isLow ? 'bg-amber-500' : 'bg-blue-500'}`} 
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
            {subscription.tier === 'free' && !isDevUser && (
                <button onClick={() => setShowPricing(true)} className="text-xs text-blue-400 hover:text-blue-300 mt-2 w-full text-center">
                    Upgrade to remove limits
                </button>
            )}
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      {/* Auth Modal */}
      {showAuth && !user && (
         <AuthModal 
            onLogin={handleLogin} 
            onSignup={handleSignup} 
            onSocialLogin={handleSocialLogin}
         />
      )}

      {/* Onboarding Plan Selection */}
      {showOnboardingPlans && !isDevUser && (
         <PricingModal 
            currentTier={'free'} // Technically they are free until they pick one
            onUpgrade={handleUpgrade}
            onClose={() => {}} // Can't close without picking
            isOnboarding={true}
         />
      )}

      {/* Standard Pricing Modal */}
      {showPricing && !showOnboardingPlans && !isDevUser && (
          <PricingModal 
            currentTier={subscription.tier} 
            onUpgrade={handleUpgrade} 
            onClose={() => setShowPricing(false)} 
          />
      )}
      
      {isMindMapModalOpen && mindMapCode && (
        <MindMapModal 
            mermaidCode={mindMapCode} 
            onClose={() => setIsMindMapModalOpen(false)} 
        />
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
            isRegenerating={isRegeneratingRefinement}
            isPlaying={isPlayingAudio && currentPlayingText === refinedText}
            isGeneratingAudio={isGeneratingAudio && currentPlayingText === refinedText}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                VoxScribe AI
                </h1>
                {subscription.tier === 'advanced' && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs border border-purple-500/50 flex items-center">
                        <SparklesIcon className="w-3 h-3 mr-1" /> PRO
                    </span>
                )}
            </div>
            <p className="text-slate-400 mt-2">Professional Audio Transcription & Translation</p>
          </div>
          
          <div className="flex flex-col items-end space-y-3">
             <div className="flex items-center space-x-4">
                {user && (
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-300 hidden sm:block">{user.email}</span>
                        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 ml-2">Logout</button>
                    </div>
                )}
             </div>
            <UsageBar />
            <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${status === AppStatus.PROCESSING || status === AppStatus.TRANSCRIBING ? 'bg-amber-400 animate-pulse' : status === AppStatus.COMPLETED ? 'bg-green-400' : 'bg-slate-600'}`}></span>
                <span>Status: {status}</span>
            </div>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className={`grid grid-cols-1 lg:grid-cols-12 gap-8 ${(showAuth || showOnboardingPlans) ? 'blur-sm pointer-events-none' : ''}`}>
          
          {/* Left Column: Input Controls */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Input Card */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 text-white">Audio Source</h2>
              
              {/* Tabs / Toggle (Visual only since we switch context based on action) */}
              <div className="mb-6">
                {!audioData && !isRecording ? (
                  <div className="space-y-4">
                    {/* Record Button */}
                    <button 
                      onClick={startRecording}
                      disabled={subscription.minutesUsed >= subscription.maxMinutes}
                      className={`w-full h-16 flex items-center justify-center space-x-3 rounded-xl border transition-all group
                        ${subscription.minutesUsed >= subscription.maxMinutes 
                            ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed' 
                            : 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20 text-red-400'}
                      `}
                    >
                      {subscription.minutesUsed >= subscription.maxMinutes ? (
                          <span className="flex items-center"><LockIcon className="w-5 h-5 mr-2"/> Limit Reached</span>
                      ) : (
                          <>
                            <MicIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Start Recording</span>
                          </>
                      )}
                    </button>

                    <div className="flex items-center justify-center text-slate-500 text-sm">
                      <span className="px-2 bg-slate-800">OR</span>
                    </div>

                    {/* Upload Area */}
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileUpload}
                        disabled={subscription.minutesUsed >= subscription.maxMinutes}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                      />
                      <div className={`w-full h-24 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all
                         ${subscription.minutesUsed >= subscription.maxMinutes 
                            ? 'border-slate-700 bg-slate-800 text-slate-600' 
                            : 'border-slate-600 hover:border-blue-500 hover:bg-slate-700/50 text-slate-400'}
                      `}>
                        {subscription.minutesUsed >= subscription.maxMinutes ? (
                             <div className="flex flex-col items-center">
                                 <LockIcon className="w-6 h-6 mb-2" />
                                 <span>Upgrade to upload more</span>
                             </div>
                        ) : (
                            <>
                                <UploadIcon className="w-6 h-6 mb-2" />
                                <span>Upload Audio File (MP3, WAV, M4A)</span>
                            </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Active State (Recording or File Loaded)
                  <div className="space-y-4">
                    {isRecording ? (
                      <div className="flex flex-col items-center space-y-4 py-4">
                        <div className="text-4xl font-mono text-red-400 animate-pulse">
                          {formatTime(recordingDuration)}
                        </div>
                        <AudioVisualizer isRecording={isRecording} stream={streamRef.current} />
                        <button 
                          onClick={stopRecording}
                          className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold transition-colors shadow-lg shadow-red-500/25"
                        >
                          <StopIcon />
                          <span>Stop Recording</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-blue-400 uppercase tracking-wider">File Ready</span>
                          <button onClick={resetApp} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700">
                            <RefreshIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                            <MicIcon />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate text-white">{audioData?.name}</p>
                            <p className="text-xs text-slate-500 uppercase">{audioData?.mimeType.split('/')[1]}</p>
                            {audioData?.blob.size && audioData.blob.size > 15 * 1024 * 1024 && (
                               <p className="text-xs text-amber-400 mt-1">Large file: Will be processed via Cloud Storage</p>
                            )}
                          </div>
                        </div>
                        <audio controls src={audioData?.url} className="w-full h-8 opacity-80" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Settings Area */}
              <div className="pt-4 border-t border-slate-700 space-y-4">
                
                {/* Language Selection */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-2">
                     <label className="block text-sm font-medium text-slate-300">Target Language</label>
                     {!subscription.canTranslate && (
                         <button onClick={() => setShowPricing(true)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center">
                             <LockIcon className="w-3 h-3 mr-1"/> Unlock Translation
                         </button>
                     )}
                  </div>
                  <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                  >
                    {TARGET_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                          {lang.name} {(!subscription.canTranslate && lang.code !== 'en') ? '(Locked)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice Selection & Speed */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Speech Voice</label>
                  <div className="flex space-x-4">
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                      >
                        {VOICE_OPTIONS.map(voice => (
                          <option key={voice.name} value={voice.name}>{voice.label}</option>
                        ))}
                      </select>
                      
                      {/* Speed Control */}
                      <div className="flex items-center space-x-2 bg-slate-900 border border-slate-600 rounded-lg px-2">
                         <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Speed: {playbackRate}x</span>
                         <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.25" 
                            value={playbackRate}
                            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                         />
                      </div>
                  </div>
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!audioData || isRecording || status === AppStatus.PROCESSING || status === AppStatus.TRANSCRIBING}
                  className={`mt-6 w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center space-x-2
                    ${(!audioData || isRecording) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25'}
                  `}
                >
                   {status === AppStatus.TRANSCRIBING || status === AppStatus.TRANSLATING ? (
                     <>
                       <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                       <span>Processing...</span>
                     </>
                   ) : (
                     <>
                       <PlayIcon className="w-5 h-5" />
                       <span>Transcribe & Translate</span>
                     </>
                   )}
                </button>
                
                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: Results */}
          <section className="lg:col-span-7 space-y-6">
            {/* Transcription Result */}
            <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Transcript</h2>
                <div className="flex flex-wrap gap-2">
                  {/* Refine/Fix Button */}
                  {result?.originalText && (
                      <button 
                        onClick={handleRefineText}
                        className="text-xs flex items-center space-x-1 bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-600/30 px-3 py-1.5 rounded-md transition-colors"
                        title="Fix Gaps with Deep Search"
                      >
                        <WandIcon className="w-3 h-3" />
                        <span>Fix Gaps</span>
                      </button>
                  )}
                  {result?.originalText && (
                      <button 
                        onClick={handleScientificEnhance}
                        className="text-xs flex items-center space-x-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-md transition-colors"
                        title="Enhance with IEEE Citations & Links"
                      >
                        <AcademicIcon className="w-3 h-3" />
                        <span>Refine Content</span>
                      </button>
                  )}
                  {result?.originalText && (
                      <button 
                        onClick={() => handleGenerateMindMap(result.originalText)}
                        className="text-xs flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors"
                        title="Visualize with Mind Map"
                      >
                        <MapIcon className="w-3 h-3" />
                        <span>Visualize</span>
                      </button>
                  )}
                  {/* New Export Button */}
                  {result?.originalText && (
                      <button 
                        onClick={handleExportReport}
                        className="text-xs flex items-center space-x-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md transition-colors"
                        title="Export Full Report"
                      >
                        <DownloadIcon className="w-3 h-3" />
                        <span>Export Report</span>
                      </button>
                  )}
                  {result?.originalText && (
                    <button 
                      onClick={() => handleCopy(result.originalText)}
                      className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                      title="Copy Text"
                    >
                      <CopyIcon className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 min-h-[200px] p-4 bg-slate-900 rounded-xl border border-slate-700 overflow-y-auto max-h-[300px] mb-6">
                 {result?.originalText ? (
                   <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{result.originalText}</p>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                      <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                      <div className="w-8 h-1 bg-slate-700 rounded-full"></div>
                      <p className="text-sm">No transcription yet.</p>
                   </div>
                 )}
              </div>

              {/* Translation Result */}
              <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-700">
                <div className="flex items-center space-x-2">
                   <h2 className="text-xl font-semibold text-white">Translation</h2>
                   <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase font-bold">
                     {targetLang}
                   </span>
                   {result?.translatedText === "Upgrade to Advanced Plan to unlock translation." && (
                       <button onClick={() => setShowPricing(true)} className="ml-2 text-purple-400 hover:text-white">
                           <SparklesIcon className="w-4 h-4" />
                       </button>
                   )}
                </div>
                <div className="flex space-x-2">
                  {/* Listen Button */}
                  {result?.translatedText && result.translatedText !== "Upgrade to Advanced Plan to unlock translation." && (
                    <button
                      onClick={() => handlePlayAudio(result.translatedText || '')}
                      disabled={isGeneratingAudio}
                      className={`text-xs flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors ${
                        isPlayingAudio && currentPlayingText === result.translatedText
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                      title="Read Aloud"
                    >
                      {isGeneratingAudio && currentPlayingText === result.translatedText ? (
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <SpeakerIcon className="w-3 h-3" />
                      )}
                      <span>{isPlayingAudio && currentPlayingText === result.translatedText ? 'Stop' : 'Listen'}</span>
                    </button>
                  )}
                  
                  {/* Visualize Button for Translation */}
                  {result?.translatedText && result.translatedText !== "Upgrade to Advanced Plan to unlock translation." && (
                      <button 
                        onClick={() => handleGenerateMindMap(result.translatedText || "")}
                        className="text-xs flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors"
                        title="Visualize Translation"
                      >
                        <MapIcon className="w-3 h-3" />
                        <span>Visualize</span>
                      </button>
                  )}
                  
                  {/* Audio Download Button */}
                  {generatedAudioBase64 && !isGeneratingAudio && (
                     <button
                        onClick={() => handleDownloadAudio(result.translatedText || '')}
                        className="text-xs flex items-center space-x-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 px-3 py-1.5 rounded-md transition-colors"
                        title="Download Audio"
                     >
                        <DownloadIcon className="w-3 h-3" />
                        <span>MP3</span>
                     </button>
                  )}

                  {result?.translatedText && (
                    <button 
                      onClick={() => handleCopy(result.translatedText || '')}
                      className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                      title="Copy Text"
                    >
                      <CopyIcon className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 min-h-[200px] p-4 bg-slate-900 rounded-xl border border-slate-700 overflow-y-auto max-h-[300px]">
                 {result?.translatedText ? (
                   <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{result.translatedText}</p>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                      <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                      <div className="w-8 h-1 bg-slate-700 rounded-full"></div>
                      <p className="text-sm">No translation yet.</p>
                   </div>
                 )}
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Toast Notification */}
      <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3">
          <div className="bg-green-500/20 p-1 rounded-full">
            <CheckIcon className="w-4 h-4 text-green-400" />
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      </div>
    </div>
  );
};

export default App;