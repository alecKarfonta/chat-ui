import { base } from "$app/paths";
import { env } from "$env/dynamic/public";


export async function requestSTT(audioBlob: Blob): Promise<{ text: string }> {
    console.log('requestSTT: audioBlob:');
    // Convert the audio blob to an ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
     // Ensure the buffer size is a multiple of 2
     const bufferSize = Math.floor(arrayBuffer.byteLength / 2) * 2;
     const int16Array = new Int16Array(arrayBuffer.slice(0, bufferSize));
     
    
    // Convert the Int16Array to a regular array of numbers
    const audioData = Array.from(int16Array);
    console.log('requestSTT: ', audioData);

    const response = await fetch(`${env.PUBLIC_ORIGIN}${base}/api/stt`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wav: audioData }),
    });

    if (!response.ok) {
        console.error('Failed to transcribe audio', response);
        throw new Error('Failed to transcribe audio');
    }

    return response.json();
}