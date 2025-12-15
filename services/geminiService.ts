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
 * Handling for large files: Uses Gemini File API to upload and process files > 20MB or long duration.
 * This prevents browser crashes caused by decoding large AudioBuffers in memory.
 */
export const transcribeLargeAudio = async (file: Blob): Promise<string> => {
  const ai = getAiClient();

  // If file is reasonably small (under 20MB), use the faster inline method
  if (file.size < 20 * 1024 * 1024) {
      return transcribeAudio(file, file.type || 'audio/mp3');
  }

  try {
    // 1. Upload to Gemini File API
    // The SDK handles the upload of the Blob directly
    const uploadResponse = await ai.files.upload({
      file: file,
      config: { 
          displayName: `Audio Upload ${new Date().toISOString()}`,
          mimeType: file.type || 'audio/mp3'
      }
    });

    const fileUri = uploadResponse.file.uri;
    const fileName = uploadResponse.file.name;

    // 2. Poll for processing completion
    // Large files take a moment to change state from PROCESSING to ACTIVE
    let fileState = uploadResponse.file.state;
    while (fileState === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const getResponse = await ai.files.get({ name: fileName });
      fileState = getResponse.file.state;
      if (fileState === 'FAILED') {
        throw new Error("Audio processing failed on the server.");
      }
    }

    // 3. Generate Transcription using the file URI
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TRANSCRIPTION,
      contents: {
        parts: [
          { 
            fileData: { 
              fileUri: fileUri, 
              mimeType: uploadResponse.file.mimeType 
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
    console.error("Large file transcription error:", error);
    throw new Error("Failed to process large audio file. Please try a smaller file or ensure your internet connection is stable.");
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

/**
 * Translates long text by chunking it to avoid token limits.
 */
export const translateLongText = async (text: string, targetLanguage: string): Promise<string> => {
  // Rough chunk size (characters) to stay safely within output limits
  const CHUNK_SIZE = 8000; 
  if (text.length <= CHUNK_SIZE) {
    return translateText(text, targetLanguage);
  }

  // Split by logical paragraphs to avoid cutting sentences
  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk.length + para.length) > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
    currentChunk += (currentChunk ? "\n\n" : "") + para;
  }
  if (currentChunk) chunks.push(currentChunk);

  // Translate chunks sequentially
  let fullTranslation = "";
  for (const chunk of chunks) {
    const translatedChunk = await translateText(chunk, targetLanguage);
    fullTranslation += (fullTranslation ? "\n\n" : "") + translatedChunk;
  }

  return fullTranslation;
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

export const generateMindMap = async (text: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `
      Create a concept map/mind map based on the following text using strictly Mermaid.js 'mindmap' syntax.

      Rules for the output:
      1. Start with the keyword 'mindmap' on the first line.
      2. Use indentation (2 spaces or 4 spaces) to define the hierarchy.
      3. Important: If any node text contains parentheses '()' or special characters, you MUST enclose the text in double quotes. 
         Example: "Lucy (Australopithecus)"
      4. Do not use Markdown code fences (no \`\`\`mermaid). Return only the raw code.
      5. Keep labels concise.
      
      Text to visualize:
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    let result = response.text?.trim() || "";
    // Clean up if the model still wrapped it in markdown
    result = result.replace(/^```mermaid\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
    return result;
  } catch (error) {
    console.error("Mind Map generation error:", error);
    throw new Error("Failed to generate mind map.");
  }
};

export const refineTextWithSearch = async (text: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `
      Please review the following transcript. It may contain errors, gaps, or misheard terms.
      Use your knowledge and search tools to correct grammar, fill in logical gaps, and verify proper nouns or technical terms.
      
      Return ONLY the corrected and refined text.
      
      Transcript:
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      }
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Refinement error:", error);
    throw new Error("Failed to refine text.");
  }
};

export const enhanceScientificText = async (text: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const prompt = `
      You are an expert scientific editor and researcher. Review the transcript below to create a high-quality, scientifically rigorous document.

      Your Tasks:
      1.  **Scientific Accuracy & Correction**: Heavily scrutinize the text for scientific errors, incorrect definitions, or fallacious arguments. 
          - If a definition is wrong, FIX IT with the correct scientific definition.
          - If an argument is flawed, correct the logic.
          - If technical terms are misheard, replace them with the correct terminology.
      2.  **Deep Search**: Use the Google Search tool to verify complex claims, data, or definitions. Ensure the information is up-to-date and accurate.
      3.  **IEEE Citations**: If (and ONLY if) you find it necessary to use external information from search results to support a corrected claim, definition, or specific fact, insert an IEEE citation [x] in the text.
      4.  **Formatting**: Output a clean, well-structured scientific document using Markdown headers (##, ###). Use bolding for key terms.
      
      REQUIRED SECTIONS AT THE END:
      
      ## Errata & Corrections
      (You MUST include this section. List the specific scientific errors found in the original transcript and how you fixed them. Be specific. e.g., "Corrected the definition of 'entropy' which was described as energy, to 'a measure of disorder'.")

      ## References
      (Include this section ONLY if you used citations in the text. List them in IEEE format with clickable Markdown links: [1] Author, "[Title](URL)", Source, Year.)

      Transcript to process:
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      }
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Scientific enhancement error:", error);
    throw new Error("Failed to enhance scientific text.");
  }
};