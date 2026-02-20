import { AVAILABLE_VOICES } from "../../voiceAgent.js";

export default function handler(req, res) {
    res.json(AVAILABLE_VOICES);
}
