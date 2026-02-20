import { stopVoiceSimulation, saveVoiceConversation } from "../../voiceAgent.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const result = stopVoiceSimulation();

        res.json({
            success: true,
            message: "Voice simulation stopped",
            ...result,
        });
    } catch (error) {
        console.error("Error stopping voice simulation:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
