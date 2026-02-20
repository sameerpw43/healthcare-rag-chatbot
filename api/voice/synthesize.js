import { synthesizeSpeech } from "../../voiceAgent.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { text, voice = "aura-asteria-en" } = req.body || {};

        if (!text) {
            return res.status(400).json({
                success: false,
                error: "No text provided",
            });
        }

        const audioBuffer = await synthesizeSpeech(text, voice);

        res.json({
            success: true,
            audio: audioBuffer.toString("base64"),
            audioMimeType: "audio/mp3",
        });
    } catch (error) {
        console.error("Error synthesizing speech:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
