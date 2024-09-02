import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
  const { text, voice_name } = await request.json();
  console.log('Received TTS request:', { text, voice_name });
  // TODO: Implement actual TTS service call here
  // For now, we'll return a mock response
  const mockResponse = {
    samplerate: 22050,
    wav: new Array(22050).fill(0).map(() => Math.random() * 2 - 1), // 1 second of random noise
  };
  console.log('Received TTS request:', {mockResponse});

  return new Response(JSON.stringify(mockResponse), {
    headers: { "Content-Type": "application/json" },
  });
};