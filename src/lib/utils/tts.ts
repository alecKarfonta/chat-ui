import { base } from "$app/paths";

interface TTSRequest {
  text: string;
  voice_name: string;
}

interface TTSResponse {
  samplerate: number;
  wav: number[];
}

export async function requestTTS(text: string, voice_name: string): Promise<TTSResponse> {
  const response = await fetch(`${base}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice_name }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch TTS data');
  }

  return response.json();
}

export function splitIntoSentences(text: string): string[] {
  return text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
}