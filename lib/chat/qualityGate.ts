import { PERMISSION_DEFAULT_TOOLS } from '@/lib/constants/domain';
import { validateFileUpdate } from '@/lib/chat/validateFileUpdate';
import type {
  GenerationBlueprint,
  PermissionMode,
  QualityGateResult,
  QualityScoreBreakdown,
} from '@/types';

const COMMON_ANCHOR_RETENTION_THRESHOLD = 0.65;
const EXPANSION_INTENT_ANCHOR_RETENTION_THRESHOLD = 0.5;

const STOPWORDS = new Set([
  '그리고',
  '에서',
  '으로',
  '하는',
  '대한',
  '위한',
  '프로젝트',
  '서비스',
  '사용자',
  '수정',
  '요청',
  '내용',
  'the',
  'and',
  'for',
  'with',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./|()\[\]{}!?:;"'`~<>\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function splitLines(value: string): string[] {
  return value.replace(/\r/g, '').split('\n');
}

function calculateLineChangeRatio(before: string, after: string): number {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);

  const maxLen = Math.max(beforeLines.length, afterLines.length, 1);
  const minLen = Math.min(beforeLines.length, afterLines.length);

  let sameByPosition = 0;
  for (let index = 0; index < minLen; index += 1) {
    if (beforeLines[index] === afterLines[index]) {
      sameByPosition += 1;
    }
  }

  const changed = maxLen - sameByPosition;
  return changed / maxLen;
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  return match?.[1] ?? null;
}

function extractFrontmatterValue(content: string, key: string): string {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return '';

  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(regex);
  return match?.[1]?.trim() ?? '';
}

function extractToolsFromFrontmatter(content: string): string[] {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return [];

  const blockMatch = frontmatter.match(/^tools:\s*\n((?:\s*-\s*[^\n]+\n?)*)/m);
  if (!blockMatch?.[1]) return [];

  return blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function buildAnchorKeywords(before: string, triggerKeywords: string[]): string[] {
  const base = tokenize(before);
  const frequency = new Map<string, number>();

  base.forEach((token) => {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  });

  const topFromBefore = Array.from(frequency.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([keyword]) => keyword)
    .slice(0, 24);

  return unique([...triggerKeywords.map((item) => item.toLowerCase()), ...topFromBefore]).slice(0, 30);
}

function calculateRetentionRatio(after: string, anchorKeywords: string[]): number {
  if (anchorKeywords.length === 0) {
    return 1;
  }

  const lowered = after.toLowerCase();
  let kept = 0;
  anchorKeywords.forEach((keyword) => {
    if (lowered.includes(keyword)) {
      kept += 1;
    }
  });

  return kept / anchorKeywords.length;
}

function calculateSkillTriggerRetention(after: string, triggerKeywords: string[]): number {
  if (triggerKeywords.length === 0) {
    return 1;
  }

  const lowered = after.toLowerCase();
  const kept = triggerKeywords.reduce((count, keyword) => {
    return lowered.includes(keyword.toLowerCase()) ? count + 1 : count;
  }, 0);

  return kept / triggerKeywords.length;
}

function isExpansionIntent(message?: string): boolean {
  if (!message) return false;
  const lowered = message.toLowerCase();
  const intents = [
    '상세',
    '구체',
    '자세',
    '명확',
    '보강',
    '확장',
    '정교',
    '리라이트',
    'rewrite',
    'deeper',
  ];

  return intents.some((intent) => lowered.includes(intent));
}

function getChangeThreshold(path: string, expansionIntent: boolean): number {
  let base = 0.6;

  if (path === 'hooks/settings.json') {
    base = 0.7;
  } else if (path.startsWith('hooks/scripts/')) {
    base = 0.75;
  } else if (path.endsWith('/SKILL.md') || path.endsWith('.md')) {
    base = 0.55;
  }

  if (!expansionIntent) {
    return base;
  }

  return Math.min(base + 0.2, 0.85);
}

function evaluateStructureScore(path: string, content: string): { score: number; issues: string[] } {
  const issues: string[] = [];

  if (path.endsWith('/SKILL.md')) {
    const description = extractFrontmatterValue(content, 'description');
    if (description.length < 150) {
      issues.push('SKILL.md description 길이가 150자 미만입니다.');
    }

    if (!/^##\s*작업 프로세스/m.test(content)) {
      issues.push('SKILL.md의 ## 작업 프로세스 섹션이 없습니다.');
    }

    if (!/^##\s*출력 포맷/m.test(content)) {
      issues.push('SKILL.md의 ## 출력 포맷 섹션이 없습니다.');
    }
  }

  if (path.startsWith('agents/') && path.endsWith('.md')) {
    const permissionMode = extractFrontmatterValue(content, 'permissionMode') as PermissionMode;
    const tools = extractToolsFromFrontmatter(content);

    if (!permissionMode || !(permissionMode in PERMISSION_DEFAULT_TOOLS)) {
      issues.push('agent permissionMode 값이 유효하지 않습니다.');
    } else {
      const allowed = PERMISSION_DEFAULT_TOOLS[permissionMode];
      const hasInvalidTool = tools.some((tool) => !allowed.includes(tool));
      if (hasInvalidTool) {
        issues.push('agent tools가 permissionMode 범위를 벗어났습니다.');
      }
    }

    if (tools.length === 0) {
      issues.push('agent tools 목록이 비어 있습니다.');
    }
  }

  const deducted = issues.length * 35;
  const score = Math.max(0, 100 - deducted);

  return { score, issues };
}

function calculateOverallScore(params: {
  syntaxScore: number;
  structureScore: number;
  keywordRetentionScore: number;
  stabilityScore: number;
}): number {
  const { syntaxScore, structureScore, keywordRetentionScore, stabilityScore } = params;

  const weighted =
    syntaxScore * 0.35 +
    structureScore * 0.35 +
    keywordRetentionScore * 0.15 +
    stabilityScore * 0.15;

  return Math.round(weighted);
}

function buildScoreBreakdown(params: {
  path: string;
  before: string;
  after: string;
  blueprint: GenerationBlueprint;
  changeRatio: number;
  threshold: number;
}): QualityScoreBreakdown {
  const { path, before, after, blueprint, changeRatio, threshold } = params;

  const anchorKeywords = buildAnchorKeywords(before, blueprint.triggerKeywords);
  const anchorRetentionRatio = calculateRetentionRatio(after, anchorKeywords);

  const beforeValidation = validateFileUpdate(path, before);
  const afterValidation = validateFileUpdate(path, after);

  const beforeStructure = evaluateStructureScore(path, before);
  const afterStructure = evaluateStructureScore(path, after);

  const beforeKeywordScore = Math.round(calculateRetentionRatio(before, anchorKeywords) * 100);
  const afterKeywordScore = Math.round(anchorRetentionRatio * 100);

  const beforeStabilityScore = 100;
  const afterStabilityScore = Math.max(0, Math.round(100 - changeRatio * 120));

  const beforeScore = calculateOverallScore({
    syntaxScore: beforeValidation.ok ? 100 : 0,
    structureScore: beforeStructure.score,
    keywordRetentionScore: beforeKeywordScore,
    stabilityScore: beforeStabilityScore,
  });

  const afterScore = calculateOverallScore({
    syntaxScore: afterValidation.ok ? 100 : 0,
    structureScore: afterStructure.score,
    keywordRetentionScore: afterKeywordScore,
    stabilityScore: afterStabilityScore,
  });

  return {
    beforeScore,
    afterScore,
    syntaxScore: afterValidation.ok ? 100 : 0,
    structureScore: afterStructure.score,
    keywordRetentionScore: afterKeywordScore,
    stabilityScore: afterStabilityScore,
    changeRatio,
    threshold,
    anchorRetentionRatio,
  };
}

function checkNameImmutable(path: string, before: string, after: string): string | null {
  if (!path.endsWith('/SKILL.md')) {
    return null;
  }

  const beforeName = extractFrontmatterValue(before, 'name');
  const afterName = extractFrontmatterValue(after, 'name');

  if (beforeName && afterName && beforeName !== afterName) {
    return 'SKILL.md의 name 값 변경은 허용되지 않습니다.';
  }

  return null;
}

function checkSkillSpecificRules(after: string, blueprint: GenerationBlueprint): string | null {
  const description = extractFrontmatterValue(after, 'description');
  if (description.length < 150) {
    return 'SKILL.md description 길이가 150자 미만입니다.';
  }

  if (!/^##\s*작업 프로세스/m.test(after) || !/^##\s*출력 포맷/m.test(after)) {
    return 'SKILL.md 필수 섹션(작업 프로세스/출력 포맷)이 누락되었습니다.';
  }

  const triggerRetention = calculateSkillTriggerRetention(after, blueprint.triggerKeywords);
  if (triggerRetention < 0.8) {
    return 'SKILL.md triggerKeywords 보존률이 0.8 미만입니다.';
  }

  return null;
}

export function evaluateUpdate(params: {
  path: string;
  before: string;
  after: string;
  blueprint: GenerationBlueprint;
  userMessage?: string;
}): QualityGateResult {
  const { path, before, after, blueprint, userMessage } = params;
  const expansionIntent = isExpansionIntent(userMessage);

  if (!after.trim()) {
    return {
      ok: false,
      reason: '수정된 파일 내용이 비어 있습니다.',
      scores: {
        beforeScore: 0,
        afterScore: 0,
        syntaxScore: 0,
        structureScore: 0,
        keywordRetentionScore: 0,
        stabilityScore: 0,
        changeRatio: 1,
        threshold: getChangeThreshold(path, expansionIntent),
        anchorRetentionRatio: 0,
      },
    };
  }

  const validation = validateFileUpdate(path, after);
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.message ?? '파일 유효성 검증에 실패했습니다.',
      scores: {
        beforeScore: 0,
        afterScore: 0,
        syntaxScore: 0,
        structureScore: 0,
        keywordRetentionScore: 0,
        stabilityScore: 0,
        changeRatio: 1,
        threshold: getChangeThreshold(path, expansionIntent),
        anchorRetentionRatio: 0,
      },
    };
  }

  const threshold = getChangeThreshold(path, expansionIntent);
  const changeRatio = calculateLineChangeRatio(before, after);
  const scores = buildScoreBreakdown({
    path,
    before,
    after,
    blueprint,
    changeRatio,
    threshold,
  });

  if (changeRatio > threshold) {
    return {
      ok: false,
      reason: `변경 비율(${changeRatio.toFixed(2)})이 임계치(${threshold.toFixed(2)})를 초과했습니다.`,
      scores,
    };
  }

  const anchorThreshold = expansionIntent
    ? EXPANSION_INTENT_ANCHOR_RETENTION_THRESHOLD
    : COMMON_ANCHOR_RETENTION_THRESHOLD;

  if (scores.anchorRetentionRatio < anchorThreshold) {
    return {
      ok: false,
      reason: `앵커 키워드 보존률(${scores.anchorRetentionRatio.toFixed(2)})이 기준(${anchorThreshold.toFixed(2)}) 미만입니다.`,
      scores,
    };
  }

  const immutableError = checkNameImmutable(path, before, after);
  if (immutableError) {
    return {
      ok: false,
      reason: immutableError,
      scores,
    };
  }

  if (path.endsWith('/SKILL.md')) {
    const skillError = checkSkillSpecificRules(after, blueprint);
    if (skillError) {
      return {
        ok: false,
        reason: skillError,
        scores,
      };
    }
  }

  const minAfterScore = expansionIntent ? 80 : 85;
  if (scores.afterScore < minAfterScore) {
    return {
      ok: false,
      reason: `품질 점수(${scores.afterScore})가 기준(${minAfterScore}) 미만입니다.`,
      scores,
    };
  }

  const allowedDrop = expansionIntent ? 5 : 2;
  if (scores.afterScore < scores.beforeScore - allowedDrop) {
    return {
      ok: false,
      reason: `품질 점수가 기존(${scores.beforeScore}) 대비 ${allowedDrop}점 이상 하락했습니다.`,
      scores,
    };
  }

  return {
    ok: true,
    scores,
  };
}
