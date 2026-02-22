import { z } from 'zod';

export const projectInputSchema = z.object({
  projectName: z.string().min(1, '프로젝트 이름은 필수입니다.'),
  ideaSummary: z.string().min(10, '아이디어 요약은 10자 이상 입력하세요.'),
  targetUsers: z.string().min(2, '대상 사용자를 입력하세요.'),
  problemStatement: z.string().min(10, '해결할 문제를 구체적으로 입력하세요.'),
  coreFeatures: z.array(z.string().min(1)).min(1, '핵심 기능을 최소 1개 입력하세요.'),
  successCriteria: z.string().min(5, '성공 기준을 입력하세요.'),
  nonNegotiables: z.array(z.string().min(1)),
  focusAreas: z
    .array(z.enum(['planning', 'design', 'development']))
    .min(1, '중점 작업 유형을 1개 이상 선택하세요.'),
  collaborationMode: z.enum(['balanced', 'speed', 'safe']),
  automationLevel: z.enum(['minimal', 'recommended', 'aggressive']),
});

export type ProjectInputPayload = z.infer<typeof projectInputSchema>;
