
# VoxScribe AI Backend

This is the Python/Flask backend for VoxScribe AI. It handles intensive AI tasks using the Google Gemini API.

## Setup Instructions

1. **Prerequisites**:
   - Python 3.10 or higher.
   - An API Key from [Google AI Studio](https://aistudio.google.com/).

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   API_KEY=your_gemini_api_key_here
   ```

4. **Run the Server**:
   ```bash
   python app.py
   ```
   The server will start on `http://localhost:5000`.

## API Endpoints

- `POST /api/transcribe`: Upload audio for transcription.
- `POST /api/translate`: Translate text to target language.
- `POST /api/generate-speech`: Convert text to base64 audio.
- `POST /api/generate-mindmap`: Generate Mermaid.js mindmap code.
- `POST /api/refine`: Intelligent text refinement (Standard/Scientific).
