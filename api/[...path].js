import {
    startConversation,
    getConversationState,
    stopConversation,
} from "../agentModule.js";
import {
    startVoiceConversation,
    processVoiceInput,
    getVoiceConversationState,
    stopVoiceConversation,
    transcribeAudio,
    synthesizeSpeech,
    AVAILABLE_VOICES,
    startVoiceSimulation,
    getNextVoiceTurn,
    getVoiceSimulationState,
    stopVoiceSimulation,
} from "../voiceAgent.js";
import { auditConversationAgainstScript, extractExpectedQuestionsFromCallScript } from "../scriptAudit.js";

export default async function handler(req, res) {
    // Extract the path segments from the catch-all route
    const { path } = req.query;
    const route = Array.isArray(path) ? path.join("/") : path || "";

    try {
        // ============================================
        // TEXT SIMULATION ENDPOINTS
        // ============================================

        if (route === "health") {
            return res.json({ status: "ok", timestamp: new Date().toISOString() });
        }

        if (route === "start-call" && req.method === "POST") {
            const {
                callScriptPath = "./call-script.txt",
                patientContextPath = "./sample-context.txt",
                patientMood = "cooperative",
                maxTurns = 20,
            } = req.body || {};

            console.log(`Starting new conversation with patient mood: ${patientMood}...`);
            startConversation(callScriptPath, patientContextPath, patientMood, maxTurns);

            return res.json({ success: true, message: "Call started", patientMood });
        }

        if (route === "conversation-state") {
            return res.json(getConversationState());
        }

        if (route === "stop-call" && req.method === "POST") {
            stopConversation();
            return res.json({ success: true, message: "Call stopped" });
        }

        // ============================================
        // VOICE ENDPOINTS
        // ============================================

        if (route === "voice/voices") {
            return res.json(AVAILABLE_VOICES);
        }

        if (route === "voice/start-call" && req.method === "POST") {
            const { callScriptPath = "./call-script.txt" } = req.body || {};
            console.log("Starting new voice conversation...");
            const result = await startVoiceConversation(callScriptPath);
            return res.json({
                success: true,
                message: "Voice call started",
                greeting: result.text,
                audio: result.audio.toString("base64"),
                audioMimeType: "audio/mp3",
            });
        }

        if (route === "voice/respond" && req.method === "POST") {
            const { audio, mimeType = "audio/wav" } = req.body || {};
            if (!audio) {
                return res.status(400).json({ success: false, error: "No audio data provided" });
            }
            const audioBuffer = Buffer.from(audio, "base64");
            const result = await processVoiceInput(audioBuffer, mimeType);
            return res.json({
                success: true,
                userText: result.userText,
                avaText: result.avaText,
                audio: result.audio.toString("base64"),
                audioMimeType: "audio/mp3",
                isActive: result.isActive,
            });
        }

        if (route === "voice/transcribe" && req.method === "POST") {
            const { audio, mimeType = "audio/wav" } = req.body || {};
            if (!audio) {
                return res.status(400).json({ success: false, error: "No audio data provided" });
            }
            const audioBuffer = Buffer.from(audio, "base64");
            const transcript = await transcribeAudio(audioBuffer, mimeType);
            return res.json({ success: true, transcript });
        }

        if (route === "voice/synthesize" && req.method === "POST") {
            const { text, voice = "aura-asteria-en" } = req.body || {};
            if (!text) {
                return res.status(400).json({ success: false, error: "No text provided" });
            }
            const audioBuffer = await synthesizeSpeech(text, voice);
            return res.json({
                success: true,
                audio: audioBuffer.toString("base64"),
                audioMimeType: "audio/mp3",
            });
        }

        if (route === "voice/state") {
            return res.json(getVoiceConversationState());
        }

        if (route === "voice/stop-call" && req.method === "POST") {
            const result = stopVoiceConversation();
            return res.json({ success: true, message: "Voice call stopped", ...result });
        }

        // ============================================
        // AI-TO-AI VOICE SIMULATION ENDPOINTS
        // ============================================

        if (route === "voice-sim/start" && req.method === "POST") {
            const {
                callScriptPath = "./call-script.txt",
                patientContextPath = "./sample-context.txt",
                patientMood = "cooperative",
                maxTurns = 20,
                avaVoice = "aura-asteria-en",
                patientVoice = "aura-orion-en",
            } = req.body || {};

            console.log(`Starting AI-to-AI voice simulation with patient mood: ${patientMood}...`);
            const result = await startVoiceSimulation(
                callScriptPath, patientContextPath, patientMood, maxTurns, avaVoice, patientVoice
            );

            return res.json({
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
        }

        if (route === "voice-sim/next-turn" && req.method === "POST") {
            const result = await getNextVoiceTurn();
            return res.json({
                success: true,
                speaker: result.speaker,
                text: result.text,
                audio: result.audio.toString("base64"),
                audioMimeType: "audio/mp3",
                isActive: result.isActive,
                turn: result.turn,
                patientMood: result.patientMood,
            });
        }

        if (route === "voice-sim/state") {
            return res.json(getVoiceSimulationState());
        }

        if (route === "voice-sim/stop" && req.method === "POST") {
            const result = stopVoiceSimulation();
            return res.json({ success: true, message: "Voice simulation stopped", ...result });
        }

        // No matching route
        return res.status(404).json({ error: "Not found", route });

    } catch (error) {
        console.error(`Error handling /${route}:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
