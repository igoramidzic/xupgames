import { describe, expect, it } from 'vitest';
import { applicationErrorDetails, userFacingError } from './userFacingError';

describe('userFacingError', () => {
  it('uses the message and stable code provided by the backend', () => {
    const error = { data: { code: 'ROOM_FULL', message: 'This room has reached its player limit.' } };

    expect(applicationErrorDetails(error, 'Try again.')).toEqual({
      code: 'ROOM_FULL',
      message: 'This room has reached its player limit.',
    });
    expect(userFacingError(error, 'Try again.')).toBe('This room has reached its player limit.');
  });

  it('extracts the backend payload from serialized Convex errors', () => {
    const error = new Error(
      '[CONVEX M(rooms:join)] [Request ID: abc] Server Error Uncaught ConvexError: {"code":"ROOM_CLOSED","message":"This room is closed."}'
    );
    expect(applicationErrorDetails(error, 'The room could not be joined.')).toEqual({
      code: 'ROOM_CLOSED',
      message: 'This room is closed.',
    });
  });

  it('never exposes unknown Convex or server errors', () => {
    const error = new Error('[CONVEX M(rooms:create)] [Request ID: 01a62f435d1c02bf] Server Error Called by client');
    expect(applicationErrorDetails(error, 'The room could not be created. Try again.')).toEqual({
      code: null,
      message: 'The room could not be created. Try again.',
    });
  });

  it('rejects malformed application error payloads', () => {
    expect(userFacingError({ data: { code: 'room_full', message: 'raw' } }, 'Try again.')).toBe('Try again.');
    expect(userFacingError({ data: { code: 'ROOM_FULL', message: '' } }, 'Try again.')).toBe('Try again.');
  });
});
