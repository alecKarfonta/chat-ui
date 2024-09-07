import type { RequestHandler } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const audioData = body.wav;
        console.log('routes/api/stt/ +server.ts: Received STT request:');

        if (!Array.isArray(audioData) || audioData.length === 0) {
            console.log('routes/api/stt/ +server.ts: Invalid audio data provided:', audioData);
            throw error(400, "Invalid audio data provided");
        }

        
        let payload = {
            wav: audioData
        };

        console.log('routes/api/stt/ +server.ts: Sending STT request:', payload);

        const response = await fetch('http://192.168.1.196:8401/transcribe', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });

    } catch (err) {
        console.error("Error in STT processing:", err);
        throw error(500, "Internal server error during speech-to-text processing");
    }
};