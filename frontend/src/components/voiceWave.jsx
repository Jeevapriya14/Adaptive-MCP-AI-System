export default function VoiceWave() {
  return (
    <div className="voice-wave">
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
