import "dotenv/config";
import Groq from "groq-sdk";
import { Ollama } from "ollama";
import fs from "fs/promises";
import path from "path";

// Configuration
const OLLAMA_MODEL = "gemma3";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_MAX_TURNS = 20; // Increased for full conversation

// System prompts for each agent
const AVA_SYSTEM_PROMPT = `You are Ava, a professional virtual healthcare assistant calling patients before their cardiac procedures.

CRITICAL CONVERSATION RULES:
1. Follow the call script knowledge base provided in the context
2. Give information ONE item at a time - wait for patient response before proceeding
3. Ask medical questions ONE at a time in order
4. For yes/no questions, do NOT accept vague responses like "okay" or "k" - politely re-ask
5. If patient says yes to allergies, blood thinners, or symptoms - ALWAYS ask for specifics
6. Be warm, empathetic, and professional
7. Use natural connecting words like "great", "wonderful", "alright"
8. If patient asks to wait/hold on, acknowledge and wait for them to resume
9. Keep responses conversational (2-3 sentences max)
10. Track conversation progress - don't repeat already-asked questions

IMPORTANT: You must complete the entire call flow:
- Greeting and DOB verification
- Procedure information (one at a time)
- All 9 medical screening questions
- Closing

Your responses should be natural conversation, NOT JSON format.`;

const PATIENT_SYSTEM_PROMPT = `You are a patient receiving a pre-procedure call from Ava, a healthcare assistant.

YOUR BEHAVIOR:
1. Respond naturally and realistically as a patient would
2. Sometimes be concerned, sometimes casual
3. Vary your responses - don't always say "okay" or "yes"
4. Ask clarifying questions occasionally
5. Show realistic patient behaviors:
   - Sometimes need time to find information
   - Occasionally ask to repeat things
   - Express concerns or questions about the procedure
6. When asked yes/no medical questions, give clear answers
7. If you have allergies/symptoms in your context, mention them
8. Be cooperative but realistic

Keep responses natural and conversational (1-2 sentences usually).`;

/**
 * Load call script knowledge base
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
 * Create Ava agent using Ollama (Gemma 3)
 */
function createAvaAgent() {
    const ollama = new Ollama({ host: "http://localhost:11434" });

    return async function generateAvaResponse(conversationHistory, callScript) {
        const messages = [
            {
                role: "system",
                content: `${AVA_SYSTEM_PROMPT}\n\n=== CALL SCRIPT KNOWLEDGE BASE ===\n${callScript}`,
            },
            ...conversationHistory.map((msg) => ({
                role: msg.role === "ava" ? "assistant" : "user",
                content: msg.content,
            })),
        ];

        try {
            const response = await ollama.chat({
                model: OLLAMA_MODEL,
                messages,
                options: {
                    temperature: 0.7,
                },
            });
            return response.message.content;
        } catch (error) {
            console.error("Error with Ollama:", error.message);
            throw error;
        }
    };
}

/**
 * Create Patient agent using Groq (Llama 3.3)
 */
function createPatientAgent() {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    return async function generatePatientResponse(conversationHistory, patientContext) {
        const contextPrompt = patientContext
            ? `\n\nYOUR PATIENT BACKGROUND:\n${patientContext}`
            : "\n\nYou are a generally healthy patient with a scheduled cardiac procedure.";

        const messages = [
            {
                role: "system",
                content: PATIENT_SYSTEM_PROMPT + contextPrompt,
            },
            ...conversationHistory.map((msg) => ({
                role: msg.role === "patient" ? "assistant" : "user",
                content: msg.content,
            })),
        ];

        const completion = await groq.chat.completions.create({
            messages,
            model: GROQ_MODEL,
            temperature: 0.8, // Higher temperature for varied patient responses
        });

        return completion?.choices?.[0]?.message?.content ?? "...";
    };
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

/**-=[]
 * Save conversation to JSON file
 */
async function saveConversation(messages, callScriptFile, patientContextFile, outputDir = "./conversations") {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `conversation_${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);

    const conversationData = {
        timestamp: new Date().toISOString(),
        callScriptFile: callScriptFile,
        patientContextFile: patientContextFile || null,
        agents: {
            ava: { model: OLLAMA_MODEL, provider: "ollama", role: "Healthcare Assistant" },
            patient: { model: GROQ_MODEL, provider: "groq", role: "Patient" },
        },
        totalTurns: Math.floor(messages.length / 2),
        conversationComplete: true,
        messages,
    };

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(conversationData, null, 2));

    console.log(`\n💾 Conversation saved to: ${outputPath}`);
    return outputPath;
}

/**
 * Run healthcare call conversation
 */
async function runHealthcareCall(callScriptPath, patientContextPath = "", maxTurns = DEFAULT_MAX_TURNS) {
    console.log("\n🏥 Starting Healthcare Pre-Procedure Call");
    console.log("=".repeat(60));

    // Load call script
    const callScript = await loadCallScript(callScriptPath);
    if (!callScript) {
        console.error("❌ Failed to load call script. Exiting.");
        return;
    }
    console.log(`📋 Loaded call script from: ${callScriptPath}`);

    // Load patient context (optional)
    let patientContext = "";
    if (patientContextPath) {
        try {
            patientContext = await fs.readFile(patientContextPath, "utf-8");
            console.log(`👤 Loaded patient context from: ${patientContextPath}`);
        } catch (error) {
            console.log(`ℹ️  No patient context file found, using default patient profile`);
        }
    }

    console.log("\n📞 Call connecting...\n");

    // Create agents
    const avaAgent = createAvaAgent();
    const patientAgent = createPatientAgent();

    // Conversation history
    const messages = [];

    // Start conversation
    for (let turn = 0; turn < maxTurns; turn++) {
        console.log(`\n--- Turn ${turn + 1} ---\n`);

        // Ava's turn
        const avaResponse = await avaAgent(messages, callScript);
        const avaMessage = {
            role: "ava",
            content: avaResponse,
            timestamp: new Date().toISOString(),
        };
        messages.push(avaMessage);
        console.log(`👩‍⚕️ Ava: ${avaResponse}\n`);

        // Check if Ava ended the call
        if (shouldEndConversation(avaResponse)) {
            console.log("📞 Call ended by Ava.\n");
            break;
        }

        // Patient's turn
        const patientResponse = await patientAgent(messages, patientContext);
        const patientMessage = {
            role: "patient",
            content: patientResponse,
            timestamp: new Date().toISOString(),
        };
        messages.push(patientMessage);
        console.log(`🧑 Patient: ${patientResponse}\n`);

        // Add a small delay to make conversation feel natural
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("=".repeat(60));
    console.log(`\n📊 Conversation Summary:`);
    console.log(`   Total turns: ${Math.floor(messages.length / 2)}`);
    console.log(`   Total messages: ${messages.length}`);

    // Save conversation
    await saveConversation(messages, callScriptPath, patientContextPath);

    return messages;
}

// Main execution
const callScriptPath = process.argv[2] || "./call-script.txt";
const patientContextPath = process.argv[3] || "";
const maxTurns = parseInt(process.argv[4]) || DEFAULT_MAX_TURNS;

console.log("\n🚀 Healthcare Call Agent System");
console.log("================================");
console.log(`📄 Call Script: ${callScriptPath}`);
console.log(`👤 Patient Context: ${patientContextPath || "(None - using default)"}  `);
console.log(`🔄 Max Turns: ${maxTurns}\n`);

runHealthcareCall(callScriptPath, patientContextPath, maxTurns).catch(console.error);
