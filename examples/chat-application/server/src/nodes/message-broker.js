import { randomUUID } from "crypto";

function createId(prefix = "msg") {
  if (typeof randomUUID === "function") {
    return `${prefix}-${randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const text = typeof message.text === "string" ? message.text : "";
  if (!text.trim()) {
    return null;
  }

  return {
    id: message.id ?? createId("srv"),
    author: message.author ?? "anonymous",
    text: text.trim(),
    createdAt: message.createdAt ?? new Date().toISOString()
  };
}

export function createMessageBroker(tx, sx) {
  return {
    onAcceptMessage(payload) {
      const message = normalizeMessage(payload);
      if (!message) {
        return;
      }

      tx.send("fanOut", message);
    }
  };
}
