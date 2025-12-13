export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingState {
  status: AppStatus;
  error?: string;
  progress?: number; // 0-100 placeholder for UX
}

export interface TranscriptionResult {
  originalText: string;
  detectedLanguage?: string; // Gemini might provide this if asked, or we assume auto
  translatedText?: string;
  targetLanguage?: string;
}

export interface AudioMetadata {
  blob: Blob;
  url: string;
  name: string;
  duration?: number;
  mimeType: string;
}

export interface LanguageOption {
  code: string;
  name: string;
}