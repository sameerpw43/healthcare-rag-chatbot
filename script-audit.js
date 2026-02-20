import path from "path";
import { auditConversationFileAgainstCallScriptFile } from "./scriptAudit.js";

// Usage:
//   bun script-audit.js ./conversations/<id>.json ./call-script.txt
const conversationArg = process.argv[2];
const callScriptArg = process.argv[3] || "./call-script.txt";

if (!conversationArg) {
  console.error("Usage: bun script-audit.js <conversation.json> [call-script.txt]");
  process.exit(1);
}

const conversationPath = path.resolve(conversationArg);
const callScriptPath = path.resolve(callScriptArg);

const audit = await auditConversationFileAgainstCallScriptFile({
  conversationJsonPath: conversationPath,
  callScriptPath,
});

console.log(JSON.stringify(audit, null, 2));

