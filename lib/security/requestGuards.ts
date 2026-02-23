import type { NextRequest } from 'next/server';

interface RateLimitState {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
}

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const ORIGIN_ENV_KEYS = ['APP_ORIGIN', 'ALLOWED_ORIGINS'] as const;

const globalForRateLimit = globalThis as typeof globalThis & {
  __requestRateLimitStore?: Map<string, RateLimitState>;
};

function getRateLimitStore(): Map<string, RateLimitState> {
  if (!globalForRateLimit.__requestRateLimitStore) {
    globalForRateLimit.__requestRateLimitStore = new Map<string, RateLimitState>();
  }

  return globalForRateLimit.__requestRateLimitStore;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseIpFromForwarded(value: string): string {
  return value
    .split(',')[0]
    ?.trim()
    .replace(/^::ffff:/, '') || 'unknown';
}

export function getClientIp(request: NextRequest): string {
  const candidate =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip');

  if (!candidate) {
    return 'unknown';
  }

  return parseIpFromForwarded(candidate);
}

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readConfiguredOrigins(): string[] {
  const values = ORIGIN_ENV_KEYS.flatMap((key) => {
    const raw = process.env[key];
    if (!raw) return [];

    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  });

  const normalized = values
    .map((value) => parseOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}

function resolveRequestOrigin(request: NextRequest): string | null {
  const withOptionalNextUrl = request as NextRequest & { nextUrl?: URL };
  if (withOptionalNextUrl.nextUrl?.origin) {
    return withOptionalNextUrl.nextUrl.origin;
  }

  return parseOrigin(request.url);
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const configured = readConfiguredOrigins();
  if (configured.length > 0) {
    return new Set(configured);
  }

  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin) {
    return new Set([requestOrigin]);
  }

  return new Set<string>();
}

export function verifyOrigin(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  if (SAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
    return { ok: true };
  }

  const strict = (process.env.ORIGIN_CHECK_STRICT ?? 'true').toLowerCase() !== 'false';
  if (!strict) {
    return { ok: true };
  }

  const allowed = getAllowedOrigins(request);
  if (allowed.size === 0) {
    return { ok: true };
  }

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  if (originHeader) {
    const origin = parseOrigin(originHeader);
    if (!origin) {
      return { ok: false, reason: 'origin 헤더 형식이 올바르지 않습니다.' };
    }

    if (allowed.has(origin)) {
      return { ok: true };
    }

    return { ok: false, reason: '허용되지 않은 origin입니다.' };
  }

  if (refererHeader) {
    const refererOrigin = parseOrigin(refererHeader);
    if (refererOrigin && allowed.has(refererOrigin)) {
      return { ok: true };
    }

    return { ok: false, reason: '허용되지 않은 referer입니다.' };
  }

  return { ok: false, reason: 'origin/referer 헤더가 필요합니다.' };
}

export function getRateLimitWindowMs(): number {
  return readPositiveIntEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMIT_WINDOW_MS);
}

export function getChatRateLimitMax(): number {
  return readPositiveIntEnv('CHAT_RATE_LIMIT_MAX', 45);
}

export function getGenerateRateLimitMax(): number {
  return readPositiveIntEnv('GENERATE_RATE_LIMIT_MAX', 20);
}

export function enforceRateLimit(request: NextRequest, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();
  const clientIp = getClientIp(request);
  const key = `${options.bucket}:${clientIp}`;

  const existing = store.get(key);
  let state: RateLimitState;

  if (!existing || existing.resetAt <= now) {
    state = {
      count: 0,
      resetAt: now + options.windowMs,
    };
  } else {
    state = existing;
  }

  state.count += 1;
  store.set(key, state);

  const ok = state.count <= options.limit;
  const remaining = Math.max(0, options.limit - state.count);
  const retryAfterMs = Math.max(0, state.resetAt - now);
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  if (store.size > 2000) {
    for (const [storedKey, storedValue] of Array.from(store.entries())) {
      if (storedValue.resetAt <= now) {
        store.delete(storedKey);
      }
    }
  }

  return {
    ok,
    limit: options.limit,
    remaining,
    resetAt: state.resetAt,
    retryAfterSeconds,
  };
}
