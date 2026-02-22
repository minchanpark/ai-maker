import { describe, expect, it } from 'vitest';

import { isAllowedChatTargetPath, validateFileUpdate } from '@/lib/chat/validateFileUpdate';

describe('validateFileUpdate', () => {
  it('validates hooks/settings.json schema and timeout range', () => {
    const valid = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: 'echo ok', timeout: 60 }],
          },
        ],
      },
    });

    const invalid = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: 'echo bad', timeout: 999 }],
          },
        ],
      },
    });

    expect(validateFileUpdate('hooks/settings.json', valid).ok).toBe(true);
    expect(validateFileUpdate('hooks/settings.json', invalid).ok).toBe(false);
  });

  it('validates frontmatter for skill and agent files', () => {
    const validSkill = `---\nname: test-skill\ndescription: desc\n---\n\n# title`;
    const validAgent = `---\nname: ui-designer\ndescription: desc\npermissionMode: plan\ntools:\n  - Read\n---\n\n# Role`;

    expect(validateFileUpdate('skills/test-skill/SKILL.md', validSkill).ok).toBe(true);
    expect(validateFileUpdate('agents/ui-designer.md', validAgent).ok).toBe(true);
    expect(validateFileUpdate('skills/test-skill/SKILL.md', '# no frontmatter').ok).toBe(false);
  });

  it('validates hook scripts shebang rules', () => {
    const validSh = '#!/bin/bash\nset -euo pipefail\necho ok\n';
    const invalidSh = '#!/bin/sh\necho bad\n';

    expect(validateFileUpdate('hooks/scripts/format_code.sh', validSh).ok).toBe(true);
    expect(validateFileUpdate('hooks/scripts/format_code.sh', invalidSh).ok).toBe(false);
  });

  it('checks allowed chat target path patterns', () => {
    expect(isAllowedChatTargetPath('skills/demo/SKILL.md')).toBe(true);
    expect(isAllowedChatTargetPath('hooks/settings.json')).toBe(true);
    expect(isAllowedChatTargetPath('hooks/scripts/format_code.sh')).toBe(true);
    expect(isAllowedChatTargetPath('agents/ui-designer.md')).toBe(true);
    expect(isAllowedChatTargetPath('hooks/random.txt')).toBe(false);
  });
});
