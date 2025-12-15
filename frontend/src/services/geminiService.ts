const API_BASE_URL = "http://localhost:5000/api";

// --- Helper for Errors ---
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server Error: ${response.statusText}`);
  }
  return response.json();
};

// --- Audio Transcription ---

export const transcribeAudio = async (audioBlob: Blob, mimeType: string): Promise<string> => {
  const formData = new FormData();
  // Ensure we send a filename with an extension so Flask/Gemini can detect type if needed
  const ext = mimeType.split('/')[1] || 'mp3';
  formData.append('file', audioBlob, `audio.${ext}`);

  try {
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    const data = await handleResponse(response);
    return data.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

export const transcribeLargeAudio = async (file: Blob): Promise<string> => {
  // Pass through to the backend. 
  // The Python backend now handles large file uploads via the Gemini File API.
  return transcribeAudio(file, file.type || 'audio/mp3');
};

// --- Translation ---

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    const data = await handleResponse(response);
    return data.text || "";
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

export const translateLongText = async (text: string, targetLanguage: string): Promise<string> => {
  // Pass through to backend; it handles context windows efficiently.
  return translateText(text, targetLanguage);
};

// --- Speech Generation (TTS) ---

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceName }),
    });
    const data = await handleResponse(response);
    return data.audioBase64;
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
};

// --- Mind Map ---

export const generateMindMap = async (text: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await handleResponse(response);
    return data.code;
  } catch (error) {
    console.error("Mind Map error:", error);
    throw error;
  }
};

// --- Refinement & Enhancement ---

export const refineTextWithSearch = async (text: string, observation?: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode: 'standard', observation }),
    });
    const data = await handleResponse(response);
    return data.text;
  } catch (error) {
    console.error("Refinement error:", error);
    throw error;
  }
};

export const enhanceScientificText = async (text: string, observation?: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode: 'scientific', observation }),
    });
    const data = await handleResponse(response);
    return data.text;
  } catch (error) {
    console.error("Scientific enhancement error:", error);
    throw error;
  }
};