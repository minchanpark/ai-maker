#!/usr/bin/env python3
"""
validate_yaml_json.py
AI가 생성한 SKILL.md, settings.json, Agent MD 파일의 유효성을 검증합니다.
"""
import sys
import json
import os
import re

def get_changed_file() -> str:
    return os.environ.get("CLAUDE_TOOL_INPUT_FILE", "")

def validate_settings_json(content: str, path: str) -> list[str]:
    """settings.json 유효성 검사"""
    errors = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        errors.append(f"JSON 파싱 오류: {e}")
        return errors

    if "hooks" not in data:
        errors.append("'hooks' 키가 없습니다")
    return errors

def validate_skill_md(content: str, path: str) -> list[str]:
    """SKILL.md frontmatter 유효성 검사"""
    errors = []

    # frontmatter 추출
    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        errors.append("YAML frontmatter가 없습니다 (--- 로 시작해야 함)")
        return errors

    fm = fm_match.group(1)

    # name 검증
    name_match = re.search(r"^name:\s*(.+)$", fm, re.MULTILINE)
    if not name_match:
        errors.append("frontmatter에 'name' 필드가 없습니다")
    else:
        name = name_match.group(1).strip()
        if not re.match(r"^[a-z][a-z0-9-]*$", name):
            errors.append(f"name '{name}'은 소문자와 하이픈만 사용 가능합니다")

    # description 길이 검증
    desc_match = re.search(r"description:\s*[>|]?\n?(.*?)(?=\n---|\Z)", fm, re.DOTALL)
    if desc_match:
        desc = desc_match.group(1).strip()
        if len(desc) < 150:
            errors.append(f"description이 너무 짧습니다 ({len(desc)}자, 최소 150자 필요)")
    else:
        errors.append("frontmatter에 'description' 필드가 없습니다")

    return errors

def validate_agent_md(content: str, path: str) -> list[str]:
    """Agent MD frontmatter 유효성 검사"""
    errors = []

    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        errors.append("YAML frontmatter가 없습니다")
        return errors

    fm = fm_match.group(1)

    # permissionMode 검증
    pm_match = re.search(r"^permissionMode:\s*(.+)$", fm, re.MULTILINE)
    if pm_match:
        pm = pm_match.group(1).strip()
        if pm not in ["plan", "default", "acceptEdits"]:
            errors.append(f"permissionMode '{pm}'은 plan/default/acceptEdits 중 하나여야 합니다")
    else:
        errors.append("frontmatter에 'permissionMode' 필드가 없습니다")

    return errors

def main():
    changed_file = get_changed_file()
    if not changed_file or not os.path.exists(changed_file):
        sys.exit(0)

    try:
        with open(changed_file, "r") as f:
            content = f.read()
    except Exception:
        sys.exit(0)

    errors = []
    filename = os.path.basename(changed_file)

    if filename == "settings.json":
        errors = validate_settings_json(content, changed_file)
    elif filename == "SKILL.md":
        errors = validate_skill_md(content, changed_file)
    elif changed_file.endswith(".md") and "agents" in changed_file:
        errors = validate_agent_md(content, changed_file)
    else:
        sys.exit(0)

    if errors:
        print(f"⚠️  유효성 검증 실패: {changed_file}", file=sys.stderr)
        for err in errors:
            print(f"  ❌ {err}", file=sys.stderr)
        # 경고만 출력하고 중단하지 않음 (exit 0)
    else:
        print(f"  ✅ 유효성 검증 통과: {filename}")

    sys.exit(0)

if __name__ == "__main__":
    main()
