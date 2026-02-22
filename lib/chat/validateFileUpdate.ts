interface ValidationResult {
  ok: boolean;
  message?: string;
}

const ALLOWED_HOOK_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'Stop',
  'Notification',
]);

const CHAT_ALLOWED_PATH_PATTERNS: RegExp[] = [/(^|\/)SKILL\.md$/, /^hooks\/settings\.json$/, /^hooks\/scripts\/[^/]+$/, /\.md$/];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  return match?.[1] ?? null;
}

function hasFrontmatterField(frontmatter: string, field: string): boolean {
  return new RegExp(`^${field}:\\s*.+$`, 'm').test(frontmatter);
}

function validateSettingsJson(content: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, message: 'settings.json이 유효한 JSON 형식이 아닙니다.' };
  }

  if (!isObject(parsed)) {
    return { ok: false, message: 'settings.json 최상위는 객체여야 합니다.' };
  }

  if (!isObject(parsed.hooks)) {
    return { ok: false, message: 'settings.json에 hooks 객체가 필요합니다.' };
  }

  for (const [eventName, blocks] of Object.entries(parsed.hooks)) {
    if (!ALLOWED_HOOK_EVENTS.has(eventName)) {
      return { ok: false, message: `허용되지 않은 hook event: ${eventName}` };
    }

    if (!Array.isArray(blocks)) {
      return { ok: false, message: `${eventName} 블록은 배열이어야 합니다.` };
    }

    for (const block of blocks) {
      if (!isObject(block) || !Array.isArray(block.hooks)) {
        return { ok: false, message: `${eventName}.hooks 구조가 유효하지 않습니다.` };
      }

      for (const hook of block.hooks) {
        if (!isObject(hook)) {
          return { ok: false, message: `${eventName}.hooks 항목은 객체여야 합니다.` };
        }

        if ('timeout' in hook) {
          const timeout = hook.timeout;
          if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 1 || timeout > 300) {
            return { ok: false, message: 'hook timeout은 1~300 범위여야 합니다.' };
          }
        }
      }
    }
  }

  return { ok: true };
}

function validateFrontmatterMarkdown(params: {
  content: string;
  requiredFields: string[];
  messagePrefix: string;
}): ValidationResult {
  const { content, requiredFields, messagePrefix } = params;

  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return { ok: false, message: `${messagePrefix} frontmatter(---) 블록이 없습니다.` };
  }

  for (const field of requiredFields) {
    if (!hasFrontmatterField(frontmatter, field)) {
      return { ok: false, message: `${messagePrefix} frontmatter의 ${field} 필드가 없습니다.` };
    }
  }

  return { ok: true };
}

function validateHookScript(path: string, content: string): ValidationResult {
  if (content.trim().length < 20) {
    return { ok: false, message: 'hook script 내용이 너무 짧습니다.' };
  }

  if (path.endsWith('.sh')) {
    if (!content.startsWith('#!/bin/bash')) {
      return { ok: false, message: '.sh 스크립트는 #!/bin/bash shebang이 필요합니다.' };
    }

    if (!/set -euo pipefail/.test(content)) {
      return { ok: false, message: '.sh 스크립트는 set -euo pipefail이 필요합니다.' };
    }
  }

  if (path.endsWith('.py')) {
    if (!content.startsWith('#!/usr/bin/env python3')) {
      return { ok: false, message: '.py 스크립트는 #!/usr/bin/env python3 shebang이 필요합니다.' };
    }
  }

  return { ok: true };
}

function validateGenericMarkdown(content: string): ValidationResult {
  const hasStart = content.trimStart().startsWith('---');
  if (!hasStart) {
    return { ok: true };
  }

  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return { ok: false, message: 'markdown frontmatter 문법이 유효하지 않습니다.' };
  }

  const hasName = hasFrontmatterField(frontmatter, 'name');
  const hasDescription = hasFrontmatterField(frontmatter, 'description');

  if (!hasName || !hasDescription) {
    return { ok: false, message: 'markdown frontmatter에는 name/description이 필요합니다.' };
  }

  return { ok: true };
}

export function isAllowedChatTargetPath(path: string): boolean {
  return CHAT_ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function validateFileUpdate(path: string, content: string): ValidationResult {
  if (!content.trim()) {
    return { ok: false, message: '수정된 파일 내용이 비어 있습니다.' };
  }

  if (!isAllowedChatTargetPath(path)) {
    return { ok: false, message: '채팅에서 수정할 수 없는 파일 경로입니다.' };
  }

  if (path === 'hooks/settings.json') {
    return validateSettingsJson(content);
  }

  if (path.startsWith('hooks/scripts/')) {
    return validateHookScript(path, content);
  }

  const isSkill = path.endsWith('/SKILL.md');
  if (isSkill) {
    return validateFrontmatterMarkdown({
      content,
      requiredFields: ['name', 'description'],
      messagePrefix: 'SKILL.md',
    });
  }

  const isAgent = path.startsWith('agents/') && path.endsWith('.md');
  if (isAgent) {
    return validateFrontmatterMarkdown({
      content,
      requiredFields: ['name', 'description', 'permissionMode', 'tools'],
      messagePrefix: 'agent 파일',
    });
  }

  if (path.endsWith('.md')) {
    return validateGenericMarkdown(content);
  }

  return { ok: true };
}
