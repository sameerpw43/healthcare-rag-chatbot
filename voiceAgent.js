import "dotenv/config";
import { createClient } from "@deepgram/sdk";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Default voice settings
const DEFAULT_AVA_VOICE = "aura-asteria-en"; // Female American voice for Ava
const DEFAULT_PATIENT_VOICE = "aura-orion-en";  // Male American voice for Patient

const AVA_VOICE_SYSTEM_PROMPT = `You are Ava, a professional virtual healthcare assistant calling patients before their cardiac procedures.

CRITICAL CONVERSATION RULES:
1. Follow the call script knowledge base provided in the context
2. Give information ONE item at a time - wait for patient response before proceeding
3. Ask medical questions ONE at a time in order
4. For yes/no questions, do NOT accept vague responses like "okay" or "k" - politely re-ask
5. If patient says yes to allergies, blood thinners, or symptoms - ALWAYS ask for specifics
6. Be warm, empathetic, and professional
7. Use natural connecting words like "great", "wonderful", "alright"
8. Keep responses conversational (2-3 sentences max)
9. Track conversation progress - don't repeat already-asked questions
10. Speak naturally as this will be converted to speech - avoid special characters

Your responses should be natural conversation, NOT JSON format.`;

const PATIENT_MOOD_PROMPTS = {
    cooperative: `You are a cooperative and friendly patient receiving a pre-procedure call from Ava.

YOUR BEHAVIOR:
- Be polite, friendly, and easy to work with
- Answer questions clearly and directly
- Express appreciation for the information
- Occasionally ask relevant questions
- Show you're listening and understanding
- Respond promptly and clearly
- Keep responses natural for speech - avoid special characters

Keep responses natural and conversational (1-2 sentences usually).`,

    anxious: `You are an anxious patient receiving a pre-procedure call from Ava.

YOUR BEHAVIOR:
- Express worry about the procedure and medications
- Ask multiple clarifying questions out of concern
- Need reassurance frequently
- Sometimes ask the same question in different ways
- Express fears about potential complications
- Be cooperative but nervous and uncertain
- Use phrases like "I'm worried that...", "What if...", "Are you sure..."
- Keep responses natural for speech - avoid special characters

Keep responses natural but show clear anxiety (1-3 sentences).`,

    confused: `You are a confused patient receiving a pre-procedure call from Ava.

YOUR BEHAVIOR:
- Have difficulty understanding medical terms
- Ask for clarification frequently
- Sometimes mishear or misunderstand instructions
- Need information repeated
- Mix up dates, times, or locations occasionally
- Be cooperative but genuinely confused
- Use phrases like "Wait, what did you say?", "I don't understand...", "Can you explain that again?"
- Keep responses natural for speech - avoid special characters

Keep responses natural but show confusion (1-2 sentences).`,

    irritable: `You are an irritable patient receiving a pre-procedure call from Ava.

YOUR BEHAVIOR:
- Be short and impatient with responses
- Occasionally question why information is needed
- Express frustration with the process
- Give brief, sometimes curt answers
- Complain about the timing or length of the call
- Still provide necessary information but reluctantly
- Use phrases like "I already told you...", "Why do you need to know that?", "Can we hurry this up?"
- Keep responses natural for speech - avoid special characters

Keep responses brief and show impatience (1-2 sentences).`,

    calm: `You are a very calm and composed patient receiving a pre-procedure call from Ava.

YOUR BEHAVIOR:
- Remain relaxed and unworried throughout
- Give measured, thoughtful responses
- Show confidence in the medical process
- Ask practical, logical questions
- Be pleasant and professional
- Express gratitude calmly
- Show no anxiety or concern about the procedure
- Keep responses natural for speech - avoid special characters

Keep responses natural, calm, and measured (1-2 sentences).`,
};

// Voice conversation state
let voiceSimulationState = {
    messages: [],
    isActive: false,
    callScript: "",
    patientContext: "",
    patientMood: "cooperative",
    avaVoice: DEFAULT_AVA_VOICE,
    patientVoice: DEFAULT_PATIENT_VOICE,
    currentTurn: 0,
    maxTurns: 20,
};

/**
 * Transcribe audio buffer to text using Deepgram
 */
export async function transcribeAudio(audioBuffer, mimeType = "audio/wav") {
    try {
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
                model: "nova-2",
                language: "en",
                smart_format: true,
                punctuate: true,
            }
        );

        if (error) {
            throw new Error(`Deepgram transcription error: ${error.message}`);
        }

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        return transcript.trim();
    } catch (error) {
        console.error("Transcription error:", error);
        throw error;
    }
}

/**
 * Synthesize text to speech using Deepgram
 */
export async function synthesizeSpeech(text, voice = "aura-asteria-en") {
    try {
        const response = await deepgram.speak.request(
            { text },
            {
                model: voice,
                encoding: "linear16",
                sample_rate: 24000,
            }
        );

        const stream = await response.getStream();

        if (!stream) {
            throw new Error("Failed to get audio stream from Deepgram");
        }

        const chunks = [];
        const reader = stream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const audioBuffer = Buffer.concat(chunks);
        return audioBuffer;
    } catch (error) {
        console.error("Speech synthesis error:", error);
        throw error;
    }
}

/**
 * Load call script from file
 */
async function loadCallScript(scriptPath) {
    try {
        const content = await fs.readFile(scriptPath, "utf-8");
        return content.trim();
    } catch (error) {
        console.error(`Error loading call script: ${error.message}`);
        return "";
    }
}

/**
 * Load patient context from file
 */
async function loadPatientContext(contextPath) {
    try {
        const content = await fs.readFile(contextPath, "utf-8");
        return content.trim();
    } catch (error) {
        return "";
    }
}

/**
 * Generate Ava's response using Anthropic
 */
async function generateAvaResponse(conversationHistory, callScript) {
    let mappedMessages = conversationHistory.map((msg) => ({
        role: msg.role === "ava" ? "assistant" : "user",
        content: msg.content,
    }));

    // Anthropic requires at least one message
    if (mappedMessages.length === 0) {
        mappedMessages = [{ role: "user", content: "Hello?" }];
    }

    const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: `${AVA_VOICE_SYSTEM_PROMPT}\n\n=== CALL SCRIPT KNOWLEDGE BASE ===\n${callScript}`,
        messages: mappedMessages,
        temperature: 0.7,
    });

    return response.content[0].text;
}

/**
 * Generate Patient's response using Anthropic
 */
async function generatePatientResponse(conversationHistory, patientContext, mood = "cooperative") {
    const contextPrompt = patientContext
        ? `\n\nYOUR PATIENT BACKGROUND:\n${patientContext}`
        : "\n\nYou are a generally healthy patient with a scheduled cardiac procedure.";

    const moodPrompt = PATIENT_MOOD_PROMPTS[mood] || PATIENT_MOOD_PROMPTS.cooperative;

    const mappedMessages = conversationHistory.map((msg) => ({
        role: msg.role === "patient" ? "assistant" : "user",
        content: msg.content,
    }));

    const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: moodPrompt + contextPrompt,
        messages: mappedMessages,
        temperature: 0.8,
    });

    return response.content[0]?.text ?? "...";
}

/**
 * Check if conversation should end
 */
function shouldEndConversation(message) {
    const endPhrases = [
        "goodbye",
        "thank you for your time",
        "have a great day",
        "take care",
        "we're all set",
        "that completes",
    ];
    const lowerMsg = message.toLowerCase();
    return endPhrases.some((phrase) => lowerMsg.includes(phrase) && lowerMsg.length < 300);
}

/**
 * Start AI-to-AI voice simulation
 */
export async function startVoiceSimulation(
    callScriptPath = "./call-script.txt",
    patientContextPath = "./sample-context.txt",
    patientMood = "cooperative",
    maxTurns = 20,
    avaVoice = DEFAULT_AVA_VOICE,
    patientVoice = DEFAULT_PATIENT_VOICE
) {
    voiceSimulationState.isActive = true;
    voiceSimulationState.messages = [];
    voiceSimulationState.patientMood = patientMood;
    voiceSimulationState.avaVoice = avaVoice;
    voiceSimulationState.patientVoice = patientVoice;
    voiceSimulationState.currentTurn = 0;
    voiceSimulationState.maxTurns = maxTurns;
    voiceSimulationState.callScript = await loadCallScript(callScriptPath);
    voiceSimulationState.patientContext = await loadPatientContext(patientContextPath);

    // Generate Ava's initial greeting
    const avaText = await generateAvaResponse([], voiceSimulationState.callScript);

    voiceSimulationState.messages.push({
        role: "ava",
        content: avaText,
        timestamp: new Date().toISOString(),
    });

    // Convert to speech with selected voice
    const avaAudio = await synthesizeSpeech(avaText, voiceSimulationState.avaVoice);

    return {
        speaker: "ava",
        text: avaText,
        audio: avaAudio,
        isActive: true,
        turn: 0,
        patientMood,
        avaVoice,
        patientVoice,
    };
}

/**
 * Get next turn in the AI-to-AI voice simulation
 * Returns the next speaker's response with audio
 */
export async function getNextVoiceTurn() {
    if (!voiceSimulationState.isActive) {
        throw new Error("No active voice simulation. Call startVoiceSimulation first.");
    }

    const lastMessage = voiceSimulationState.messages[voiceSimulationState.messages.length - 1];
    const isPatientTurn = lastMessage.role === "ava";

    let text, audio, speaker;

    if (isPatientTurn) {
        // Patient's turn
        speaker = "patient";
        text = await generatePatientResponse(
            voiceSimulationState.messages,
            voiceSimulationState.patientContext,
            voiceSimulationState.patientMood
        );
        audio = await synthesizeSpeech(text, voiceSimulationState.patientVoice);
    } else {
        // Ava's turn
        speaker = "ava";
        text = await generateAvaResponse(
            voiceSimulationState.messages,
            voiceSimulationState.callScript
        );
        audio = await synthesizeSpeech(text, voiceSimulationState.avaVoice);

        // Check if conversation should end (after Ava speaks)
        if (shouldEndConversation(text)) {
            voiceSimulationState.isActive = false;
        }
    }

    // Add message to history
    voiceSimulationState.messages.push({
        role: speaker,
        content: text,
        timestamp: new Date().toISOString(),
    });

    // Increment turn counter (each complete exchange = 1 turn)
    if (speaker === "patient") {
        voiceSimulationState.currentTurn++;
        if (voiceSimulationState.currentTurn >= voiceSimulationState.maxTurns) {
            voiceSimulationState.isActive = false;
        }
    }

    return {
        speaker,
        text,
        audio,
        isActive: voiceSimulationState.isActive,
        turn: voiceSimulationState.currentTurn,
        patientMood: voiceSimulationState.patientMood,
    };
}

/**
 * Get current voice simulation state
 */
export function getVoiceSimulationState() {
    return {
        messages: voiceSimulationState.messages,
        isActive: voiceSimulationState.isActive,
        totalMessages: voiceSimulationState.messages.length,
        currentTurn: voiceSimulationState.currentTurn,
        patientMood: voiceSimulationState.patientMood,
        avaVoice: voiceSimulationState.avaVoice,
        patientVoice: voiceSimulationState.patientVoice,
    };
}

/**
 * Stop voice simulation
 */
export function stopVoiceSimulation() {
    voiceSimulationState.isActive = false;
    return {
        messages: voiceSimulationState.messages,
        totalMessages: voiceSimulationState.messages.length,
        totalTurns: voiceSimulationState.currentTurn,
    };
}

/**
 * Save voice simulation conversation
 */
export async function saveVoiceConversation() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `voice_conversation_${timestamp}.json`;
    const outputPath = `./conversations/${filename}`;

    const conversationData = {
        timestamp: new Date().toISOString(),
        type: "voice_simulation",
        patientMood: voiceSimulationState.patientMood,
        agents: {
            ava: { model: ANTHROPIC_MODEL, provider: "anthropic", voice: voiceSimulationState.avaVoice },
            patient: { model: ANTHROPIC_MODEL, provider: "anthropic", voice: voiceSimulationState.patientVoice },
        },
        totalTurns: voiceSimulationState.currentTurn,
        messages: voiceSimulationState.messages,
    };

    await fs.mkdir("./conversations", { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(conversationData, null, 2));

    return { filename, data: conversationData };
}

// ========================================
// Legacy exports for human-to-AI voice call (keeping for compatibility)
// ========================================

let voiceConversationState = {
    messages: [],
    isActive: false,
    callScript: "",
};

export async function startVoiceConversation(callScriptPath = "./call-script.txt") {
    voiceConversationState.isActive = true;
    voiceConversationState.messages = [];
    voiceConversationState.callScript = await loadCallScript(callScriptPath);

    const greeting = await generateAvaResponse([], voiceConversationState.callScript);

    voiceConversationState.messages.push({
        role: "ava",
        content: greeting,
        timestamp: new Date().toISOString(),
    });

    const audioBuffer = await synthesizeSpeech(greeting, AVA_VOICE);

    return {
        text: greeting,
        audio: audioBuffer,
        isActive: true,
    };
}

export async function processVoiceInput(audioBuffer, mimeType = "audio/wav") {
    if (!voiceConversationState.isActive) {
        throw new Error("No active voice conversation. Call startVoiceConversation first.");
    }

    const userText = await transcribeAudio(audioBuffer, mimeType);

    if (!userText) {
        throw new Error("Could not transcribe audio. Please speak clearly and try again.");
    }

    voiceConversationState.messages.push({
        role: "patient",
        content: userText,
        timestamp: new Date().toISOString(),
    });

    const avaText = await generateAvaResponse(
        voiceConversationState.messages,
        voiceConversationState.callScript
    );

    voiceConversationState.messages.push({
        role: "ava",
        content: avaText,
        timestamp: new Date().toISOString(),
    });

    if (shouldEndConversation(avaText)) {
        voiceConversationState.isActive = false;
    }

    const responseAudio = await synthesizeSpeech(avaText, AVA_VOICE);

    return {
        userText,
        avaText,
        audio: responseAudio,
        isActive: voiceConversationState.isActive,
    };
}

export function getVoiceConversationState() {
    return {
        messages: voiceConversationState.messages,
        isActive: voiceConversationState.isActive,
        totalMessages: voiceConversationState.messages.length,
    };
}

export function stopVoiceConversation() {
    voiceConversationState.isActive = false;
    return {
        messages: voiceConversationState.messages,
        totalMessages: voiceConversationState.messages.length,
    };
}

/**
 * Available voice options for TTS
 */
export const AVAILABLE_VOICES = [
    { id: "aura-asteria-en", name: "Asteria", gender: "female", accent: "American", default: "ava" },
    { id: "aura-luna-en", name: "Luna", gender: "female", accent: "American" },
    { id: "aura-stella-en", name: "Stella", gender: "female", accent: "American" },
    { id: "aura-athena-en", name: "Athena", gender: "female", accent: "British" },
    { id: "aura-hera-en", name: "Hera", gender: "female", accent: "American" },
    { id: "aura-orion-en", name: "Orion", gender: "male", accent: "American", default: "patient" },
    { id: "aura-arcas-en", name: "Arcas", gender: "male", accent: "American" },
    { id: "aura-perseus-en", name: "Perseus", gender: "male", accent: "American" },
    { id: "aura-angus-en", name: "Angus", gender: "male", accent: "Irish" },
    { id: "aura-orpheus-en", name: "Orpheus", gender: "male", accent: "American" },
];
