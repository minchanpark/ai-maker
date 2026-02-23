# Security Remediation Playbook

## 1) Patch Runtime Dependencies First

- Upgrade `next` to patched stable line (>= `14.2.35` for current major).
- Re-run:
  - `npm install next@14.2.35`
  - `npm audit --omit=dev`
  - `npm run build && npm run test`

## 2) Add Basic Abuse Controls to API Routes

### Rate limiting (minimum viable)

- Apply to `POST /api/generate`, `POST /api/chat`.
- Use IP key (`x-forwarded-for`) + short window.
- Return `429` on exceed.

Minimal route-level pattern:

```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
const limited = limiter.hit(`chat:${ip}`);
if (!limited.ok) {
  return NextResponse.json({ error: '요청 한도를 초과했습니다.' }, { status: 429 });
}
```

### Origin policy

- Allow same-origin production domain only.
- Reject unknown origins on sensitive/costly endpoints.

```ts
const origin = req.headers.get('origin');
if (origin && origin !== process.env.APP_ORIGIN) {
  return NextResponse.json({ error: '허용되지 않은 origin입니다.' }, { status: 403 });
}
```

## 3) Add Timeout/Cancel Guards for Anthropic Calls

- Wrap all fetch calls with `AbortController`.
- Keep bounded retry count.

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);
try {
  const response = await fetch(url, { ...options, signal: controller.signal });
  return response;
} finally {
  clearTimeout(timeout);
}
```

## 4) Add Security Headers in `next.config.mjs`

Use baseline hardening:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- CSP tuned for Next + Monaco usage

## 5) Minimize Error Detail Leakage

- Keep developer detail in server logs only.
- Return generic client error in production.

```ts
const isProd = process.env.NODE_ENV === 'production';
return NextResponse.json(
  { error: '내부 오류가 발생했습니다.', ...(isProd ? {} : { details: err.message }) },
  { status: 500 },
);
```

## Verification Checklist

1. `npm audit --omit=dev` critical/high == 0
2. `/api/chat`, `/api/generate` return `429` under burst traffic
3. Upstream timeout path returns bounded error latency
4. Response headers include security baseline
5. No secret env usage in client bundles
