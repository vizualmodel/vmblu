function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveSource(message, fallback) {
  if (!message || typeof message !== 'object') {
    return fallback;
  }

  if (message.direction === 'incoming') {
    return 'remote';
  }

  if (message.direction === 'outgoing') {
    return 'local';
  }

  return fallback;
}

function normalizeAuthor(message, source) {
  if (typeof message.author === 'string' && message.author.trim()) {
    return message.author.trim();
  }

  return source === 'remote' ? 'Remote' : 'You';
}

function normalizeMessage(message, defaultSource) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const source = resolveSource(message, defaultSource);
  const now = new Date().toISOString();

  return {
    id: message.id ?? createId(source ?? 'msg'),
    author: normalizeAuthor(message, source),
    text: message.text ?? '',
    createdAt: message.createdAt ?? now,
    direction: source === 'remote' ? 'incoming' : 'outgoing'
  };
}

/**
 * @node MessageStore
 */

export function createMessageStore(tx, sx) {
  const messages = new Map();

  function emitChanges() {
    const snapshot = Array.from(messages.values())
      .sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf())
      .map((entry) => ({ ...entry }));

    tx.send('messagesChanged', snapshot);
  }

  function upsert(message) {
    if (!message) {
      return;
    }

    const existing = messages.get(message.id);
    if (existing) {
      const direction = existing.direction;
      messages.set(message.id, {
        ...existing,
        ...message,
        direction
      });
    } else {
      messages.set(message.id, message);
    }

    emitChanges();
  }

  async function hydrate() {
    try {
      const history = await tx.request('loadHistory', { since: null });
      if (Array.isArray(history)) {
        history
          .map((entry) => normalizeMessage(entry, 'remote'))
          .filter(Boolean)
          .forEach((entry) => {
            upsert(entry);
          });
      }
    } catch (error) {
      console.warn('MessageStore: history request failed', error);
    }
  }

  queueMicrotask(hydrate);

  return {
    onSaveMessage(payload) {
      const source = resolveSource(payload, 'local');
      upsert(normalizeMessage(payload, source));
    },
    onHydrate(payload) {
      if (!Array.isArray(payload)) {
        return;
      }

      payload
        .map((entry) => normalizeMessage(entry, 'remote'))
        .filter(Boolean)
        .forEach(upsert);
    }
  };
}
