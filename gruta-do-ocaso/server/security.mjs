import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
let runningKdf = 0;
const kdfQueue = [];
async function derive(password, salt, options) {
  assert(kdfQueue.length < 8, 429, 'Muitas operações de senha. Aguarde e tente novamente.');
  if (runningKdf >= 2) await new Promise((resolve) => kdfQueue.push(resolve));
  runningKdf++;
  try {
    return await scrypt(password, salt, 64, options);
  } finally {
    runningKdf--;
    kdfQueue.shift()?.();
  }
}
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function equal(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}
export function text(value, label, min = 1, max = 200) {
  assert(
    typeof value === 'string' && value.trim().length >= min && value.length <= max,
    400,
    `${label}: informe de ${min} a ${max} caracteres.`,
  );
  return value.trim();
}
export function email(value) {
  const result = text(value, 'E-mail', 3, 254).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 400, 'E-mail inválido.');
  return result;
}
export async function hashPassword(password) {
  assert(
    typeof password === 'string' && password.length >= 12 && password.length <= 128,
    400,
    'A senha precisa ter entre 12 e 128 caracteres.',
  );
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [, n, r, p, salt, hash] = stored.split('$');
  const key = await derive(password, salt, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024,
  });
  return equal(key.toString('hex'), hash);
}
export function cookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim().split(/=(.*)/s).slice(0, 2))
      .filter((pair) => pair.length === 2),
  );
}
export function cookie(name, value, path, age, secure = false) {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
}
export async function body(req, limit = 3 * 1024 * 1024) {
  assert(req.headers['content-type']?.split(';')[0] === 'application/json', 415, 'Envie JSON.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    assert(size <= limit, 413, 'Requisição muito grande.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert(
      data && typeof data === 'object' && !Array.isArray(data),
      400,
      'Objeto JSON obrigatório.',
    );
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'JSON inválido.');
  }
}
export function limiter() {
  const attempts = new Map();
  return (key, max = 10, period = 15 * 60_000) => {
    const now = Date.now();
    for (const [k, value] of attempts) if (value.until <= now) attempts.delete(k);
    const current = attempts.get(key) || { count: 0, until: now + period };
    current.count++;
    attempts.set(key, current);
    assert(
      current.count <= max,
      429,
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    );
  };
}
