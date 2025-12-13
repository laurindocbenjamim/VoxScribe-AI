import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_MODEL_TRANSCRIPTION, GEMINI_MODEL_TRANSLATION, GEMINI_MODEL_TTS, SAMPLE_RATE } from "../constants";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- WAV Encoding Helpers ---

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count (mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // write the PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
};

// --- Audio Processing Logic ---

/**
 * Transcribes audio using Gemini 2.5 Flash
 */
export const transcribeAudio = async (audioBlob: Blob, mimeType: string): Promise<string> => {
  const ai = getAiClient();
  const base64Audio = await blobToBase64(audioBlob);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TRANSCRIPTION,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Please transcribe this audio exactly as spoken. Return ONLY the transcript text. Do not add any introduction, timestamps, or markdown formatting."
          }
        ]
      }
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio.");
  }
};

/**
 * Handling for large files: Decodes, Resamples to 16kHz Mono, splits into chunks, and transcribes sequentially.
 */
export const transcribeLargeAudio = async (file: Blob): Promise<string> => {
  try {
    // 1. Decode Audio (using browser native API to get raw PCM)
    // We force a 16kHz context to downsample high-res audio and save space
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // 2. Configure Chunking
    // 5 minutes per chunk @ 16kHz 16-bit mono = ~9.6 MB raw PCM -> ~13 MB Base64.
    // This fits safely within the ~20MB inline data limit.
    const CHUNK_DURATION_SEC = 300; 
    const totalDuration = audioBuffer.duration;
    const totalChannels = audioBuffer.numberOfChannels;
    const pcmData = audioBuffer.getChannelData(0); // Use first channel (mono mixdown effectively if we just take one, or average them)
    
    let fullTranscript = "";
    
    // 3. Process Chunks
    for (let startTime = 0; startTime < totalDuration; startTime += CHUNK_DURATION_SEC) {
      const endTime = Math.min(startTime + CHUNK_DURATION_SEC, totalDuration);
      const startSample = Math.floor(startTime * SAMPLE_RATE);
      const endSample = Math.floor(endTime * SAMPLE_RATE);
      
      const chunkSamples = pcmData.slice(startSample, endSample);
      const wavBlob = encodeWAV(chunkSamples, SAMPLE_RATE);
      
      // Transcribe this chunk
      const chunkTranscript = await transcribeAudio(wavBlob, 'audio/wav');
      fullTranscript += " " + chunkTranscript;
    }
    
    audioContext.close();
    return fullTranscript.trim();

  } catch (error) {
    console.error("Large file processing error:", error);
    throw new Error("Failed to process large audio file. It might be corrupt or too complex to decode.");
  }
};


export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TRANSLATION,
      contents: `Translate the following text into ${targetLanguage}. Return ONLY the translated text without additional commentary:\n\n${text}`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate text.");
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TTS,
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from the model.");
    }
    return base64Audio;
  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Failed to generate speech.");
  }
};