import { describe, expect, it } from 'vitest';
import { userFacingError } from './userFacingError';

describe('userFacingError', () => {
  it('maps recognized application error codes to curated copy', () => {
    expect(userFacingError({ data: { code: 'ROOM_FULL', message: 'internal wording' } }, 'Try again.')).toBe(
      'This room is full.'
    );
  });

  it('extracts recognized codes from serialized Convex errors', () => {
    const error = new Error(
      '[CONVEX M(rooms:join)] [Request ID: abc] Server Error Uncaught ConvexError: {"code":"ROOM_CLOSED","message":"raw"}'
    );
    expect(userFacingError(error, 'The room could not be joined.')).toBe('This room is closed.');
  });

  it('never exposes unknown Convex or server errors', () => {
    const error = new Error('[CONVEX M(rooms:create)] [Request ID: 01a62f435d1c02bf] Server Error Called by client');
    expect(userFacingError(error, 'The room could not be created. Try again.')).toBe(
      'The room could not be created. Try again.'
    );
  });
});
