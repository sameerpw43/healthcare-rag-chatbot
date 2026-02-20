import express from "express";
import cors from "cors";
import {
    startConversation,
    getConversationState,
    stopConversation,
} from "./agentModule.js";
import {
    startVoiceConversation,
    processVoiceInput,
    getVoiceConversationState,
    stopVoiceConversation,
    transcribeAudio,
    synthesizeSpeech,
    AVAILABLE_VOICES,
    // AI-to-AI voice simulation
    startVoiceSimulation,
    getNextVoiceTurn,
    getVoiceSimulationState,
    stopVoiceSimulation,
    saveVoiceConversation,
} from "./voiceAgent.js";
import { auditConversationAgainstScript, extractExpectedQuestionsFromCallScript } from "./scriptAudit.js";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Store active conversation
let activeConversation = null;

// API Routes

// Start a new conversation
app.post("/api/start-call", async (req, res) => {
    try {
        const {
            callScriptPath = "./call-script.txt",
            patientContextPath = "./sample-context.txt",
            patientMood = "cooperative",
            maxTurns = 20,
        } = req.body;

        console.log(`Starting new conversation with patient mood: ${patientMood}...`);

        // Start conversation in background
        activeConversation = startConversation(callScriptPath, patientContextPath, patientMood, maxTurns);

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
});

// Get current conversation state
app.get("/api/conversation-state", (req, res) => {
    const state = getConversationState();
    res.json(state);
});

// Stop conversation
app.post("/api/stop-call", (req, res) => {
    stopConversation();
    res.json({
        success: true,
        message: "Call stopped",
    });
});

// Get list of all conversations
app.get("/api/conversations", async (req, res) => {
    try {
        const files = await fs.readdir("./conversations");
        const jsonFiles = files
            .filter((file) => file.endsWith(".json"))
            .sort()
            .reverse();

        const conversations = await Promise.all(
            jsonFiles.slice(0, 20).map(async (file) => {
                const content = await fs.readFile(`./conversations/${file}`, "utf-8");
                const data = JSON.parse(content);
                return {
                    id: file.replace(".json", ""),
                    filename: file,
                    timestamp: data.timestamp,
                    totalTurns: data.totalTurns,
                    messageCount: data.messages.length,
                };
            })
        );

        res.json(conversations);
    } catch (error) {
        console.error("Error fetching conversations:", error);
        res.json([]);
    }
});

// Get specific conversation
app.get("/api/conversations/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = `./conversations/${id}.json`;
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        res.json(data);
    } catch (error) {
        res.status(404).json({
            error: "Conversation not found",
        });
    }
});

// Audit: check which call-script questions were asked vs missed
app.get("/api/conversations/:id/script-audit", async (req, res) => {
    try {
        const { id } = req.params;
        const conversationPath = path.resolve(`./conversations/${id}.json`);
        const conversationRaw = await fs.readFile(conversationPath, "utf-8");
        const conversation = JSON.parse(conversationRaw);

        const callScriptFile = conversation.callScriptFile || "./call-script.txt";
        const callScriptPath = path.resolve(callScriptFile);
        const callScriptText = await fs.readFile(callScriptPath, "utf-8");

        const expectedQuestions = extractExpectedQuestionsFromCallScript(callScriptText);
        const audit = auditConversationAgainstScript({
            conversationMessages: conversation.messages || [],
            expectedQuestions,
        });

        res.json({
            conversationId: id,
            callScriptFile,
            ...audit,
        });
    } catch (error) {
        console.error("Error auditing script coverage:", error);
        res.status(500).json({
            error: error.message,
        });
    }
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// VOICE API ENDPOINTS
// ============================================

// Get available voices
app.get("/api/voice/voices", (req, res) => {
    res.json(AVAILABLE_VOICES);
});

// Start a new voice conversation
app.post("/api/voice/start-call", async (req, res) => {
    try {
        const { callScriptPath = "./call-script.txt" } = req.body;

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
});

// Process voice input and get response
app.post("/api/voice/respond", async (req, res) => {
    try {
        const { audio, mimeType = "audio/wav" } = req.body;

        if (!audio) {
            return res.status(400).json({
                success: false,
                error: "No audio data provided",
            });
        }

        // Convert base64 audio to buffer
        const audioBuffer = Buffer.from(audio, "base64");

        const result = await processVoiceInput(audioBuffer, mimeType);

        res.json({
            success: true,
            userText: result.userText,
            avaText: result.avaText,
            audio: result.audio.toString("base64"),
            audioMimeType: "audio/mp3",
            isActive: result.isActive,
        });
    } catch (error) {
        console.error("Error processing voice input:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Transcribe audio only (utility endpoint)
app.post("/api/voice/transcribe", async (req, res) => {
    try {
        const { audio, mimeType = "audio/wav" } = req.body;

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
});

// Synthesize speech only (utility endpoint)
app.post("/api/voice/synthesize", async (req, res) => {
    try {
        const { text, voice = "aura-asteria-en" } = req.body;

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
});

// Get voice conversation state
app.get("/api/voice/state", (req, res) => {
    const state = getVoiceConversationState();
    res.json(state);
});

// Stop voice conversation
app.post("/api/voice/stop-call", (req, res) => {
    const result = stopVoiceConversation();
    res.json({
        success: true,
        message: "Voice call stopped",
        ...result,
    });
});

// ============================================
// AI-TO-AI VOICE SIMULATION ENDPOINTS
// ============================================

// Start AI-to-AI voice simulation (Ava + Patient agents)
app.post("/api/voice-sim/start", async (req, res) => {
    try {
        const {
            callScriptPath = "./call-script.txt",
            patientContextPath = "./sample-context.txt",
            patientMood = "cooperative",
            maxTurns = 20,
            avaVoice = "aura-asteria-en",
            patientVoice = "aura-orion-en",
        } = req.body;

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
});

// Get next turn in voice simulation
app.post("/api/voice-sim/next-turn", async (req, res) => {
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
});

// Get voice simulation state
app.get("/api/voice-sim/state", (req, res) => {
    const state = getVoiceSimulationState();
    res.json(state);
});

// Stop voice simulation
app.post("/api/voice-sim/stop", async (req, res) => {
    try {
        const result = stopVoiceSimulation();

        // Save conversation
        const saved = await saveVoiceConversation();

        res.json({
            success: true,
            message: "Voice simulation stopped",
            ...result,
            savedAs: saved.filename,
        });
    } catch (error) {
        console.error("Error stopping voice simulation:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Healthcare Call API Server Running`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`\n📚 Text Simulation Endpoints:`);
    console.log(`   POST   /api/start-call`);
    console.log(`   GET    /api/conversation-state`);
    console.log(`   POST   /api/stop-call`);
    console.log(`   GET    /api/conversations`);
    console.log(`   GET    /api/conversations/:id`);
    console.log(`\n🎙️  Human Voice Endpoints:`);
    console.log(`   POST   /api/voice/start-call`);
    console.log(`   POST   /api/voice/respond`);
    console.log(`   POST   /api/voice/transcribe`);
    console.log(`   POST   /api/voice/synthesize`);
    console.log(`   GET    /api/voice/state`);
    console.log(`   POST   /api/voice/stop-call`);
    console.log(`   GET    /api/voice/voices`);
    console.log(`\n🤖 AI Voice Simulation Endpoints:`);
    console.log(`   POST   /api/voice-sim/start`);
    console.log(`   POST   /api/voice-sim/next-turn`);
    console.log(`   GET    /api/voice-sim/state`);
    console.log(`   POST   /api/voice-sim/stop`);
    console.log(`\n✅ Server ready!\n`);
});
