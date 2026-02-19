import { useRef } from "react";

export function useVoice(onResult, onStart, onEnd) {
  const recognitionRef = useRef(null);

  const start = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      onStart && onStart();
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onResult && onResult(text);
    };

    recognition.onend = () => {
      onEnd && onEnd();
    };

    recognition.onerror = () => {
      onEnd && onEnd();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  return { start, stop };
}
