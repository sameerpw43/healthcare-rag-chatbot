import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = '/api';

const PATIENT_MOODS = [
  { value: 'cooperative', label: '😊 Cooperative', description: 'Friendly & easy to work with' },
  { value: 'anxious', label: '😰 Anxious', description: 'Worried & needs reassurance' },
  { value: 'confused', label: '😕 Confused', description: 'Has difficulty understanding' },
  { value: 'irritable', label: '😠 Irritable', description: 'Impatient & frustrated' },
  { value: 'calm', label: '😌 Calm', description: 'Relaxed & composed' },
];

const AVAILABLE_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria', gender: 'Female', accent: 'American' },
  { id: 'aura-luna-en', name: 'Luna', gender: 'Female', accent: 'American' },
  { id: 'aura-stella-en', name: 'Stella', gender: 'Female', accent: 'American' },
  { id: 'aura-athena-en', name: 'Athena', gender: 'Female', accent: 'British' },
  { id: 'aura-hera-en', name: 'Hera', gender: 'Female', accent: 'American' },
  { id: 'aura-orion-en', name: 'Orion', gender: 'Male', accent: 'American' },
  { id: 'aura-arcas-en', name: 'Arcas', gender: 'Male', accent: 'American' },
  { id: 'aura-perseus-en', name: 'Perseus', gender: 'Male', accent: 'American' },
  { id: 'aura-angus-en', name: 'Angus', gender: 'Male', accent: 'Irish' },
  { id: 'aura-orpheus-en', name: 'Orpheus', gender: 'Male', accent: 'American' },
];

const TABS = {
  SIMULATION: 'simulation',
  VOICE_SIM: 'voice-sim',
};

function App() {
  const [activeTab, setActiveTab] = useState(TABS.SIMULATION);
  const [messages, setMessages] = useState([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [patientMood, setPatientMood] = useState('cooperative');
  const [currentMood, setCurrentMood] = useState('cooperative');
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [scriptAudit, setScriptAudit] = useState(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Voice simulation state
  const [isVoiceSimActive, setIsVoiceSimActive] = useState(false);
  const [voiceSimMessages, setVoiceSimMessages] = useState([]);
  const [isVoiceSimProcessing, setIsVoiceSimProcessing] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [voiceSimTurn, setVoiceSimTurn] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [avaVoice, setAvaVoice] = useState('aura-asteria-en');
  const [patientVoice, setPatientVoice] = useState('aura-orion-en');
  const [showVoiceHistory, setShowVoiceHistory] = useState(false);
  const [voiceConversations, setVoiceConversations] = useState([]);
  const [selectedVoiceConvId, setSelectedVoiceConvId] = useState(null);
  const [voiceScriptAudit, setVoiceScriptAudit] = useState(null);
  const [isVoiceAuditLoading, setIsVoiceAuditLoading] = useState(false);
  const audioRef = useRef(null);
  const isVoiceSimActiveRef = useRef(false);
  const autoPlayRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => {
    isVoiceSimActiveRef.current = isVoiceSimActive;
  }, [isVoiceSimActive]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  // Poll for text conversation state
  useEffect(() => {
    if (!isCallActive) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/conversation-state`);
        const data = await response.json();
        setMessages(data.messages || []);
        setCurrentMood(data.patientMood || 'cooperative');
        if (!data.isActive && data.totalMessages > 0) {
          setIsCallActive(false);
          loadConversations();
        }
      } catch (error) {
        console.error('Error polling conversation:', error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Load conversation history
  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/conversations`);
      const data = await response.json();
      setConversations(data);
      // Filter voice conversations
      setVoiceConversations(data.filter(c => c.id.startsWith('voice_conversation_')));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Start text simulation
  const startCall = async () => {
    setIsLoading(true);
    setMessages([]);
    setCurrentMood(patientMood);
    setSelectedConversationId(null);
    setScriptAudit(null);
    try {
      const response = await fetch(`${API_URL}/start-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callScriptPath: './call-script.txt',
          patientContextPath: './sample-context.txt',
          patientMood: patientMood,
          maxTurns: 20,
        }),
      });
      if (response.ok) setIsCallActive(true);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Make sure the server is running!');
    } finally {
      setIsLoading(false);
    }
  };

  const stopCall = async () => {
    try {
      await fetch(`${API_URL}/stop-call`, { method: 'POST' });
      setIsCallActive(false);
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  };

  const viewConversation = async (id) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${id}`);
      const data = await response.json();
      setMessages(data.messages);
      setSelectedConversationId(id);
      setScriptAudit(null);
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const runScriptAudit = async () => {
    if (!selectedConversationId) return;
    setIsAuditLoading(true);
    try {
      const response = await fetch(`${API_URL}/conversations/${selectedConversationId}/script-audit`);
      const data = await response.json();
      setScriptAudit(data);
    } catch (error) {
      console.error('Error running script audit:', error);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const getMoodEmoji = (mood) => {
    const moodObj = PATIENT_MOODS.find(m => m.value === mood);
    return moodObj ? moodObj.label.split(' ')[0] : '😊';
  };

  // ========================================
  // VOICE SIMULATION FUNCTIONS
  // ========================================

  const playAudio = (base64Audio) => {
    return new Promise((resolve) => {
      if (!base64Audio || !audioRef.current) { resolve(); return; }
      const audioData = `data:audio/wav;base64,${base64Audio}`;
      audioRef.current.src = audioData;
      audioRef.current.onended = () => { setAudioPlaying(false); setCurrentSpeaker(null); resolve(); };
      audioRef.current.onerror = () => { setAudioPlaying(false); setCurrentSpeaker(null); resolve(); };
      audioRef.current.play();
      setAudioPlaying(true);
    });
  };

  const startVoiceSim = async () => {
    setIsLoading(true);
    setVoiceSimMessages([]);
    setVoiceSimTurn(0);
    setCurrentMood(patientMood);
    setSelectedVoiceConvId(null);
    setVoiceScriptAudit(null);

    try {
      const response = await fetch(`${API_URL}/voice-sim/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callScriptPath: './call-script.txt',
          patientContextPath: './sample-context.txt',
          patientMood,
          maxTurns: 20,
          avaVoice,
          patientVoice,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsVoiceSimActive(true);
        isVoiceSimActiveRef.current = true; // Set ref immediately for setTimeout callback
        setCurrentMood(data.patientMood);
        setVoiceSimMessages([{ role: data.speaker, content: data.text, timestamp: new Date().toISOString() }]);
        setCurrentSpeaker(data.speaker);
        await playAudio(data.audio);
        if (autoPlayRef.current && data.isActive) setTimeout(() => getNextTurn(), 500);
      } else {
        throw new Error(data.error || 'Failed to start');
      }
    } catch (error) {
      console.error('Error starting voice simulation:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextTurn = async () => {
    if (!isVoiceSimActiveRef.current) return;
    setIsVoiceSimProcessing(true);

    try {
      const response = await fetch(`${API_URL}/voice-sim/next-turn`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setVoiceSimMessages(prev => [...prev, { role: data.speaker, content: data.text, timestamp: new Date().toISOString() }]);
        setVoiceSimTurn(data.turn);
        setCurrentSpeaker(data.speaker);
        await playAudio(data.audio);

        if (!data.isActive) {
          setIsVoiceSimActive(false);
          loadConversations();
        } else if (autoPlayRef.current) {
          setTimeout(() => getNextTurn(), 500);
        }
      }
    } catch (error) {
      console.error('Error getting next turn:', error);
      if (error.message?.includes('No active')) setIsVoiceSimActive(false);
    } finally {
      setIsVoiceSimProcessing(false);
    }
  };

  const stopVoiceSim = async () => {
    // Stop auto-play loop immediately
    isVoiceSimActiveRef.current = false;
    setIsVoiceSimActive(false);

    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioPlaying(false);
    setCurrentSpeaker(null);
    setIsVoiceSimProcessing(false);

    // Save conversation
    await fetch(`${API_URL}/voice-sim/stop`, { method: 'POST' });
    loadConversations();
  };

  const viewVoiceConversation = async (id) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${id}`);
      const data = await response.json();
      setVoiceSimMessages(data.messages || []);
      setSelectedVoiceConvId(id);
      setVoiceScriptAudit(null);
      setShowVoiceHistory(false);
    } catch (error) {
      console.error('Error loading voice conversation:', error);
    }
  };

  const runVoiceScriptAudit = async () => {
    if (!selectedVoiceConvId) return;
    setIsVoiceAuditLoading(true);
    try {
      const response = await fetch(`${API_URL}/conversations/${selectedVoiceConvId}/script-audit`);
      const data = await response.json();
      setVoiceScriptAudit(data);
    } catch (error) {
      console.error('Error running voice script audit:', error);
    } finally {
      setIsVoiceAuditLoading(false);
    }
  };

  const getVoiceLabel = (voiceId) => {
    const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
    return voice ? `${voice.name} (${voice.gender}, ${voice.accent})` : voiceId;
  };

  return (
    <div className="app">
      <audio ref={audioRef} />

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="hospital-info">
            <div className="hospital-icon">🏥</div>
            <div>
              <h1>Harmony General Hospital</h1>
              <p>Pre-Procedure Call System</p>
            </div>
          </div>
          <div className="header-status">
            <div className="call-status">
              <div className={`status-indicator ${isCallActive || isVoiceSimActive ? 'active' : ''}`}></div>
              <span>{isCallActive ? 'Text Simulation' : isVoiceSimActive ? 'Voice Simulation' : 'Ready'}</span>
            </div>
            {(isCallActive || isVoiceSimActive) && (
              <div className="mood-indicator">Patient: {getMoodEmoji(currentMood)} {currentMood}</div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tab-navigation">
        <button className={`tab-button ${activeTab === TABS.SIMULATION ? 'active' : ''}`} onClick={() => setActiveTab(TABS.SIMULATION)}>
          📝 Text Simulation
        </button>
        <button className={`tab-button ${activeTab === TABS.VOICE_SIM ? 'active' : ''}`} onClick={() => setActiveTab(TABS.VOICE_SIM)}>
          🎙️ Voice Simulation
        </button>
      </div>

      <div className="main-content">
        {activeTab === TABS.SIMULATION ? (
          <>
            {/* Text Simulation Sidebar */}
            <aside className="sidebar">
              <h3>Call Controls</h3>
              <div className="mood-selector">
                <label>Patient Mood:</label>
                <select value={patientMood} onChange={(e) => setPatientMood(e.target.value)} disabled={isCallActive} className="mood-select">
                  {PATIENT_MOODS.map((mood) => (<option key={mood.value} value={mood.value}>{mood.label}</option>))}
                </select>
                <p className="mood-description">{PATIENT_MOODS.find(m => m.value === patientMood)?.description}</p>
              </div>

              <div className="controls">
                <button onClick={startCall} disabled={isCallActive || isLoading} className="btn btn-primary">
                  {isLoading ? '⏳ Starting...' : '📞 Start Text Call'}
                </button>
                <button onClick={stopCall} disabled={!isCallActive} className="btn btn-danger">🛑 Stop Call</button>
                <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadConversations(); }} className="btn btn-secondary">
                  📋 {showHistory ? 'Hide' : 'View'} History
                </button>
                <button onClick={runScriptAudit} disabled={!selectedConversationId || isAuditLoading} className="btn btn-secondary">
                  {isAuditLoading ? '⏳...' : '✅ Script Audit'}
                </button>
              </div>

              {scriptAudit && (
                <div className="script-audit">
                  <h4>Script Coverage</h4>
                  <div className="audit-summary">
                    <span className="audit-pill audit-asked">Asked: {scriptAudit.askedCount}/{scriptAudit.expectedCount}</span>
                    <span className="audit-pill audit-missed">Missed: {scriptAudit.missedCount}</span>
                  </div>
                  {scriptAudit.missedCount > 0 && (
                    <ul className="audit-list">{scriptAudit.missed.map((q) => (<li key={q.id}><div className="audit-q-label">{q.label}</div></li>))}</ul>
                  )}
                </div>
              )}

              {showHistory && (
                <div className="history-list">
                  <h4>Recent Conversations</h4>
                  {conversations.filter(c => !c.id.startsWith('voice_')).length === 0 ? (
                    <p className="empty-state">No conversations yet</p>
                  ) : (
                    conversations.filter(c => !c.id.startsWith('voice_')).map((conv) => (
                      <div key={conv.id} className={`history-item ${selectedConversationId === conv.id ? 'selected' : ''}`} onClick={() => viewConversation(conv.id)}>
                        <div className="history-meta">
                          <span className="history-turns">{conv.totalTurns} turns</span>
                          <span className="history-messages">{conv.messageCount} msgs</span>
                        </div>
                        <div className="history-time">{new Date(conv.timestamp).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </aside>

            {/* Text Messages */}
            <main className="conversation-area">
              <div className="conversation-header">
                <h2>Text Conversation</h2>
                <span className="message-count">{messages.length} messages</span>
              </div>
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="empty-conversation">
                    <div className="empty-icon">💬</div>
                    <h3>No active conversation</h3>
                    <p>Select a patient mood and click "Start Text Call"</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                      <div className="message-avatar">{msg.role === 'ava' ? '👩‍⚕️' : '🧑'}</div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-sender">{msg.role === 'ava' ? 'Ava (AI)' : `Patient (${getMoodEmoji(currentMood)})`}</span>
                          <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="message-text">{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>
          </>
        ) : (
          <>
            {/* Voice Simulation Sidebar */}
            <aside className="sidebar">
              <h3>Voice Simulation</h3>
              <div className="voice-info">
                <p><strong>AI-to-AI Voice Call</strong></p>
                <p>Ava 👩‍⚕️ and Patient 🧑 converse with distinct voices.</p>
              </div>

              <div className="mood-selector">
                <label>Patient Mood:</label>
                <select value={patientMood} onChange={(e) => setPatientMood(e.target.value)} disabled={isVoiceSimActive} className="mood-select">
                  {PATIENT_MOODS.map((mood) => (<option key={mood.value} value={mood.value}>{mood.label}</option>))}
                </select>
              </div>

              <div className="voice-selector">
                <label>👩‍⚕️ Ava Voice:</label>
                <select value={avaVoice} onChange={(e) => setAvaVoice(e.target.value)} disabled={isVoiceSimActive} className="mood-select">
                  {AVAILABLE_VOICES.map((v) => (<option key={v.id} value={v.id}>{v.name} ({v.gender}, {v.accent})</option>))}
                </select>
              </div>

              <div className="voice-selector">
                <label>🧑 Patient Voice:</label>
                <select value={patientVoice} onChange={(e) => setPatientVoice(e.target.value)} disabled={isVoiceSimActive} className="mood-select">
                  {AVAILABLE_VOICES.map((v) => (<option key={v.id} value={v.id}>{v.name} ({v.gender}, {v.accent})</option>))}
                </select>
              </div>

              <div className="auto-play-toggle">
                <label>
                  <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} disabled={isVoiceSimActive} />
                  Auto-continue conversation
                </label>
              </div>

              <div className="controls">
                {!isVoiceSimActive ? (
                  <button onClick={startVoiceSim} disabled={isLoading} className="btn btn-primary btn-large">
                    {isLoading ? '⏳ Starting...' : '🎙️ Start Voice Simulation'}
                  </button>
                ) : (
                  <>
                    {!autoPlay && (
                      <button onClick={getNextTurn} disabled={isVoiceSimProcessing || audioPlaying} className="btn btn-primary">
                        {isVoiceSimProcessing ? '⏳...' : '▶️ Next Turn'}
                      </button>
                    )}
                    <button onClick={stopVoiceSim} className="btn btn-danger">📴 Stop</button>
                  </>
                )}
                <button onClick={() => { setShowVoiceHistory(!showVoiceHistory); if (!showVoiceHistory) loadConversations(); }} className="btn btn-secondary">
                  📋 {showVoiceHistory ? 'Hide' : 'View'} History
                </button>
                <button onClick={runVoiceScriptAudit} disabled={!selectedVoiceConvId || isVoiceAuditLoading} className="btn btn-secondary">
                  {isVoiceAuditLoading ? '⏳...' : '✅ Script Audit'}
                </button>
              </div>

              {isVoiceSimActive && (
                <div className="voice-status">
                  <div className={`voice-status-item ${audioPlaying ? 'active' : ''}`}>
                    <span className="status-dot"></span>
                    {audioPlaying ? `${currentSpeaker === 'ava' ? '👩‍⚕️ Ava' : '🧑 Patient'} speaking...` : 'Waiting...'}
                  </div>
                  <div className="voice-status-item"><span className="status-dot"></span>Turn: {voiceSimTurn}</div>
                </div>
              )}

              {voiceScriptAudit && (
                <div className="script-audit">
                  <h4>Script Coverage</h4>
                  <div className="audit-summary">
                    <span className="audit-pill audit-asked">Asked: {voiceScriptAudit.askedCount}/{voiceScriptAudit.expectedCount}</span>
                    <span className="audit-pill audit-missed">Missed: {voiceScriptAudit.missedCount}</span>
                  </div>
                  {voiceScriptAudit.missedCount > 0 && (
                    <ul className="audit-list">{voiceScriptAudit.missed.map((q) => (<li key={q.id}><div className="audit-q-label">{q.label}</div></li>))}</ul>
                  )}
                </div>
              )}

              {showVoiceHistory && (
                <div className="history-list">
                  <h4>Voice Conversations</h4>
                  {voiceConversations.length === 0 ? (
                    <p className="empty-state">No voice conversations yet</p>
                  ) : (
                    voiceConversations.map((conv) => (
                      <div key={conv.id} className={`history-item ${selectedVoiceConvId === conv.id ? 'selected' : ''}`} onClick={() => viewVoiceConversation(conv.id)}>
                        <div className="history-meta">
                          <span className="history-turns">{conv.totalTurns} turns</span>
                          <span className="history-messages">{conv.messageCount} msgs</span>
                        </div>
                        <div className="history-time">{new Date(conv.timestamp).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </aside>

            {/* Voice Messages */}
            <main className="conversation-area">
              <div className="conversation-header">
                <h2>Voice Conversation</h2>
                <span className="message-count">{voiceSimMessages.length} messages</span>
              </div>
              <div className="messages-container">
                {voiceSimMessages.length === 0 ? (
                  <div className="empty-conversation">
                    <div className="empty-icon">🎙️</div>
                    <h3>No active voice simulation</h3>
                    <p>Select mood, voices, and click "Start Voice Simulation"</p>
                  </div>
                ) : (
                  voiceSimMessages.map((msg, index) => (
                    <div key={index} className={`message ${msg.role} ${currentSpeaker === msg.role && audioPlaying && index === voiceSimMessages.length - 1 ? 'speaking' : ''}`}>
                      <div className="message-avatar">{msg.role === 'ava' ? '👩‍⚕️' : '🧑'}</div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-sender">{msg.role === 'ava' ? `Ava (${getVoiceLabel(avaVoice)})` : `Patient (${getVoiceLabel(patientVoice)})`}</span>
                          <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="message-text">{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
                {isVoiceSimProcessing && (
                  <div className="message ava processing">
                    <div className="message-avatar">{voiceSimMessages.length > 0 && voiceSimMessages[voiceSimMessages.length - 1].role === 'ava' ? '🧑' : '👩‍⚕️'}</div>
                    <div className="message-content">
                      <div className="typing-indicator"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
