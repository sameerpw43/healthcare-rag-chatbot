import { getVoiceSimulationState } from "../../voiceAgent.js";

export default function handler(req, res) {
    const state = getVoiceSimulationState();
    res.json(state);
}
