import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
  const { text, voice_name } = await request.json();
  console.log('routes/api/tts/ +server.ts: Received TTS request:', { text, voice_name });
  // TODO: Implement actual TTS service call here
  // For now, we'll return a mock response
  //const mockResponse = {
  //  samplerate: 22050,
  //  wav: new Array(22050).fill(0).map(() => Math.random() * 2 - 1), // 1 second of random noise
  //};
  //console.log('Received TTS request:', {mockResponse});

  //return new Response(JSON.stringify(mockResponse), {
  //  headers: { "Content-Type": "application/json" },
  //});
  // If text is empty, return an empty response
  if (text.length === 0) {
    console.log('routes/api/tts/ +server.ts: Text is empty, returning empty response');
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  }


  let payload = {
    text: text,
    voice_name: voice_name,
  };

  console.log('routes/api/tts/ +server.ts: text = ', text);
  console.log('routes/api/tts/ +server.ts: Sending TTS request:', payload);

  const response = await fetch('http://192.168.1.196:8001/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  //console.log('routes/api/tts/ +server.ts: Received TTS response:', data);

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};