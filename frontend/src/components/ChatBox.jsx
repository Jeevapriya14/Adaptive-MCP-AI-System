import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/api";
import { streamMessage } from "../api/stream";
import Message from "./Message";
import { MESSAGE_TYPES, createMessage } from "../types/message";
import { useVoice } from "../hooks/useVoice";
import "../styles/chat.css";


export default function ChatBox() {
  const STREAMING = false;

  const [messages, setMessages] = useState([
    createMessage(MESSAGE_TYPES.SYSTEM, "Type /help to begin")
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelpHint, setShowHelpHint] = useState(true);
  const [listening, setListening] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const push = (msg) =>
    setMessages((prev) => [...prev, msg]);

  // 🎤 Voice hook
  const voice = useVoice(
    (text) => {
      setInput(text);
      setListening(false);
      setShowHelpHint(false);
    },
    () => setListening(true),     // onStart
    () => setListening(false)     // onEnd
  );

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    push(createMessage(MESSAGE_TYPES.USER, userText));
    setInput("");
    setLoading(true);
    setShowHelpHint(false);

    try {
      if (!STREAMING) {
        const res = await sendMessage(userText);

        push(
          createMessage(
            MESSAGE_TYPES.BOT,
            res?.text || "No response",
            res?.meta || {}
          )
        );
      } else {
        let buffer = "";
        const botMsg = createMessage(MESSAGE_TYPES.BOT, "");
        push(botMsg);

        streamMessage(
          userText,
          (chunk) => {
            buffer += chunk;
            botMsg.text = buffer;
            setMessages((m) => [...m]);
          },
          () => setLoading(false),
          () => {
            push(
              createMessage(
                MESSAGE_TYPES.SYSTEM,
                "⚠️ Streaming failed"
              )
            );
            setLoading(false);
          }
        );
        return;
      }
    } catch {
      push(
        createMessage(
          MESSAGE_TYPES.SYSTEM,
          "⚠️ Something went wrong. Please retry."
        )
      );
    } finally {
      if (!STREAMING) setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {/* Messages */}
      <div className="messages">
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            streaming={m.role === MESSAGE_TYPES.BOT && loading}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* /help hint */}
      {showHelpHint && !listening && (
        <div className="help-hint">
          💡 Type <b>/help</b> to see available commands
        </div>
      )}

      {/* Input area */}
      <div className="input-area">
        {!listening ? (
          <>
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.trim()) setShowHelpHint(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask, create, schedule…"
              disabled={loading}
            />

            <button
              type="button"
              onClick={voice.start}
              disabled={loading}
              title="Speak"
            >
              🎤
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
            >
              Send
            </button>
          </>
        ) : (
          // 🎧 Voice Wave UI
          <div className="voice-wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <button
              className="stop-voice"
              onClick={voice.stop}
              title="Stop"
            >
              ✖
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
