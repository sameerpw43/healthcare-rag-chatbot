import Groq from "groq-sdk";
import { createInterface } from "readline/promises";
import { vectorStore } from "./prepare.js";

const SYSTEM_PROMPT =
  "You are a helpful medical assistant. Use the following context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.";
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_MESSAGES = MAX_HISTORY_TURNS * 2;
const HISTORY_TURNS_FOR_RETRIEVAL = 2;

function addToHistory(history, message) {
  history.push(message);
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }
}

function buildRetrievalQuery(question, history) {
  const recentUserTurns = history
    .filter((message) => message.role === "user")
    .slice(-HISTORY_TURNS_FOR_RETRIEVAL)
    .map((message) => message.content);

  if (recentUserTurns.length === 0) {
    return question;
  }

  return `${recentUserTurns.join("\n")}\n${question}`;
}

export async function chat() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const chatHistory = [];

  while (true) {
    const question = await rl.question("You: ");
    console.log("Question received:", question);
    if (question === "/bye") {
      console.log("Goodbye!");
      break;
    }

    const retrievalQuery = buildRetrievalQuery(question, chatHistory);
    const relaventChunks = await vectorStore.similaritySearch(
      retrievalQuery,
      5
    );
    const useryQuery = `Context: ${relaventChunks
      .map((chunk) => chunk.pageContent)
      .join("\n\n")}\n\n Question: ${question}`;
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...chatHistory,
        {
          role: "user",
          content: useryQuery,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    const answer =
      completion?.choices?.[0]?.message?.content ?? "No response from model.";
    console.log(`Assistant:${answer}`);
    addToHistory(chatHistory, { role: "user", content: question });
    addToHistory(chatHistory, { role: "assistant", content: answer });
  }

  rl.close();
}

chat();
