import { transcribeAudio } from "../../voiceAgent.js";

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
        const transcript = await transcribeAudio(audioBuffer, mimeType);

        res.json({
            success: true,
            transcript,
        });
    } catch (error) {
        console.error("Error transcribing audio:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
