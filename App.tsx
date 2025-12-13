import React, { useState, useRef, useEffect } from 'react';
import { transcribeAudio, transcribeLargeAudio, translateText, generateSpeech } from './services/geminiService';
import { AppStatus, ProcessingState, TranscriptionResult, AudioMetadata, LanguageOption } from './types';
import { TARGET_LANGUAGES, VOICE_OPTIONS } from './constants';
import { MicIcon, UploadIcon, StopIcon, DownloadIcon, RefreshIcon, PlayIcon, CheckIcon, ShareIcon, SpeakerIcon, CopyIcon } from './components/Icons';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioMetadata | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [targetLang, setTargetLang] = useState<string>('en'); 
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  
  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Helper to reset app state
  const resetApp = () => {
    setStatus(AppStatus.IDLE);
    setAudioData(null);
    setResult(null);
    setError(null);
    setRecordingDuration(0);
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

  // --- Audio Recording Logic ---
  const startRecording = async () => {
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
          mimeType: 'audio/webm'
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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: Increase hard limit to 100MB since we now have splitting logic.
    // However, browser processing of 100MB+ in memory can be heavy.
    if (file.size > 100 * 1024 * 1024) {
      setError("File size too large. Please upload files under 100MB.");
      return;
    }

    resetApp();
    const url = URL.createObjectURL(file);
    setAudioData({
      blob: file,
      url,
      name: file.name,
      mimeType: file.type || 'audio/mp3' 
    });
  };

  // --- Processing Logic ---
  const handleProcess = async () => {
    if (!audioData) return;

    setStatus(AppStatus.TRANSCRIBING);
    setError(null);
    stopAudioPlayback();

    try {
      let transcript = "";
      
      // Threshold for using splitting logic: 10MB
      // 10MB Base64 encoded is ~13.3MB. 20MB is the safety limit.
      // If file > 10MB, we trigger the robust splitting logic.
      if (audioData.blob.size > 10 * 1024 * 1024) {
        // Large file logic
        transcript = await transcribeLargeAudio(audioData.blob);
      } else {
        // Standard logic
        transcript = await transcribeAudio(audioData.blob, audioData.mimeType);
      }
      
      const intermediateResult: TranscriptionResult = {
        originalText: transcript,
      };
      
      setResult(intermediateResult);
      setStatus(AppStatus.TRANSLATING);

      // 2. Translate (if text exists)
      if (transcript) {
        const selectedLangName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
        const translation = await translateText(transcript, selectedLangName);
        
        setResult({
          ...intermediateResult,
          translatedText: translation,
          targetLanguage: targetLang
        });
      }

      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
      setStatus(AppStatus.ERROR);
    }
  };

  // --- Share Logic ---
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

  // --- Copy Logic ---
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  };

  // --- TTS Logic ---
  const stopAudioPlayback = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handlePlayAudio = async () => {
    if (isPlayingAudio) {
      stopAudioPlayback();
      return;
    }

    if (!result?.translatedText) return;

    setIsGeneratingAudio(true);
    try {
      // 1. Get Base64 Audio
      const base64Audio = await generateSpeech(result.translatedText, selectedVoice);
      
      // 2. Decode Audio
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 3. Create Context & Decode
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
         await audioContextRef.current.resume();
      }

      // Decode PCM data
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const audioBuffer = audioContextRef.current.createBuffer(1, frameCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      // 4. Play
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
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

  // --- Download Helper ---
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioData?.url) URL.revokeObjectURL(audioData.url);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              VoxScribe AI
            </h1>
            <p className="text-slate-400 mt-2">Professional Audio Transcription & Translation</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-2 text-sm text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${status === AppStatus.PROCESSING || status === AppStatus.TRANSCRIBING ? 'bg-amber-400 animate-pulse' : status === AppStatus.COMPLETED ? 'bg-green-400' : 'bg-slate-600'}`}></span>
            <span>Status: {status}</span>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
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
                      className="w-full h-16 flex items-center justify-center space-x-3 rounded-xl bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-400 transition-all group"
                    >
                      <MicIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="font-medium">Start Recording</span>
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
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full h-24 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-700/50 transition-all text-slate-400">
                        <UploadIcon className="w-6 h-6 mb-2" />
                        <span>Upload Audio File (MP3, WAV, M4A)</span>
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
                            {audioData?.blob.size && audioData.blob.size > 10 * 1024 * 1024 && (
                               <p className="text-xs text-amber-400 mt-1">Large file: Will be split & processed</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Target Language</label>
                  <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                  >
                    {TARGET_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Speech Voice</label>
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                  >
                    {VOICE_OPTIONS.map(voice => (
                      <option key={voice.name} value={voice.name}>{voice.label}</option>
                    ))}
                  </select>
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
                <div className="flex space-x-2">
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
                  {result?.originalText && (
                    <button 
                      onClick={() => handleShare(result.originalText)}
                      className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                      title="Share Text"
                    >
                      <ShareIcon className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  )}
                  {result?.originalText && (
                     <button 
                     onClick={() => downloadText(result.originalText, 'transcript.txt')}
                     className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                   >
                     <DownloadIcon className="w-3 h-3" />
                     <span>Save .txt</span>
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
                </div>
                <div className="flex space-x-2">
                  {result?.translatedText && (
                    <button
                      onClick={handlePlayAudio}
                      disabled={isGeneratingAudio}
                      className={`text-xs flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors ${
                        isPlayingAudio 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                      title="Read Aloud"
                    >
                      {isGeneratingAudio ? (
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <SpeakerIcon className="w-3 h-3" />
                      )}
                      <span>{isPlayingAudio ? 'Stop' : 'Listen'}</span>
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
                  {result?.translatedText && (
                    <button 
                      onClick={() => handleShare(result.translatedText || '')}
                      className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                      title="Share Text"
                    >
                      <ShareIcon className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  )}
                  {result?.translatedText && (
                     <button 
                     onClick={() => downloadText(result.translatedText || '', `translation-${targetLang}.txt`)}
                     className="text-xs flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                   >
                     <DownloadIcon className="w-3 h-3" />
                     <span>Save .txt</span>
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