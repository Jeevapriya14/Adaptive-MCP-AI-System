import { getSessionId, getUserEmail } from "../utils/session";

export const streamMessage = (text, onChunk, onDone, onError) => {
  const params = new URLSearchParams({
    text,
    sessionId: getSessionId(),
    email: getUserEmail() || ""
  });

  const es = new EventSource(
    `${import.meta.env.VITE_API_BASE_URL}/webhook/stream?${params}`
  );

  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.done) {
      es.close();
      onDone?.(data);
    } else {
      onChunk?.(data.chunk);
    }
  };

  es.onerror = (err) => {
    es.close();
    onError?.(err);
  };

  return () => es.close();
};
