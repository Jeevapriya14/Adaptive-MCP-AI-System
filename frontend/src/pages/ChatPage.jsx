import { useState } from "react";
import ChatBox from "../components/ChatBox";
import EmailPrompt from "../components/EmailPrompt";
import { getUserEmail } from "../utils/session";
import { toggleTheme } from "../hooks/useTheme";
import "../styles/chat.css";

export default function ChatPage() {
  const [emailReady, setEmailReady] = useState(!!getUserEmail());
  if (!emailReady) {
    return (
      <div className="app center">
        <EmailPrompt onDone={() => setEmailReady(true)} />
      </div>
    );
  }
  return (
    <div className="app chat-layout">
      <header className="header">
        <span>MCP AI Assistant</span>
        <button
          onClick={toggleTheme}
          className="theme-btn"
          title="Toggle theme"
        >
                  </button>
      </header>

      <div className="chat-wrapper">
        <ChatBox />
      </div>
    </div>
  );
}
