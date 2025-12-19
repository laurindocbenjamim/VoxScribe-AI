
export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type AppView = 'dashboard' | 'notebook';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessingState {
  status: AppStatus;
  error?: string;
  progress?: number; 
}

export interface TranscriptionResult {
  originalText: string;
  detectedLanguage?: string;
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

export type PlanTier = 'free' | 'basic' | 'advanced';

export interface SubscriptionState {
  tier: PlanTier;
  minutesUsed: number;
  maxMinutes: number;
  canTranslate: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isLoggedIn: boolean;
}
