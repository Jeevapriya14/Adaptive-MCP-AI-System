export const MESSAGE_TYPES = {
  USER: "user",
  BOT: "bot",
  SYSTEM: "system"
};

export const createMessage = (role, text, meta = {}) => ({
  id: crypto.randomUUID(),
  role,
  text,
  meta
});
