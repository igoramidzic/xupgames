const APP_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export type ApplicationErrorDetails = {
  code: string | null;
  message: string;
};

function applicationErrorData(value: unknown): { code: string; message: string } | null {
  if (typeof value !== 'object' || value === null || !('code' in value) || !('message' in value)) {
    return null;
  }

  const { code, message } = value;
  if (
    typeof code !== 'string' ||
    !APP_ERROR_CODE_PATTERN.test(code) ||
    typeof message !== 'string' ||
    message.trim() === ''
  ) {
    return null;
  }

  return { code, message };
}

function serializedConvexErrorData(error: Error): unknown {
  const markerIndex = error.message.indexOf('ConvexError:');
  const objectStart = markerIndex === -1 ? -1 : error.message.indexOf('{', markerIndex);
  if (objectStart === -1) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;
  for (let index = objectStart; index < error.message.length; index += 1) {
    const character = error.message[index];
    if (inString) {
      if (isEscaped) isEscaped = false;
      else if (character === '\\') isEscaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(error.message.slice(objectStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

export function applicationErrorDetails(error: unknown, fallback: string): ApplicationErrorDetails {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const details = applicationErrorData(error.data);
    if (details !== null) return details;
  }

  if (error instanceof Error) {
    const details = applicationErrorData(serializedConvexErrorData(error));
    if (details !== null) return details;
  }

  return { code: null, message: fallback };
}

export function userFacingError(error: unknown, fallback: string): string {
  return applicationErrorDetails(error, fallback).message;
}
