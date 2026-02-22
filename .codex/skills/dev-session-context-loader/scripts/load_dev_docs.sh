#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
DEV_DIR="${ROOT_DIR%/}/dev"

if [[ ! -d "$DEV_DIR" ]]; then
  echo "[WARN] dev directory not found: $DEV_DIR" >&2
  exit 0
fi

print_doc() {
  local file="$1"
  if [[ -f "$file" ]]; then
    printf "\n===== %s =====\n" "$file"
    cat "$file"
  fi
}

# Priority docs first
print_doc "$DEV_DIR/AGENTS.md"
print_doc "$DEV_DIR/AI_INSTRUCTIONS.md"
print_doc "$DEV_DIR/PRD.md"

# Then remaining markdown files in stable order
while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  case "$base" in
    AGENTS.md|AI_INSTRUCTIONS.md|PRD.md)
      continue
      ;;
  esac
  print_doc "$file"
done < <(find "$DEV_DIR" -maxdepth 1 -type f -name '*.md' -print0 | sort -z)
