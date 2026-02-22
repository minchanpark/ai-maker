#!/usr/bin/env python3
"""
protect_secrets.py
.env 파일, API 키, 시크릿 파일이 실수로 수정되거나 노출되지 않도록 보호합니다.
"""
import sys
import os
import json

PROTECTED_PATHS = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".claude/settings.json",
]

PROTECTED_PATTERNS = [
    "ANTHROPIC_API_KEY",
    "SECRET_KEY",
    "PRIVATE_KEY",
]

def main():
    # Claude Tool Input에서 대상 파일 경로 읽기
    tool_input_raw = os.environ.get("CLAUDE_TOOL_INPUT", "{}")
    try:
        tool_input = json.loads(tool_input_raw)
    except Exception:
        sys.exit(0)

    target_file = tool_input.get("path", tool_input.get("file_path", ""))

    if not target_file:
        sys.exit(0)

    # 정규화된 경로
    normalized = target_file.lstrip("./")

    # 보호 경로 확인
    for protected in PROTECTED_PATHS:
        if normalized == protected or target_file.endswith(protected):
            print(f"🛡️  보호된 파일 수정 감지: {target_file}", file=sys.stderr)
            print(f"   이 파일은 수동으로만 수정하세요.", file=sys.stderr)
            # exit 1 로 Claude가 해당 파일 수정을 중단하게 함
            sys.exit(1)

    # .env 계열 파일 패턴 체크
    basename = os.path.basename(target_file)
    if basename.startswith(".env"):
        print(f"🛡️  환경변수 파일 수정 차단: {target_file}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
