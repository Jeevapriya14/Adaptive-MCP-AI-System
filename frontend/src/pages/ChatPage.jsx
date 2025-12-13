import { useState } from "react";
import ChatBox from "../components/ChatBox";
import EmailPrompt from "../components/EmailPrompt";
import { getUserEmail } from "../utils/session";
import { toggleTheme } from "../hooks/useTheme"; // ✅ IMPORT
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
    <div className="app">
      <header className="header">
        <span>🤖 ScoutBuild AI Assistant</span>

        {/* ✅ THEME TOGGLE BUTTON */}
        <button
          onClick={toggleTheme}
          className="theme-btn"
          title="Toggle theme"
        >
          🌓
        </button>
      </header>

      <ChatBox />
    </div>
  );
}
