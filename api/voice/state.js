import { getVoiceConversationState } from "../../voiceAgent.js";

export default function handler(req, res) {
    const state = getVoiceConversationState();
    res.json(state);
}
