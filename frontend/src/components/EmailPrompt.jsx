import { useState } from "react";
import { setUserEmail } from "../utils/session";

export default function EmailPrompt({ onDone }) {
  const [email, setEmail] = useState("");

  const save = () => {
    if (!email.includes("@")) return;
    setUserEmail(email.trim().toLowerCase());
    onDone();
  };

  return (
    <div className="email-card">

    <div className="email-box">
      <h3>Enter your email</h3>
      <p>Used for reminders, meetings, and confirmations</p>

      <input
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button onClick={save}>Continue</button>
    </div>
    </div>
  );
}
