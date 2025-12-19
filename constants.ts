import { LanguageOption } from './types';

// Updated models to use Gemini 3 series for better performance and compliance with guidelines
export const GEMINI_MODEL_TRANSCRIPTION = 'gemini-3-flash-preview'; 
export const GEMINI_MODEL_TRANSLATION = 'gemini-3-flash-preview';
export const GEMINI_MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
];

export const VOICE_OPTIONS = [
  { name: 'Puck', label: 'Puck' },
  { name: 'Charon', label: 'Charon' },
  { name: 'Kore', label: 'Kore' },
  { name: 'Fenrir', label: 'Fenrir' },
  { name: 'Zephyr', label: 'Zephyr' },
];

export const SAMPLE_RATE = 16000; // Optimal for speech recognition