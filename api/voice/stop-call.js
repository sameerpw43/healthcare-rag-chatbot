import { stopVoiceConversation } from "../../voiceAgent.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const result = stopVoiceConversation();
    res.json({
        success: true,
        message: "Voice call stopped",
        ...result,
    });
}
