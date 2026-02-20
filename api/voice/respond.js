import { processVoiceInput } from "../../voiceAgent.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { audio, mimeType = "audio/wav" } = req.body || {};

        if (!audio) {
            return res.status(400).json({
                success: false,
                error: "No audio data provided",
            });
        }

        const audioBuffer = Buffer.from(audio, "base64");
        const result = await processVoiceInput(audioBuffer, mimeType);

        res.json({
            success: true,
            userText: result.userText,
            avaText: result.avaText,
            audio: result.audio.toString("base64"),
            audioMimeType: "audio/mp3",
            isActive: result.isActive,
        });
    } catch (error) {
        console.error("Error processing voice input:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
