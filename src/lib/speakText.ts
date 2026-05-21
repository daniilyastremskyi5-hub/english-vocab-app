export async function speakText(text: string) {
  if (!text) return;

  const apiKey = import.meta.env.VITE_GOOGLE_TTS_KEY;
  if (!apiKey) {
    console.error("Google TTS API key is missing");
    return;
  }

  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: "en-US-Journey-F" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
      }),
    });

    if (!response.ok) {
      console.error("TTS API error:", await response.text());
      return;
    }

    const data = await response.json();
    if (data.audioContent) {
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audio.play().catch(console.error);
    }
  } catch (error) {
    console.error("Failed to play TTS audio", error);
  }
}
