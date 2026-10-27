import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt$32768$8$3$';
const dummy = `${prefix}${'00'.repeat(16)}$${'00'.repeat(64)}`;

export function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128)
        throw new TypeError('Use a password between 12 and 128 characters.');
}

export async function hashPassword(password) {
    validatePassword(password);
    const salt = randomBytes(16);
    const key = await derive(password, salt, 64, options);
    return `${prefix}${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
    // Missing accounts perform the same derivation as real accounts.
    const record = encoded ?? dummy;
    if (!record.startsWith(prefix)) return false;
    const [, , , , salt, hash] = record.split('$');
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
    const key = await derive(password, Buffer.from(salt, 'hex'), 64, options);
    return timingSafeEqual(key, Buffer.from(hash, 'hex')) && Boolean(encoded);
}
