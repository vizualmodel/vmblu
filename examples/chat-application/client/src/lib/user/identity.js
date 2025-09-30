const STORAGE_KEY = 'chat-display-name';
const SESSION_KEY = 'chat-display-name-session';

function safeStorage(getter) {
  try {
    return typeof window !== 'undefined' ? getter() : null;
  } catch (error) {
    return null;
  }
}

function safeSessionStorage() {
  return safeStorage(() => window.sessionStorage);
}

function safeLocalStorage() {
  return safeStorage(() => window.localStorage);
}

function resolveFromQuery() {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('name');
    return value && value.trim() ? value.trim() : null;
  } catch (error) {
    return null;
  }
}

function generateFallback() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `User-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `User-${Date.now().toString(36).slice(-4)}`;
}

function updateDocumentTitle(name) {
  if (typeof document !== 'undefined') {
    document.title = `I am ${name}`;
  }
}

export function resolveDisplayName(defaultName = 'You') {
  const session = safeSessionStorage();
  const local = safeLocalStorage();
  const queryName = resolveFromQuery();

  if (queryName) {
    session?.setItem(SESSION_KEY, queryName);
    local?.setItem(STORAGE_KEY, queryName);
    updateDocumentTitle(queryName);
    return queryName;
  }

  const storedSession = session?.getItem(SESSION_KEY);
  if (storedSession && storedSession.trim()) {
    const trimmed = storedSession.trim();
    updateDocumentTitle(trimmed);
    return trimmed;
  }

  const storedLocal = local?.getItem(STORAGE_KEY);
  if (storedLocal && storedLocal.trim()) {
    const trimmed = storedLocal.trim();
    session?.setItem(SESSION_KEY, trimmed);
    updateDocumentTitle(trimmed);
    return trimmed;
  }

  const fallback = defaultName === 'You' ? generateFallback() : defaultName;
  session?.setItem(SESSION_KEY, fallback);
  local?.setItem(STORAGE_KEY, fallback);
  updateDocumentTitle(fallback);
  return fallback;
}
