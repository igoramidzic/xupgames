const USER_ERROR_MESSAGES = {
  INVALID_SESSION_TOKEN: 'Your browser session is invalid. Refresh the page and try again.',
  INVALID_DISPLAY_NAME: 'Enter a display name with 1–24 visible characters.',
  INVALID_ROOM_CODE: 'That room code is invalid.',
  ROOM_NOT_FOUND: 'That room could not be found.',
  WRONG_GAME_TYPE: 'This action is not available for this game.',
  ROOM_CLOSED: 'This room is closed.',
  ROOM_FULL: 'This room is full.',
  INVALID_ROOM_PASSWORD: 'Use a room password with 4–64 visible characters.',
  ROOM_PASSWORD_REQUIRED: 'Enter the room password to join.',
  NOT_A_MEMBER: 'You are not a member of this room.',
  MEMBER_INACTIVE: 'You are no longer active in this room.',
  NOT_ROOM_OWNER: 'Only the room owner can do that.',
  INVALID_POINT: 'That cursor position is invalid.',
  INVALID_PRESENCE_SESSION: 'Your live session expired. Refresh the page and try again.',
  INVALID_PLAYTEST_TARGET: 'Choose a valid number of simulated players.',
  PLAYTEST_ALREADY_RUNNING: 'A playtest is already running for this room.',
  PLAYTEST_NOT_FOUND: 'No active playtest was found.',
  TRIVIA_GAME_IN_PROGRESS: 'A trivia game is already in progress.',
  TRIVIA_GAME_NOT_RUNNING: 'The trivia game is not running yet.',
  TRIVIA_ANSWER_CLOSED: 'Time is up for this question.',
  TRIVIA_ALREADY_ANSWERED: 'Your answer is already locked in.',
  INVALID_TRIVIA_OPTION: 'Choose one of the available answers.',
} as const;

type UserErrorCode = keyof typeof USER_ERROR_MESSAGES;

function codeFromError(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data;
    if (typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string') {
      return data.code;
    }
  }

  if (error instanceof Error) {
    return error.message.match(/"code"\s*:\s*"([A-Z_]+)"/)?.[1] ?? null;
  }

  return null;
}

export function userFacingError(error: unknown, fallback: string): string {
  const code = codeFromError(error);
  return code !== null && code in USER_ERROR_MESSAGES ? USER_ERROR_MESSAGES[code as UserErrorCode] : fallback;
}
