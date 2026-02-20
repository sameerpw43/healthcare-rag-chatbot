import { getConversationState } from "../agentModule.js";

export default function handler(req, res) {
    const state = getConversationState();
    res.json(state);
}
