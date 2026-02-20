import fs from "fs/promises";

function normalizeText(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "just",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "say",
  "so",
  "tell",
  "that",
  "the",
  "then",
  "to",
  "today",
  "we",
  "what",
  "when",
  "which",
  "who",
  "would",
  "you",
  "your",
]);

function tokensForMatch(text) {
  const toks = normalizeText(text)
    .split(" ")
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return Array.from(new Set(toks));
}

function scoreMatch(expectedTokens, haystackText) {
  if (expectedTokens.length === 0) return 0;
  const hayTokens = new Set(tokensForMatch(haystackText));
  let common = 0;
  for (const t of expectedTokens) {
    if (hayTokens.has(t)) common++;
  }
  return common / expectedTokens.length;
}

/**
 * Extracts script "questions" from call-script.txt.
 * Focus: the explicit "QUESTION X:" section + DOB verification.
 */
export function extractExpectedQuestionsFromCallScript(callScriptText) {
  const lines = (callScriptText ?? "").split(/\r?\n/);
  const expected = [];

  // Add DOB verification (explicitly required in script)
  expected.push({
    id: "dob_verification",
    section: "greeting",
    label: "Verify DOB",
    text: "What is your date of birth",
    matchHints: ["date of birth", "dob", "born"],
  });

  // Parse QUESTION blocks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(/^QUESTION\s+(\d+)\s*:\s*(.+)$/i);
    if (!m) continue;

    const qNum = m[1];
    const qTitle = m[2].trim();

    // Look ahead for the first quoted question line
    let questionText = "";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const candidate = lines[j].trim();
      const qm = candidate.match(/^"(.+)"$/);
      if (qm) {
        questionText = qm[1].trim();
        break;
      }
    }

    if (!questionText) continue;

    expected.push({
      id: `screen_q${qNum}`,
      section: "medical_screening",
      label: `Question ${qNum}: ${qTitle}`,
      text: questionText,
      matchHints: [],
    });
  }

  // Add "final questions" from closing phase (optional but useful)
  expected.push({
    id: "final_questions",
    section: "closing",
    label: "Ask final questions",
    text: "Ask if they have any final questions",
    matchHints: ["any questions", "final questions", "questions for me"],
  });

  return expected;
}

export function auditConversationAgainstScript({ conversationMessages, expectedQuestions }) {
  const avaMessages = (conversationMessages ?? []).filter((m) => m?.role === "ava");

  const results = expectedQuestions.map((q) => {
    const expectedTokens = tokensForMatch(q.text);
    const hintTokens = Array.from(new Set((q.matchHints ?? []).flatMap(tokensForMatch)));

    let best = { score: 0, messageIndex: -1, message: "" };
    for (let i = 0; i < avaMessages.length; i++) {
      const msg = avaMessages[i]?.content ?? "";
      const score = Math.max(
        scoreMatch(expectedTokens, msg),
        hintTokens.length > 0 ? scoreMatch(hintTokens, msg) : 0
      );
      if (score > best.score) {
        best = { score, messageIndex: i, message: msg };
      }
    }

    // Heuristic thresholds:
    // - explicit substring match of key phrase OR token overlap >= 0.55
    const normMsg = normalizeText(best.message);
    const normExpected = normalizeText(q.text);
    const substringHit = normExpected.length >= 18 && normMsg.includes(normExpected);
    const asked = substringHit || best.score >= 0.55;

    return {
      ...q,
      asked,
      bestMatch: asked
        ? {
            score: Number(best.score.toFixed(3)),
            avaMessageIndex: best.messageIndex,
            excerpt: (best.message ?? "").slice(0, 240),
          }
        : null,
    };
  });

  const asked = results.filter((r) => r.asked);
  const missed = results.filter((r) => !r.asked);

  return {
    expectedCount: results.length,
    askedCount: asked.length,
    missedCount: missed.length,
    asked,
    missed,
  };
}

export async function auditConversationFileAgainstCallScriptFile({
  conversationJsonPath,
  callScriptPath,
}) {
  const conversationRaw = await fs.readFile(conversationJsonPath, "utf-8");
  const conversation = JSON.parse(conversationRaw);
  const callScriptText = await fs.readFile(callScriptPath, "utf-8");
  const expectedQuestions = extractExpectedQuestionsFromCallScript(callScriptText);
  return auditConversationAgainstScript({
    conversationMessages: conversation.messages ?? [],
    expectedQuestions,
  });
}

