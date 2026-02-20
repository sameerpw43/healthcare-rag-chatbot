import { stopConversation } from "../agentModule.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    stopConversation();
    res.json({
        success: true,
        message: "Call stopped",
    });
}
