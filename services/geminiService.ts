import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_MODEL_TRANSCRIPTION, GEMINI_MODEL_TRANSLATION, GEMINI_MODEL_TTS } from "../constants";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. System configuration error.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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

export const transcribeLargeAudio = async (file: Blob): Promise<string> => {
  // In a real browser environment without the File API upload endpoint, 
  // we would chunk or use inlineData if < 20MB.
  return transcribeAudio(file, file.type || 'audio/mp3');
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

export const translateLongText = async (text: string, targetLanguage: string): Promise<string> => {
  return translateText(text, targetLanguage);
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TTS,
      contents: { parts: [{ text: text }] },
      config: {
        responseModalalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned.");
    return base64Audio;
  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Failed to generate speech.");
  }
};

export const generateMindMap = async (text: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `Create a concept map based on the following text using strictly Mermaid.js 'mindmap' syntax. Start with 'mindmap'. No markdown fences. Quote nodes with special chars. Text: "${text}"`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim().replace(/^```mermaid\n?/, '').replace(/```$/, '') || "";
  } catch (error) {
    console.error("Mind Map error:", error);
    throw new Error("Failed to generate mind map.");
  }
};

export const refineTextWithSearch = async (text: string, observation?: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `Review and refine the following transcript for errors and gaps. ${observation ? `Context: ${observation}` : ''} Return ONLY the refined text. Transcript: "${text}"`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Refinement error:", error);
    throw new Error("Failed to refine text.");
  }
};

export const enhanceScientificText = async (text: string, observation?: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `Refine this transcript into a high-quality scientific document with IEEE citations and grounding. ${observation ? `Context: ${observation}` : ''} Include sections for Errata & Corrections and References. Transcript: "${text}"`;
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Scientific enhancement error:", error);
    throw new Error("Failed to enhance scientific text.");
  }
};
