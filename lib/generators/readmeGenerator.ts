import type { GeneratedFile, ProjectInput } from '@/types';

export function generateReadme(input: ProjectInput, files: GeneratedFile[]): string {
  const skillFile = files.find((file) => file.type === 'skill');

  return `# Claude Code 커스텀 도구 설치 가이드

## 1. 생성 개요
- 프로젝트: ${input.projectName}
- 아이디어 요약: ${input.ideaSummary}
- 중점 영역: ${input.focusAreas.join(', ')}
- 생성 파일 수: ${files.length}
- 핵심 Skill: ${skillFile?.path ?? 'skills/.../SKILL.md'}

## 2. 파일 배치
프로젝트 루트에서:
- skills/ -> .claude/skills/
- hooks/ -> .claude/hooks/
- agents/ -> .claude/agents/
- hooks/settings.json -> .claude/settings.json

## 3. 실행 권한 부여
\`\`\`bash
chmod +x .claude/hooks/scripts/*.sh .claude/hooks/scripts/*.py
\`\`\`

## 4. 검증
- Skills: Claude Code에서 프로젝트 아이디어 관련 키워드로 호출
- Hooks: \`jq . .claude/settings.json\`
- Agents: Claude Code에서 /agents 확인

## 5. 체크리스트
- [ ] Skill frontmatter(name/description) 확인
- [ ] settings.json 문법 확인
- [ ] Hook script shebang 확인
- [ ] Agent permissionMode 확인
`;
}
