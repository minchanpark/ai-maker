import type { GeneratedFile, HookInput } from '@/types';

interface CommandHook {
  type: 'command';
  command: string;
  timeout: number;
}

interface HookBlock {
  matcher: string;
  hooks: CommandHook[];
}

interface HookSettings {
  hooks: {
    PreToolUse?: HookBlock[];
    PostToolUse?: HookBlock[];
    SessionStart?: HookBlock[];
    Stop?: HookBlock[];
    Notification?: HookBlock[];
  };
}

function makeBashScript(body: string): string {
  return `#!/bin/bash\nset -euo pipefail\n${body}\n`;
}

function makePythonScript(body: string): string {
  return `#!/usr/bin/env python3\n${body}\n`;
}

function createScriptFiles(input: HookInput): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (input.tools.includes('prettier')) {
    files.push({
      path: 'hooks/scripts/format_code.sh',
      content: makeBashScript(`FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')\ncase "$FILE_PATH" in\n  *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.md)\n    npx --yes prettier --write "$FILE_PATH" >/dev/null 2>&1 || true\n    ;;\nesac\nexit 0`),
      type: 'hook-script',
      language: 'bash',
    });
  }

  if (input.tools.includes('eslint')) {
    files.push({
      path: 'hooks/scripts/lint_code.sh',
      content: makeBashScript(`FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')\ncase "$FILE_PATH" in\n  *.ts|*.tsx|*.js|*.jsx)\n    npx --yes eslint --fix "$FILE_PATH" >/dev/null 2>&1 || true\n    ;;\nesac\nexit 0`),
      type: 'hook-script',
      language: 'bash',
    });
  }

  if (input.tools.includes('stylelint')) {
    files.push({
      path: 'hooks/scripts/lint_style.sh',
      content: makeBashScript(`FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')\ncase "$FILE_PATH" in\n  *.css|*.scss)\n    npx --yes stylelint "$FILE_PATH" --fix >/dev/null 2>&1 || true\n    ;;\nesac\nexit 0`),
      type: 'hook-script',
      language: 'bash',
    });
  }

  if (input.protectedPaths.length > 0) {
    const blocked = JSON.stringify(input.protectedPaths, null, 2);
    files.push({
      path: 'hooks/scripts/protect_paths.py',
      content: makePythonScript(`import json\nimport sys\n\ndata = json.load(sys.stdin)\npath = (data.get('tool_input') or {}).get('file_path') or ''\nBLOCK_PATHS = ${blocked}\n\nif any(blocked in path for blocked in BLOCK_PATHS):\n    print(f'❌ 보호된 파일 편집 차단: {path}', file=sys.stderr)\n    print('사용자가 직접 편집해야 합니다.', file=sys.stderr)\n    sys.exit(2)\n\nsys.exit(0)`),
      type: 'hook-script',
      language: 'python',
    });
  }

  if (input.tools.includes('storybook')) {
    files.push({
      path: 'hooks/scripts/create_storybook.py',
      content: makePythonScript(`import json\nimport os\nimport re\nimport sys\n\ndata = json.load(sys.stdin)\nfile_path = (data.get('tool_input') or {}).get('file_path') or ''\n\nif not re.search(r'\\.(tsx|jsx)$', file_path) or '.stories.' in file_path:\n    sys.exit(0)\n\ncomponent_name = os.path.basename(file_path).replace('.tsx', '').replace('.jsx', '')\nstory_path = file_path.replace('.tsx', '.stories.tsx').replace('.jsx', '.stories.jsx')\n\nif os.path.exists(story_path):\n    sys.exit(0)\n\nstory_template = f\"\"\"import type {{ Meta, StoryObj }} from '@storybook/react';\nimport {{ {component_name} }} from './{component_name}';\n\nconst meta: Meta<typeof {component_name}> = {{\n  title: 'Components/{component_name}',\n  component: {component_name},\n  tags: ['autodocs'],\n}};\n\nexport default meta;\ntype Story = StoryObj<typeof {component_name}>;\n\nexport const Default: Story = {{\n  args: {{}},\n}};\n\"\"\"\n\nwith open(story_path, 'w', encoding='utf-8') as f:\n    f.write(story_template)\n\nprint(f'✅ Storybook 파일 생성: {story_path}')\nsys.exit(0)`),
      type: 'hook-script',
      language: 'python',
    });
  }

  if (input.events.includes('SessionStart')) {
    files.push({
      path: 'hooks/scripts/session_start.sh',
      content: makeBashScript('echo "✅ SessionStart 훅 실행"\nexit 0'),
      type: 'hook-script',
      language: 'bash',
    });
  }

  if (input.events.includes('Stop')) {
    files.push({
      path: 'hooks/scripts/on_stop.sh',
      content: makeBashScript('echo "🛑 Stop 훅 실행"\nexit 0'),
      type: 'hook-script',
      language: 'bash',
    });
  }

  if (input.events.includes('Notification')) {
    files.push({
      path: 'hooks/scripts/on_notification.sh',
      content: makeBashScript('echo "🔔 Notification 훅 실행"\nexit 0'),
      type: 'hook-script',
      language: 'bash',
    });
  }

  return files;
}

function createSettings(input: HookInput): HookSettings {
  const settings: HookSettings = { hooks: {} };

  if (input.events.includes('PreToolUse') && input.protectedPaths.length > 0) {
    settings.hooks.PreToolUse = [
      {
        matcher: 'Edit|Write',
        hooks: [
          {
            type: 'command',
            command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/protect_paths.py',
            timeout: 10,
          },
        ],
      },
    ];
  }

  if (input.events.includes('PostToolUse')) {
    const postHooks: HookBlock[] = [];
    const editHooks: CommandHook[] = [];

    if (input.tools.includes('prettier')) {
      editHooks.push({
        type: 'command',
        command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/format_code.sh',
        timeout: 60,
      });
    }

    if (input.tools.includes('eslint')) {
      editHooks.push({
        type: 'command',
        command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/lint_code.sh',
        timeout: 60,
      });
    }

    if (input.tools.includes('stylelint')) {
      editHooks.push({
        type: 'command',
        command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/lint_style.sh',
        timeout: 60,
      });
    }

    if (editHooks.length > 0) {
      postHooks.push({
        matcher: 'Edit|Write',
        hooks: editHooks,
      });
    }

    if (input.tools.includes('storybook')) {
      postHooks.push({
        matcher: 'Write',
        hooks: [
          {
            type: 'command',
            command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/create_storybook.py',
            timeout: 30,
          },
        ],
      });
    }

    if (postHooks.length > 0) {
      settings.hooks.PostToolUse = postHooks;
    }
  }

  if (input.events.includes('SessionStart')) {
    settings.hooks.SessionStart = [
      {
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/session_start.sh',
            timeout: 10,
          },
        ],
      },
    ];
  }

  if (input.events.includes('Stop')) {
    settings.hooks.Stop = [
      {
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/on_stop.sh',
            timeout: 10,
          },
        ],
      },
    ];
  }

  if (input.events.includes('Notification')) {
    settings.hooks.Notification = [
      {
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/scripts/on_notification.sh',
            timeout: 10,
          },
        ],
      },
    ];
  }

  return settings;
}

export function generateHookFiles(input: HookInput): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const settings = createSettings(input);

  files.push({
    path: 'hooks/settings.json',
    content: JSON.stringify(settings, null, 2),
    type: 'hook-config',
    language: 'json',
  });

  files.push(...createScriptFiles(input));

  return files;
}
