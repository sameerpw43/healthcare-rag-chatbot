import { startVoiceConversation } from "../../voiceAgent.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { callScriptPath = "./call-script.txt" } = req.body || {};

        console.log("Starting new voice conversation...");

        const result = await startVoiceConversation(callScriptPath);

        res.json({
            success: true,
            message: "Voice call started",
            greeting: result.text,
            audio: result.audio.toString("base64"),
            audioMimeType: "audio/mp3",
        });
    } catch (error) {
        console.error("Error starting voice call:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
