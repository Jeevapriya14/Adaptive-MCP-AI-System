import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/api";
import Message from "./Message";
import { MESSAGE_TYPES, createMessage } from "../types/message";
import { streamMessage } from "../api/stream";

export default function ChatBox() {
   const STREAMING = false; // flip to true when backend ready

  const [messages, setMessages] = useState([
    createMessage(MESSAGE_TYPES.SYSTEM, "Type /help to begin")
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const push = (msg) =>
    setMessages((m) => [...m, msg]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    push(createMessage(MESSAGE_TYPES.USER, input));
    setInput("");
    setLoading(true);
    try {
  if (!STREAMING) {
    // 🔹 NORMAL (current backend)
    const res = await sendMessage(input);

    push(
      createMessage(
        MESSAGE_TYPES.BOT,
        res.text || "No response",
        res.meta || {}
      )
    );
  } else {
    // 🔹 FUTURE STREAMING MODE (backend not ready yet)
    let buffer = "";

    const botMsg = createMessage(MESSAGE_TYPES.BOT, "");
    push(botMsg);

    streamMessage(
      input,
      (chunk) => {
        buffer += chunk;
        botMsg.text = buffer;
        setMessages((m) => [...m]); // force re-render
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

    return; // important: prevent finally block
  }
} catch {
  push(
    createMessage(
      MESSAGE_TYPES.SYSTEM,
      "⚠️ Something went wrong. Please retry."
    )
  );
} finally {
  if (!STREAMING) {
    setLoading(false);
  }
}

  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m, i) => (
          <Message
            key={m.id}
            message={m}
            streaming={m.role === MESSAGE_TYPES.BOT && loading}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask, create, schedule..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}
