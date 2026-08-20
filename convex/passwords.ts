const PASSWORD_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export type PasswordCredential = {
  hash: string;
  salt: string;
  iterations: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: ArrayBuffer, iterations: number): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    passwordKey,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

export async function createPasswordCredential(password: string): Promise<PasswordCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(password, salt.buffer, PASSWORD_ITERATIONS);
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPasswordCredential(password: string, credential: PasswordCredential): Promise<boolean> {
  const salt = base64ToBytes(credential.salt);
  const candidateHash = await derivePasswordHash(password, salt.buffer as ArrayBuffer, credential.iterations);
  const expectedHash = base64ToBytes(credential.hash);
  if (candidateHash.length !== expectedHash.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < candidateHash.length; index += 1) {
    difference |= candidateHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}
