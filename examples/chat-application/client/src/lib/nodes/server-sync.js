import { resolveDisplayName } from '../user/identity.js';

const DEFAULT_BASE_URL = (typeof window !== 'undefined' && window.location)
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : 'http://localhost:4000';

function resolveBaseUrl(sx) {
  const provided = sx?.baseUrl ?? (typeof window !== 'undefined' ? window.CHAT_SERVER_URL : null);
  const raw = provided || DEFAULT_BASE_URL;
  return raw.replace(/\/$/, '');
}

function normalizeIncoming(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text) {
    return null;
  }

  return {
    id: message.id ?? `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    author: message.author ?? 'anonymous',
    text,
    createdAt: message.createdAt ?? new Date().toISOString()
  };
}

function normalizeSnapshot(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages
    .map((entry) => normalizeIncoming(entry))
    .filter(Boolean);
}

export function createServerSync(tx, sx) {
  const displayName = resolveDisplayName();
  const baseUrl = resolveBaseUrl(sx);
  const seenIds = new Set();
  let eventSource = null;
  let reconnectTimer = null;

  function remember(message) {
    if (message?.id) {
      seenIds.add(message.id);
    }
  }

  function decorate(message) {
    const normalized = normalizeIncoming(message);
    if (!normalized) {
      return null;
    }

    return {
      ...normalized,
      direction: normalized.author === displayName ? 'outgoing' : 'incoming'
    };
  }

  function emitIncoming(raw) {
    const decorated = decorate(raw);
    if (!decorated || seenIds.has(decorated.id)) {
      return;
    }
    remember(decorated);
    tx.send('incomingMessage', decorated);
  }

  function emitSnapshot(rawMessages) {
    const decorated = normalizeSnapshot(rawMessages)
      .map((entry) => decorate(entry))
      .filter(Boolean);
    decorated.forEach(remember);
    if (decorated.length > 0) {
      tx.send('historySnapshot', decorated);
    }
  }

  async function postMessage(payload) {
    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload?.id,
          author: payload?.author,
          text: payload?.text
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const saved = await response.json();
      emitIncoming(saved);
    } catch (error) {
      console.warn('ServerSync: failed to publish message', error);
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${baseUrl}/history`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const decorated = normalizeSnapshot(data)
        .map((entry) => decorate(entry))
        .filter(Boolean);
      decorated.forEach(remember);
      return decorated;
    } catch (error) {
      console.warn('ServerSync: failed to load history', error);
      return [];
    }
  }

  function connectEvents(delay = 0) {
    if (typeof EventSource === 'undefined') {
      return;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const open = () => {
      const source = new EventSource(`${baseUrl}/events`);
      eventSource = source;

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data || '{}');
          if (data?.type === 'history') {
            emitSnapshot(data.messages);
          } else if (data?.type === 'message') {
            emitIncoming(data.message);
          }
        } catch (error) {
          console.warn('ServerSync: failed to parse SSE message', error);
        }
      };

      source.onerror = () => {
        source.close();
        reconnectTimer = setTimeout(() => connectEvents(Math.min(delay + 1000, 5000)), 2000);
      };
    };

    if (delay > 0) {
      reconnectTimer = setTimeout(open, delay);
    } else {
      open();
    }
  }

  connectEvents();

  return {
    onPublishMessage(payload) {
      if (!payload || typeof payload !== 'object') {
        return;
      }
      postMessage(payload);
    },
    async onHistoryLoaded() {
      const history = await loadHistory();
      tx.reply(history);
    }
  };
}
