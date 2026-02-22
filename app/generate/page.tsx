'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

import { TagInputField } from '@/components/form/TagInputField';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AUTOMATION_LEVEL_OPTIONS,
  COLLABORATION_MODE_OPTIONS,
  FOCUS_AREA_OPTIONS,
} from '@/lib/constants/domain';
import { projectInputSchema } from '@/lib/schemas/projectInput';
import { useGeneratorStore } from '@/store/generatorStore';
import type { GeneratedPackage, ProjectInput } from '@/types';

const TOTAL_STEPS = 11;

const STEP_META: Record<number, { title: string; description: string }> = {
  1: {
    title: '프로젝트 이름',
    description: '짧고 명확한 이름을 입력해 주세요.',
  },
  2: {
    title: '아이디어 한 줄 요약',
    description: '무엇을 만들고 싶은지 핵심만 설명해 주세요.',
  },
  3: {
    title: '대상 사용자',
    description: '누가 이 프로젝트를 사용할지 적어주세요.',
  },
  4: {
    title: '해결하려는 문제',
    description: '지금 사용자가 겪는 불편을 구체적으로 적어주세요.',
  },
  5: {
    title: '핵심 기능/가치',
    description: '기술 스펙이 아니라 사용자 가치 중심으로 입력해 주세요.',
  },
  6: {
    title: '성공 기준',
    description: '무엇을 달성하면 성공인지 정의해 주세요.',
  },
  7: {
    title: '절대 지켜야 할 조건',
    description: '보안/정책/브랜드 기준 등을 입력하세요. (선택)',
  },
  8: {
    title: '중점 작업 유형',
    description: '이 선택을 기반으로 Skill/Hook/Agent가 자동 구성됩니다.',
  },
  9: {
    title: '협업 스타일',
    description: '속도와 안정성의 균형 기준을 선택하세요.',
  },
  10: {
    title: '자동화 강도',
    description: '훅/검증 자동화의 적용 강도를 선택하세요.',
  },
  11: {
    title: '확인 및 생성',
    description: '입력한 내용을 확인하고 자동 생성을 실행하세요.',
  },
};

const STEP_FIELDS: Record<number, string[]> = {
  1: ['projectName'],
  2: ['ideaSummary'],
  3: ['targetUsers'],
  4: ['problemStatement'],
  5: ['coreFeatures'],
  6: ['successCriteria'],
  7: [],
  8: ['focusAreas'],
  9: ['collaborationMode'],
  10: ['automationLevel'],
  11: [],
};

const DEFAULT_VALUES: ProjectInput = {
  projectName: '',
  ideaSummary: '',
  targetUsers: '',
  problemStatement: '',
  coreFeatures: ['핵심 기능 예시'],
  successCriteria: '',
  nonNegotiables: [],
  focusAreas: ['planning', 'design', 'development'],
  collaborationMode: 'balanced',
  automationLevel: 'recommended',
};

export default function GeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const { setProjectInput, setGeneratedPackage, setGenerating, setError, isGenerating, error } = useGeneratorStore();

  const methods = useForm<ProjectInput>({
    resolver: zodResolver(projectInputSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = methods;

  const progress = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);

  const submit = methods.handleSubmit(async (values) => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as GeneratedPackage | { error: string };
      if (!response.ok || 'error' in data) {
        const message = 'error' in data ? data.error : '파일 생성 실패';
        throw new Error(message);
      }

      setProjectInput(values);
      setGeneratedPackage(data);
      router.push('/result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  });

  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    if (fields.length > 0) {
      const valid = await methods.trigger(fields as never, { shouldFocus: true });
      if (!valid) return;
    }

    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const goPrev = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const focusAreas = watch('focusAreas');
  const collaborationMode = watch('collaborationMode');
  const automationLevel = watch('automationLevel');

  const toggleFocus = (value: ProjectInput['focusAreas'][number]) => {
    const next = focusAreas.includes(value)
      ? focusAreas.filter((item) => item !== value)
      : [...focusAreas, value];
    setValue('focusAreas', next, { shouldValidate: true });
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <Label htmlFor="projectName">프로젝트 이름</Label>
            <Input id="projectName" placeholder="예: 창업 아이디어 도우미" {...register('projectName')} />
            {errors.projectName ? <p className="mt-1 text-xs text-red-600">{errors.projectName.message}</p> : null}
          </div>
        );

      case 2:
        return (
          <div>
            <Label htmlFor="ideaSummary">아이디어 한 줄 요약</Label>
            <Textarea
              id="ideaSummary"
              placeholder="무엇을 만들고 싶은지 핵심만 적어주세요."
              {...register('ideaSummary')}
            />
            {errors.ideaSummary ? <p className="mt-1 text-xs text-red-600">{errors.ideaSummary.message}</p> : null}
          </div>
        );

      case 3:
        return (
          <div>
            <Label htmlFor="targetUsers">대상 사용자</Label>
            <Input id="targetUsers" placeholder="예: 예비 창업자, PM, 디자이너" {...register('targetUsers')} />
            {errors.targetUsers ? <p className="mt-1 text-xs text-red-600">{errors.targetUsers.message}</p> : null}
          </div>
        );

      case 4:
        return (
          <div>
            <Label htmlFor="problemStatement">해결하려는 문제</Label>
            <Textarea
              id="problemStatement"
              placeholder="사용자 문제를 구체적으로 작성해 주세요."
              {...register('problemStatement')}
            />
            {errors.problemStatement ? (
              <p className="mt-1 text-xs text-red-600">{errors.problemStatement.message}</p>
            ) : null}
          </div>
        );

      case 5:
        return (
          <div>
            <Controller
              control={control}
              name="coreFeatures"
              render={({ field }) => (
                <TagInputField
                  label="핵심 기능/가치"
                  placeholder="예: 실행 우선순위 자동 제안"
                  value={field.value}
                  onChange={field.onChange}
                  helpText="한 줄 기능 설명을 여러 개 추가해 주세요."
                />
              )}
            />
            {errors.coreFeatures ? <p className="mt-1 text-xs text-red-600">{errors.coreFeatures.message as string}</p> : null}
          </div>
        );

      case 6:
        return (
          <div>
            <Label htmlFor="successCriteria">성공 기준</Label>
            <Textarea
              id="successCriteria"
              placeholder="예: 아이디어를 24시간 내 실행 계획으로 전환"
              {...register('successCriteria')}
            />
            {errors.successCriteria ? (
              <p className="mt-1 text-xs text-red-600">{errors.successCriteria.message}</p>
            ) : null}
          </div>
        );

      case 7:
        return (
          <div>
            <Controller
              control={control}
              name="nonNegotiables"
              render={({ field }) => (
                <TagInputField
                  label="절대 지켜야 할 조건"
                  placeholder="예: 개인정보 외부 전송 금지"
                  value={field.value}
                  onChange={field.onChange}
                  helpText="선택 항목입니다. 비워도 다음으로 진행할 수 있습니다."
                />
              )}
            />
          </div>
        );

      case 8:
        return (
          <div>
            <Label>중점 작업 유형</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {FOCUS_AREA_OPTIONS.map((option) => {
                const checked = focusAreas.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-left ${
                      checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    onClick={() => toggleFocus(option.value)}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className={`mt-1 text-xs ${checked ? 'text-slate-100' : 'text-slate-500'}`}>{option.desc}</p>
                  </button>
                );
              })}
            </div>
            {errors.focusAreas ? <p className="mt-1 text-xs text-red-600">{errors.focusAreas.message as string}</p> : null}
          </div>
        );

      case 9:
        return (
          <div>
            <Label>협업 스타일</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {COLLABORATION_MODE_OPTIONS.map((option) => {
                const checked = collaborationMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-left ${
                      checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    onClick={() => setValue('collaborationMode', option.value, { shouldValidate: true })}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className={`mt-1 text-xs ${checked ? 'text-slate-100' : 'text-slate-500'}`}>{option.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 10:
        return (
          <div>
            <Label>자동화 강도</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {AUTOMATION_LEVEL_OPTIONS.map((option) => {
                const checked = automationLevel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-left ${
                      checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    onClick={() => setValue('automationLevel', option.value, { shouldValidate: true })}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className={`mt-1 text-xs ${checked ? 'text-slate-100' : 'text-slate-500'}`}>{option.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 11:
      default: {
        const values = watch();

        return (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold">프로젝트:</span> {values.projectName}
            </p>
            <p>
              <span className="font-semibold">아이디어:</span> {values.ideaSummary}
            </p>
            <p>
              <span className="font-semibold">대상 사용자:</span> {values.targetUsers}
            </p>
            <p>
              <span className="font-semibold">핵심 기능:</span> {values.coreFeatures.join(', ')}
            </p>
            <p>
              <span className="font-semibold">중점 유형:</span> {values.focusAreas.join(', ')}
            </p>
            <p>
              <span className="font-semibold">협업 스타일:</span> {values.collaborationMode}
            </p>
            <p>
              <span className="font-semibold">자동화 강도:</span> {values.automationLevel}
            </p>
            <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
              아래 버튼을 누르면 입력한 아이디어를 기반으로 Skill/Hook/Agent 구성이 자동 생성됩니다.
            </p>
          </div>
        );
      }
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      <FormProvider {...methods}>
        <Card className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold">아이디어 기반 자동 생성</h1>
            <p className="text-sm text-slate-600">카드 한 장씩 답변하면서 필요한 구성을 자동 생성하세요.</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500">
              질문 {step} / {TOTAL_STEPS}
            </p>
          </header>

          <Card className="space-y-4 border-dashed">
            <div>
              <h2 className="text-lg font-semibold">{STEP_META[step].title}</h2>
              <p className="text-sm text-slate-500">{STEP_META[step].description}</p>
            </div>
            {renderStepContent()}
          </Card>

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <footer className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={goPrev} disabled={step === 1 || isGenerating}>
              이전 질문
            </Button>

            {step < TOTAL_STEPS ? (
              <Button onClick={goNext} disabled={isGenerating}>
                다음 질문
              </Button>
            ) : (
              <Button onClick={submit} disabled={isGenerating}>
                {isGenerating ? '생성 중...' : '파일 자동 생성하기'}
              </Button>
            )}

            <p className="text-xs text-slate-500">기술 스택 입력 없이 아이디어 중심으로 생성됩니다.</p>
          </footer>
        </Card>
      </FormProvider>
    </main>
  );
}
