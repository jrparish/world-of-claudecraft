import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 64;

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt.toString('hex')}:${key.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [saltHex, keyHex] = stored.split(':');
    if (!saltHex || !keyHex) return resolve(false);
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err || key.length !== expected.length) return resolve(false);
      resolve(timingSafeEqual(key, expected));
    });
  });
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function validUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(u);
}

export function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 6 && p.length <= 128;
}

export function validCharName(n: unknown): n is string {
  return typeof n === 'string' && /^[A-Za-z][A-Za-z' -]{1,15}$/.test(n);
}
