import { useEffect, useState } from "react";

export default function TypingText({ text, speed = 15 }) {
  const [out, setOut] = useState("");

  useEffect(() => {
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      setOut((p) => p + text[i]);
      i++;
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);

  return <span>{out}</span>;
}
