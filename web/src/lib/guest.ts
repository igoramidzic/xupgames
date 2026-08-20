export type GuestIdentity = {
  sessionToken: string;
  displayName: string;
};

const SESSION_TOKEN_KEY = 'xupgames:guest-session';
const DISPLAY_NAME_KEY = 'xupgames:display-name';
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateDisplayName(value: string) {
  const name = normalizeDisplayName(value);

  if (!name) {
    return 'Enter your name to continue.';
  }

  if (Array.from(name).length > 24) {
    return 'Keep your name to 24 characters or fewer.';
  }

  return null;
}

export function readGuest(): GuestIdentity | null {
  const sessionToken = window.localStorage.getItem(SESSION_TOKEN_KEY);
  const displayName = window.localStorage.getItem(DISPLAY_NAME_KEY);

  if (!sessionToken || !SESSION_TOKEN_PATTERN.test(sessionToken) || !displayName) {
    return null;
  }

  return { sessionToken, displayName };
}

export function saveGuest(displayName: string): GuestIdentity {
  const nameError = validateDisplayName(displayName);
  if (nameError) {
    throw new Error(nameError);
  }

  const normalizedName = normalizeDisplayName(displayName);
  const storedToken = window.localStorage.getItem(SESSION_TOKEN_KEY);
  const sessionToken = storedToken && SESSION_TOKEN_PATTERN.test(storedToken) ? storedToken : createSessionToken();

  window.localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  window.localStorage.setItem(DISPLAY_NAME_KEY, normalizedName);

  return { sessionToken, displayName: normalizedName };
}

function createSessionToken() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
