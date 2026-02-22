import { afterEach, describe, expect, it } from 'vitest';

import { assembleChatContext } from '@/lib/chat/contextPolicy';
import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { baseInput } from '@/tests/fixtures';

describe('assembleChatContext', () => {
  afterEach(() => {
    delete process.env.CHAT_CONTEXT_POLICY;
    delete process.env.CHAT_CONTEXT_TOTAL_BUDGET_CHARS;
    delete process.env.CHAT_CONTEXT_FILE_BUDGET_CHARS;
    delete process.env.CHAT_CONTEXT_HISTORY_BUDGET_CHARS;
  });

  it('preserves latest 12 turns while respecting max turn input', () => {
    const generated = createGeneratedPackage(baseInput);
    const selectedFile = generated.files[0]!;

    const history = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index + 1} ${'context '.repeat(20)}`,
    }));

    const result = assembleChatContext({
      message: '최근 맥락 기준으로 수정해줘',
      history,
      selectedFile,
      policy: 'quality_guard_v1',
    });

    const used = result.history.map((item) => item.content);
    for (let index = 19; index < 30; index += 1) {
      expect(used.some((content) => content.includes(`turn-${index + 1}`))).toBe(true);
    }

    expect(result.history.length).toBeLessThanOrEqual(30);
    expect(result.stats.historyTurnsUsed).toBe(result.history.length);
  });

  it('builds trimmed file context under configured file budget', () => {
    process.env.CHAT_CONTEXT_FILE_BUDGET_CHARS = '2200';

    const generated = createGeneratedPackage(baseInput);
    const selectedFile = {
      ...generated.files[0]!,
      content: `---\nname: test\ndescription: long description\n---\n\n${'keyword line and context\n'.repeat(1800)}`,
    };

    const result = assembleChatContext({
      message: 'keyword 기준으로 중요한 영역만 유지해줘',
      history: [],
      selectedFile,
      policy: 'quality_guard_v1',
    });

    expect(result.fileContext.length).toBeLessThanOrEqual(2200);
    expect(result.fileContext).toContain('frontmatter');
    expect(result.stats.trimmedChars).toBeGreaterThan(0);
  });

  it('supports legacy policy fallback', () => {
    const generated = createGeneratedPackage(baseInput);
    const selectedFile = generated.files[0]!;

    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `legacy-turn-${index + 1}`,
    }));

    const result = assembleChatContext({
      message: 'legacy 동작',
      history,
      selectedFile,
      policy: 'legacy',
    });

    expect(result.history.length).toBeLessThanOrEqual(8);
    expect(result.historySummary).toBe('');
    expect(result.stats.appliedPolicy).toBe('legacy');
  });
});
