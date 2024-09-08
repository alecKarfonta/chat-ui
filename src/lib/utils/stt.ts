import { base } from "$app/paths";
import { env } from "$env/dynamic/public";


export async function requestSTT(audioBlob: Blob): Promise<{ text: string }> {
    console.log('requestSTT: audioBlob:');
    // Create an AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Convert the audio blob to an ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Convert to mono and resample to 16kHz
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // Convert to 16-bit integer samples
    const floatSamples = renderedBuffer.getChannelData(0);
    const intSamples = new Int16Array(floatSamples.length);

    for (let i = 0; i < floatSamples.length; i++) {
        const s = Math.max(-1, Math.min(1, floatSamples[i]));
        intSamples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const audioData = Array.from(intSamples);
    
    console.log('requestSTT: audioData length:', audioData.length);
    console.log('requestSTT: First 10 samples:', audioData.slice(0, 10));


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