import { describe, expect, it } from 'vitest';

import { generateAgentMd, normalizeAgent } from '@/lib/generators/agentGenerator';
import type { AgentInput } from '@/types';

const baseAgent: AgentInput = {
  name: 'frontend-implementer',
  roleDescription: '구현 중심 작업을 담당합니다.',
  permissionMode: 'acceptEdits',
  tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  useMemory: false,
};

describe('generateAgentMd', () => {
  it('should preserve permission mode mapping and frontmatter', () => {
    const md = generateAgentMd(baseAgent, {
      projectName: '아이디어허브',
      ideaSummary: '아이디어 실행 전환',
      focusAreas: ['development'],
      triggerKeywords: ['아이디어', '실행'],
    });

    expect(md).toContain('permissionMode: acceptEdits');
    expect(md).toContain('tools:');
    expect(md).toContain('# Role');
  });

  it('should normalize tools to permission scope', () => {
    const normalized = normalizeAgent({
      ...baseAgent,
      permissionMode: 'plan',
      tools: ['Read', 'Write', 'Edit'],
    });

    expect(normalized.permissionMode).toBe('plan');
    expect(normalized.tools).toEqual(['Read']);
  });
});
