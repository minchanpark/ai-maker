#!/bin/bash
set -euo pipefail

ROOT_DIR="${1:-.}"
if [[ ! -d "$ROOT_DIR" ]]; then
  echo "ERROR: directory not found: $ROOT_DIR"
  exit 1
fi

cd "$ROOT_DIR"

echo "== Project Security Quick Check =="
echo "cwd: $(pwd)"

audit_with_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "WARN: npm not found. Skip dependency audit."
    return
  fi

  local tmp
  tmp="$(mktemp)"
  if npm audit --omit=dev --json >"$tmp" 2>/dev/null; then
    :
  else
    # npm audit exits non-zero when vulnerabilities exist.
    :
  fi

  node - "$tmp" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
try {
  const raw = fs.readFileSync(path, 'utf8').trim() || '{}';
  const payload = JSON.parse(raw);
  const meta = (payload.metadata && payload.metadata.vulnerabilities) || {};
  const total = Number.isFinite(meta.total) ? meta.total : Object.keys(payload.vulnerabilities || {}).length;
  const critical = Number(meta.critical || 0);
  const high = Number(meta.high || 0);
  const moderate = Number(meta.moderate || 0);
  const low = Number(meta.low || 0);

  console.log('\n[Dependency Audit]');
  console.log(`INFO: total=${total}, critical=${critical}, high=${high}, moderate=${moderate}, low=${low}`);

  if (critical > 0 || high > 0) {
    console.log('WARN: runtime dependency vulnerabilities need immediate upgrade review.');
    const fix = payload.vulnerabilities && payload.vulnerabilities.next && payload.vulnerabilities.next.fixAvailable;
    if (fix && fix.version) {
      console.log(`INFO: next fixAvailable=${fix.version}`);
    }
  } else {
    console.log('PASS: no critical/high runtime vulnerabilities in npm audit output.');
  }
} catch (error) {
  console.log(`WARN: failed to parse npm audit output (${error.message}).`);
}
NODE

  rm -f "$tmp"
}

check_api_boundary() {
  printf '\n[API Boundary]\n'

  local route_count
  route_count="$(rg --files app/api | wc -l | tr -d ' ')"
  echo "INFO: api files=${route_count}"

  if rg -n "safeParse\(" app/api >/dev/null 2>&1; then
    echo "PASS: zod safeParse validation detected in API routes."
  else
    echo "WARN: safeParse validation not found in API routes."
  fi

  if rg -n "rate.?limit|rateLimit|limiter" app/api >/dev/null 2>&1; then
    echo "PASS: rate limiting pattern detected in API routes."
  else
    echo "WARN: rate limiting pattern not detected in API routes."
  fi

  if rg -n "origin|referer|csrf" app/api >/dev/null 2>&1; then
    echo "PASS: origin/csrf validation pattern detected in API routes."
  else
    echo "WARN: origin/csrf validation pattern not detected in API routes."
  fi
}

check_secrets_and_client_exposure() {
  printf '\n[Secret Handling]\n'

  if rg -n "process\\.env\\.(CLAUDE|ANTHROPIC)" app components store --glob "**/*.tsx" >/dev/null 2>&1; then
    echo "WARN: server secret env usage detected in client-side TSX files."
  else
    echo "PASS: CLAUDE/ANTHROPIC env usage not found in client TSX files."
  fi

  if rg -n "NEXT_PUBLIC_.*(KEY|TOKEN|SECRET)" .env.example apphosting.yaml app lib components >/dev/null 2>&1; then
    echo "WARN: suspicious NEXT_PUBLIC secret-like env naming found."
  else
    echo "PASS: no obvious NEXT_PUBLIC secret-like env naming found."
  fi
}

check_headers_and_runtime_hardening() {
  printf '\n[Headers and Runtime Hardening]\n'

  if rg -n "headers\s*\(" next.config.mjs >/dev/null 2>&1; then
    echo "PASS: custom security headers config detected in next.config.mjs."
  else
    echo "WARN: no custom security headers found in next.config.mjs."
  fi

  if rg -n "AbortController|signal:\s*" app/api lib >/dev/null 2>&1; then
    echo "PASS: outbound fetch timeout/cancel pattern detected."
  else
    echo "WARN: outbound fetch timeout/cancel pattern not detected."
  fi
}

check_dangerous_sinks() {
  printf '\n[Dangerous Sink Scan]\n'

  if rg -n "dangerouslySetInnerHTML|eval\(|new Function\(|child_process|exec\(" app lib components store >/dev/null 2>&1; then
    echo "WARN: potentially dangerous sink pattern detected. Review required."
  else
    echo "PASS: no direct dangerous sink patterns detected."
  fi
}

audit_with_npm
check_api_boundary
check_secrets_and_client_exposure
check_headers_and_runtime_hardening
check_dangerous_sinks

printf '\nDone. Use the findings with manual code review before final judgment.\n'
