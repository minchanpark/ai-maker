import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestClaudeToolDraft } from '@/lib/ai/claudeToolDesigner';
import { baseInput } from '@/tests/fixtures';
import type { HookEvent } from '@/types';

describe('requestClaudeToolDraft', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-repairs too short skill.description from AI response', async () => {
    const fallback = {
      skill: {
        name: 'idea-helper',
        description: '아이디어 실행을 돕는 기본 스킬 설명',
        triggerKeywords: ['아이디어', '기획', '실행'],
        qualityCriteria: ['명확성', '일관성', '검증 가능성'],
        outputFormat: '요약 -> 실행안 -> 체크리스트',
      },
      hook: {
        events: ['SessionStart'] as HookEvent[],
        targetExtensions: ['.md'],
        tools: [],
        protectedPaths: [],
      },
      agents: [
        {
          name: 'strategy-planner',
          roleDescription: '요구사항과 실행 단계를 정리하는 역할입니다.',
          permissionMode: 'default' as const,
          tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
          useMemory: false,
        },
      ],
    };

    const draft = {
      skill: {
        name: 'idea-helper',
        description: '짧은 설명',
        triggerKeywords: ['아이디어', '기획', '실행'],
        qualityCriteria: ['명확성', '일관성', '검증 가능성'],
        outputFormat: '요약 -> 실행안 -> 체크리스트',
      },
      hook: {
        events: ['SessionStart'],
        targetExtensions: ['.md'],
        tools: [],
        protectedPaths: [],
      },
      agents: [
        {
          name: 'strategy-planner',
          roleDescription: '요구사항과 실행 단계를 정리하고 문서를 구조화합니다.',
          permissionMode: 'default',
          tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
          useMemory: false,
        },
      ],
      warnings: [],
    };

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify(draft),
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const result = await requestClaudeToolDraft({
      input: baseInput,
      fallback,
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5',
    });

    expect(result.skill.description.length).toBeGreaterThanOrEqual(150);
    expect(result.warnings).toContain('AI가 생성한 skill.description이 짧아 자동 보강했습니다.');
  });
});
