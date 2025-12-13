import TypingText from "./TypingText";
import RichCard from "./RichCard";

export default function Message({ message, streaming = false }) {
  const { role, text, meta } = message;

  return (
    <div className={`msg ${role}`}>
      {streaming ? <TypingText text={text} /> : text}
      <RichCard meta={meta} />
    </div>
  );
}
