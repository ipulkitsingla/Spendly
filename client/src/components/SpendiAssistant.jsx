import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { hapticError, hapticLight, hapticSuccess } from '../utils/haptics.js';

const SUGGESTIONS = [
  'How can I save more this month?',
  'Compare my food spending this month vs last month.',
  'What if I skip coffee for 3 months?',
  'Make me a debt payoff plan.',
];

export default function SpendiAssistant() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi, I am SPENDI. Ask me anything about money, planning, savings, or Spendly.',
    },
  ]);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  useEffect(() => {
    if (!open) return;
    setLoadingHistory(true);
    api
      .spendiHistory()
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
      })
      .catch(() => {
        /* keep local default if history load fails */
      })
      .finally(() => setLoadingHistory(false));
  }, [open]);

  const send = async (forcedPrompt) => {
    const prompt = (forcedPrompt ?? text).trim();
    if (!prompt || busy) return;
    if (!forcedPrompt) setText('');
    setBusy(true);
    const nextHistory = [...history, { role: 'user', content: prompt }];
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    hapticLight();
    try {
      const res = await api.spendiChat(prompt, nextHistory);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply || 'No reply.' }]);
      hapticSuccess();
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
      hapticError();
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = async () => {
    if (busy) return;
    hapticLight();
    setBusy(true);
    try {
      await api.clearSpendiHistory();
      setMessages([
        {
          role: 'assistant',
          content: 'History cleared. I am ready for a fresh start.',
        },
      ]);
      hapticSuccess();
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
      hapticError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="spendi-wrap">
      {open && (
        <div className="spendi-panel card" role="dialog" aria-label="SPENDI assistant">
          <div className="spendi-head">
            <strong>SPENDI AI</strong>
            <div className="spendi-head-actions">
              <button type="button" className="btn btn-ghost" onClick={clearHistory} disabled={busy}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  hapticLight();
                  setOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
          <div className="spendi-chips">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="spendi-chip"
                disabled={busy}
                onClick={() => {
                  setText(s);
                  send(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="spendi-messages">
            {loadingHistory && <div className="spendi-msg spendi-msg-ai">Loading your history…</div>}
            {messages.map((m, idx) => (
              <div key={idx} className={`spendi-msg ${m.role === 'user' ? 'spendi-msg-user' : 'spendi-msg-ai'}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="spendi-msg spendi-msg-ai">Thinking…</div>}
          </div>
          <div className="spendi-input-row">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask SPENDI anything…"
            />
            <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
              Send
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="spendi-fab"
        aria-label="Open SPENDI assistant"
        onClick={() => {
          hapticLight();
          setOpen((v) => !v);
        }}
      >
        AI
      </button>
    </div>
  );
}
