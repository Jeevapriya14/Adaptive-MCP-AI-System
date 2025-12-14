export default function RichCard({ meta }) {
  if (!meta || !meta.type) return null;

  if (meta.type === "meeting") {
    return (
      <div className="card">
        <h4> Meeting Scheduled</h4>
        <p><b>{meta.title}</b></p>
        <p>{meta.date} @ {meta.time}</p>
        {meta.joinUrl && (
          <a href={meta.joinUrl} target="_blank">
            Join Meeting
          </a>
        )}
      </div>
    );
  }

  if (meta.type === "task") {
    return (
      <div className="card">
        <h4> Task Created</h4>
        <p><b>{meta.title}</b></p>
        <p>Due: {meta.dueDate}</p>
      </div>
    );
  }

  return null;
}
