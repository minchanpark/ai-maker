#!/bin/bash
set -euo pipefail

# 변경된 파일 경로를 CLAUDE_TOOL_INPUT에서 읽기
CHANGED_FILE="${CLAUDE_TOOL_INPUT_FILE:-}"

# 파일이 지정되지 않았으면 종료
if [ -z "$CHANGED_FILE" ]; then
  exit 0
fi

# 대상 확장자 확인
case "$CHANGED_FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.json|*.md)
    ;;
  *)
    exit 0
    ;;
esac

echo "🔧 Formatting and linting: $CHANGED_FILE"

# Prettier 포맷팅
if command -v npx &> /dev/null; then
  npx prettier --write "$CHANGED_FILE" 2>/dev/null || true
  echo "  ✅ Prettier done"
fi

# ESLint (TS/JS 파일만)
case "$CHANGED_FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    if [ -f ".eslintrc.json" ] || [ -f "eslint.config.mjs" ] || [ -f ".eslintrc.js" ]; then
      npx eslint "$CHANGED_FILE" --fix --max-warnings=0 2>/dev/null || true
      echo "  ✅ ESLint done"
    fi
    ;;
esac

echo "✨ Format complete: $CHANGED_FILE"
