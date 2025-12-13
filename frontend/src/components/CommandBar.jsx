export default function CommandBar({ onCommand }) {
  const cmds = [
    "/help",
    "show all tasks",
    "show all meetings",
    "delete task id",
    "/ai explain this code"
  ];

  return (
    <div className="command-bar">
      {cmds.map((c) => (
        <button key={c} onClick={() => onCommand(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
