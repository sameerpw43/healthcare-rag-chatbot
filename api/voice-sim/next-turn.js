import { getNextVoiceTurn } from "../../voiceAgent.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const result = await getNextVoiceTurn();

        res.json({
            success: true,
            speaker: result.speaker,
            text: result.text,
            audio: result.audio.toString("base64"),
            audioMimeType: "audio/mp3",
            isActive: result.isActive,
            turn: result.turn,
            patientMood: result.patientMood,
        });
    } catch (error) {
        console.error("Error getting next voice turn:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
