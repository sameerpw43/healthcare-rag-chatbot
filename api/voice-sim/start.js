import {
    startVoiceSimulation,
} from "../../voiceAgent.js";

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
            avaVoice = "aura-asteria-en",
            patientVoice = "aura-orion-en",
        } = req.body || {};

        console.log(`Starting AI-to-AI voice simulation with patient mood: ${patientMood}, Ava: ${avaVoice}, Patient: ${patientVoice}...`);

        const result = await startVoiceSimulation(
            callScriptPath,
            patientContextPath,
            patientMood,
            maxTurns,
            avaVoice,
            patientVoice
        );

        res.json({
            success: true,
            message: "Voice simulation started",
            speaker: result.speaker,
            text: result.text,
            audio: result.audio.toString("base64"),
            audioMimeType: "audio/mp3",
            isActive: result.isActive,
            turn: result.turn,
            patientMood: result.patientMood,
            avaVoice: result.avaVoice,
            patientVoice: result.patientVoice,
        });
    } catch (error) {
        console.error("Error starting voice simulation:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
