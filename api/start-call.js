import {
    startConversation,
} from "../agentModule.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const {
            callScriptPath = "./call-script.txt",
            patientContextPath = "./sample-context.txt",
            patientMood = "cooperative",
            maxTurns = 20,
        } = req.body || {};

        console.log(`Starting new conversation with patient mood: ${patientMood}...`);

        // Start conversation in background
        startConversation(callScriptPath, patientContextPath, patientMood, maxTurns);

        res.json({
            success: true,
            message: "Call started",
            patientMood,
        });
    } catch (error) {
        console.error("Error starting call:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
