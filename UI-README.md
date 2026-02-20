# Healthcare Pre-Procedure Call System - UI

Beautiful web interface for the Ava-Patient AI conversation system.

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
# In the project root
node server.js
```
Server runs on: `http://localhost:3000`

### 2. Start the Frontend UI
```bash
# In another terminal
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

### 3. Open in Browser
Visit `http://localhost:5173` to see the UI!

## ✨ Features

- 📞 **Start New Calls** - Begin Ava-Patient conversations with one click
- 💬 **Real-Time Display** - Watch conversations unfold in chat-style bubbles
- 📊 **Conversation History** - View and replay past conversations
- 🎨 **Medical-Themed Design** - Professional healthcare interface
- ⚡ **Live Status** - Visual indicators for active calls

## 🎯 Usage

1. Click **"Start New Call"** to begin a conversation
2. Watch as Ava and the Patient exchange messages in real-time
3. Conversations auto-save to `conversations/` folder
4. Click **"View History"** to see past conversations

## 📁 Project Structure

```
RAG-PROJECT/
├── server.js              # Express API server
├── agentModule.js         # Agent logic (Ava & Patient)
├── call-script.txt        # Ava's knowledge base
├── sample-context.txt     # Patient profile
├── conversations/         # Saved JSON conversations
└── frontend/              # React UI
    ├── src/
    │   ├── App.jsx       # Main component
    │   └── App.css       # Styling
    └── package.json
```

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **AI Models**: 
  - Ava: Ollama (gemma3)
  - Patient: Groq (llama-3.3-70b-versatile)

## 📝 API Endpoints

- `POST /api/start-call` - Start a new conversation
- `GET /api/conversation-state` - Get current conversation state
- `POST /api/stop-call` - Stop active conversation
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get specific conversation

## 🎨 UI Preview

- **Header**: Hospital branding with call status indicator
- **Sidebar**: Call controls and conversation history
- **Main Area**: Real-time chat-style message display
- **Color Scheme**: Medical blue & healthcare green

## 📋 Requirements

- Node.js
- Ollama (running locally with gemma3 model)
- Groq API key in `.env` file

Enjoy your presentation! 🎉
