import { ConvexError } from 'convex/values';

export const MAX_PLAYERS = 50;
export const ROOM_CODE_LENGTH = 8;
export const MIN_ROOM_PASSWORD_LENGTH = 4;
export const MAX_ROOM_PASSWORD_LENGTH = 64;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type AppErrorCode =
  | 'INVALID_SESSION_TOKEN'
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_ROOM_CODE'
  | 'ROOM_NOT_FOUND'
  | 'GAME_NOT_AVAILABLE'
  | 'WRONG_GAME_TYPE'
  | 'ROOM_CLOSED'
  | 'ROOM_FULL'
  | 'ROOM_GAME_NOT_COMPLETE'
  | 'STALE_ROOM_GAME'
  | 'INVALID_ROOM_PASSWORD'
  | 'ROOM_PASSWORD_REQUIRED'
  | 'NOT_A_MEMBER'
  | 'MEMBER_INACTIVE'
  | 'NOT_ROOM_OWNER'
  | 'NEXT_GAME_POLL_NOT_FOUND'
  | 'NEXT_GAME_VOTING_CLOSED'
  | 'NEXT_GAME_NOT_ELIGIBLE'
  | 'NEXT_GAME_INVALID_OPTION'
  | 'NEXT_GAME_NO_VOTES'
  | 'NEXT_GAME_NOT_AVAILABLE'
  | 'ROOM_ACTION_NOT_ELIGIBLE'
  | 'INVALID_POINT'
  | 'INVALID_PRESENCE_SESSION'
  | 'INVALID_PLAYTEST_TARGET'
  | 'PLAYTEST_ALREADY_RUNNING'
  | 'PLAYTEST_NOT_FOUND'
  | 'TRIVIA_GAME_IN_PROGRESS'
  | 'TRIVIA_GAME_NOT_RUNNING'
  | 'TRIVIA_ANSWER_CLOSED'
  | 'TRIVIA_ALREADY_ANSWERED'
  | 'INVALID_TRIVIA_OPTION'
  | 'TYPE_RACER_IN_PROGRESS'
  | 'TYPE_RACER_NOT_RUNNING'
  | 'TYPE_RACER_NOT_PARTICIPATING'
  | 'INVALID_TYPE_RACER_PROGRESS';

export function fail(code: AppErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

export function validateSessionToken(sessionToken: string): string {
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    fail('INVALID_SESSION_TOKEN', 'The session token must be a 32-128 character base64url-style opaque value.');
  }
  return sessionToken;
}

export function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.normalize('NFKC').trim().replace(/ +/g, ' ');
  const characterCount = Array.from(normalized).length;
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
  if (characterCount < 1 || characterCount > 24 || hasControlCharacter) {
    fail('INVALID_DISPLAY_NAME', 'Display names must contain 1-24 visible characters.');
  }
  return normalized;
}

export function normalizeRoomCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(normalized)) {
    fail('INVALID_ROOM_CODE', 'The room code is invalid.');
  }
  return normalized;
}

export function normalizeRoomPassword(password: string): string {
  const normalized = password.normalize('NFKC').trim();
  const characterCount = Array.from(normalized).length;
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
  if (characterCount < MIN_ROOM_PASSWORD_LENGTH || characterCount > MAX_ROOM_PASSWORD_LENGTH || hasControlCharacter) {
    fail(
      'INVALID_ROOM_PASSWORD',
      `Room passwords must contain ${MIN_ROOM_PASSWORD_LENGTH}-${MAX_ROOM_PASSWORD_LENGTH} visible characters.`
    );
  }
  return normalized;
}

export function generateRoomCode(): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const characterIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[characterIndex];
  }
  return code;
}

export function normalizePoint(point: NormalizedPoint): NormalizedPoint {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > 1 ||
    point.y < 0 ||
    point.y > 1
  ) {
    fail('INVALID_POINT', 'Cursor coordinates must contain finite x/y values between 0 and 1.');
  }

  return {
    x: Math.max(0, Math.round(point.x * 100_000) / 100_000),
    y: Math.max(0, Math.round(point.y * 100_000) / 100_000),
  };
}
