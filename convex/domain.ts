import { ConvexError } from 'convex/values';

export const MAX_PLAYERS = 50;
export const ROOM_CODE_LENGTH = 8;
export const MAX_STROKES_RETURNED = 200;
export const MAX_POINTS_PER_STROKE = 1024;
export const MAX_APPEND_POINTS = 64;
export const MIN_ROOM_PASSWORD_LENGTH = 4;
export const MAX_ROOM_PASSWORD_LENGTH = 64;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type DrawingPoint = {
  x: number;
  y: number;
};

export type AppErrorCode =
  | 'INVALID_SESSION_TOKEN'
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_ROOM_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_FULL'
  | 'INVALID_ROOM_PASSWORD'
  | 'ROOM_PASSWORD_REQUIRED'
  | 'NOT_A_MEMBER'
  | 'MEMBER_INACTIVE'
  | 'NOT_ROOM_OWNER'
  | 'INVALID_COLOR'
  | 'INVALID_STROKE_WIDTH'
  | 'INVALID_POINT'
  | 'INVALID_POINT_BATCH'
  | 'INVALID_POINT_COUNT'
  | 'INVALID_PRESENCE_SESSION'
  | 'STROKE_NOT_FOUND'
  | 'NOT_STROKE_AUTHOR'
  | 'STROKE_FINISHED'
  | 'STROKE_OUT_OF_SYNC'
  | 'STROKE_POINT_LIMIT';

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

export function normalizeColor(color: string): string {
  if (!COLOR_PATTERN.test(color)) {
    fail('INVALID_COLOR', 'Colors must use the #RRGGBB format.');
  }
  return color.toLowerCase();
}

export function normalizeStrokeWidth(width: number): number {
  if (!Number.isFinite(width) || width < 1 || width > 40) {
    fail('INVALID_STROKE_WIDTH', 'Stroke width must be between 1 and 40.');
  }
  return Math.round(width * 100) / 100;
}

export function normalizePoint(point: DrawingPoint): DrawingPoint {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > 1 ||
    point.y < 0 ||
    point.y > 1
  ) {
    fail('INVALID_POINT', 'Drawing points must contain finite x/y values between 0 and 1.');
  }

  return {
    x: Math.max(0, Math.round(point.x * 100_000) / 100_000),
    y: Math.max(0, Math.round(point.y * 100_000) / 100_000),
  };
}

export function normalizePointBatch(points: DrawingPoint[]): DrawingPoint[] {
  if (points.length < 1 || points.length > MAX_APPEND_POINTS) {
    fail('INVALID_POINT_BATCH', `Append batches must contain 1-${MAX_APPEND_POINTS} points.`);
  }
  return points.map(normalizePoint);
}

export function validateExpectedPointCount(expectedPointCount: number): number {
  if (!Number.isInteger(expectedPointCount) || expectedPointCount < 1 || expectedPointCount > MAX_POINTS_PER_STROKE) {
    fail('INVALID_POINT_COUNT', `Expected point count must be an integer between 1 and ${MAX_POINTS_PER_STROKE}.`);
  }
  return expectedPointCount;
}

export function pointsMatchAt(
  storedPoints: DrawingPoint[],
  expectedStart: number,
  candidatePoints: DrawingPoint[]
): boolean {
  if (expectedStart < 0 || expectedStart + candidatePoints.length > storedPoints.length) {
    return false;
  }

  return candidatePoints.every((point, index) => {
    const storedPoint = storedPoints[expectedStart + index];
    return storedPoint.x === point.x && storedPoint.y === point.y;
  });
}
