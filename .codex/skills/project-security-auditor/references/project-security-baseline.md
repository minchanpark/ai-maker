# Project Security Baseline (2026-02-22)

## Scope and Evidence

- Stack: Next.js 14 App Router + API routes (`/api/generate`, `/api/chat`)
- Core files reviewed:
  - `app/api/generate/route.ts`
  - `app/api/chat/route.ts`
  - `lib/api/generatePackage.ts`
  - `lib/ai/claudeToolDesigner.ts`
  - `lib/chat/validateFileUpdate.ts`
  - `next.config.mjs`
  - `apphosting.yaml`
- Command evidence:
  - `npm audit --omit=dev --json`
  - `rg` pattern scans for secrets, dangerous sinks, rate limiting, security headers

## Confirmed Strengths

1. API request schema validation exists (`safeParse`) on main routes.
2. `/api/chat` target file updates are constrained by path allowlist + content validators.
3. Secret keys are sourced server-side (`CLAUDE_API_KEY` / `ANTHROPIC_API_KEY`) and not directly returned to client.
4. Direct XSS sink patterns (`dangerouslySetInnerHTML`, `eval`) are not present in current UI code.

## Risks Observed

### 1) Critical: runtime dependency vulnerability in `next`

- Evidence: `package.json` uses `next: 14.2.5`.
- `npm audit` reports critical/high advisories on this version range.
- Suggested floor from audit output: `14.2.35`.

### 2) High: abuse-control gaps on cost-bearing API endpoints

- Affected routes: `app/api/generate/route.ts`, `app/api/chat/route.ts`
- No rate limiting or origin/referrer validation patterns detected.
- Risk: unauthenticated abuse can increase API usage cost and trigger availability issues.

### 3) Medium: outbound AI API call timeout/cancel control missing

- Affected calls:
  - `lib/ai/claudeToolDesigner.ts` (non-stream fetch)
  - `app/api/chat/route.ts` (stream and recovery fetch)
- No `AbortController` / request timeout guard found.
- Risk: hanging upstream call increases tail latency and resource pressure.

### 4) Medium: hard security header policy missing

- `next.config.mjs` has no `headers()` policy.
- Missing baseline hardening headers (CSP, X-Frame-Options, Referrer-Policy, etc.).

### 5) Low: detailed internal error strings may be exposed to clients

- Some API error payloads include raw `error.message` in `details`.
- Risk: implementation details can leak during failure modes.

## Priority Order

1. Upgrade Next.js runtime dependency to a patched version.
2. Add abuse controls (`/api/generate`, `/api/chat`): rate limit + origin policy.
3. Add timeout/cancel guards for Anthropic calls and recovery requests.
4. Add baseline security headers in `next.config.mjs`.
5. Sanitize error details for production responses.
