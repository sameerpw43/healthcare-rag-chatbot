import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const AVA_SYSTEM_PROMPT = `You are Ava, a professional virtual healthcare assistant calling patients before their cardiac procedures.

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

Keep responses natural, calm, and measured (1-2 sentences).`,
};

let conversationState = {
    messages: [],
    isActive: false,
    callScript: "",
    patientContext: "",
    patientMood: "cooperative",
};

export async function loadCallScript(scriptPath) {
    try {
        const content = await fs.readFile(scriptPath, "utf-8");
        return content.trim();
    } catch (error) {
        console.error(`Error loading call script: ${error.message}`);
        return "";
    }
}

export async function loadPatientContext(contextPath) {
    try {
        const content = await fs.readFile(contextPath, "utf-8");
        return content.trim();
    } catch (error) {
        return "";
    }
}

export function createAvaAgent() {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    return async function generateAvaResponse(conversationHistory, callScript) {
        const mappedMessages = conversationHistory.map((msg) => ({
            role: msg.role === "ava" ? "assistant" : "user",
            content: msg.content,
        }));

        const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: `${AVA_SYSTEM_PROMPT}\n\n=== CALL SCRIPT KNOWLEDGE BASE ===\n${callScript}`,
            messages: mappedMessages,
            temperature: 0.7,
        });

        return response.content[0].text;
    };
}

export function createPatientAgent() {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    return async function generatePatientResponse(conversationHistory, patientContext, mood = 'cooperative') {
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
    };
}

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

export async function saveConversation(messages, callScriptFile, patientContextFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `conversation_${timestamp}.json`;
    const outputPath = `./conversations/${filename}`;

    const conversationData = {
        timestamp: new Date().toISOString(),
        callScriptFile,
        patientContextFile: patientContextFile || null,
        agents: {
            ava: { model: ANTHROPIC_MODEL, provider: "anthropic", role: "Healthcare Assistant" },
            patient: { model: ANTHROPIC_MODEL, provider: "anthropic", role: "Patient" },
        },
        totalTurns: Math.floor(messages.length / 2),
        conversationComplete: true,
        messages,
    };

    await fs.mkdir("./conversations", { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(conversationData, null, 2));

    return { filename, data: conversationData };
}

export async function startConversation(callScriptPath, patientContextPath, patientMood = 'cooperative', maxTurns = 20) {
    conversationState.isActive = true;
    conversationState.messages = [];
    conversationState.patientMood = patientMood;

    conversationState.callScript = await loadCallScript(callScriptPath);
    conversationState.patientContext = await loadPatientContext(patientContextPath);

    const avaAgent = createAvaAgent();
    const patientAgent = createPatientAgent();

    for (let turn = 0; turn < maxTurns && conversationState.isActive; turn++) {
        // Ava's turn
        const avaResponse = await avaAgent(conversationState.messages, conversationState.callScript);
        const avaMessage = {
            role: "ava",
            content: avaResponse,
            timestamp: new Date().toISOString(),
        };
        conversationState.messages.push(avaMessage);

        if (shouldEndConversation(avaResponse)) {
            conversationState.isActive = false;
            break;
        }

        // Small delay between turns
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Patient's turn
        const patientResponse = await patientAgent(
            conversationState.messages,
            conversationState.patientContext,
            conversationState.patientMood
        );
        const patientMessage = {
            role: "patient",
            content: patientResponse,
            timestamp: new Date().toISOString(),
        };
        conversationState.messages.push(patientMessage);

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    conversationState.isActive = false;

    // Save conversation
    const result = await saveConversation(
        conversationState.messages,
        callScriptPath,
        patientContextPath
    );

    return result;
}

export function getConversationState() {
    return {
        messages: conversationState.messages,
        isActive: conversationState.isActive,
        totalMessages: conversationState.messages.length,
        patientMood: conversationState.patientMood,
    };
}

export function stopConversation() {
    conversationState.isActive = false;
}
