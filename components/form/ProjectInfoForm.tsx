'use client';

import { Controller, useFormContext } from 'react-hook-form';

import { TagInputField } from '@/components/form/TagInputField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AUTOMATION_LEVEL_OPTIONS,
  COLLABORATION_MODE_OPTIONS,
  FOCUS_AREA_OPTIONS,
} from '@/lib/constants/domain';
import type { FocusArea, ProjectInput } from '@/types';

export function ProjectInfoForm() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<ProjectInput>();

  const focusAreas = watch('focusAreas');
  const collaborationMode = watch('collaborationMode');
  const automationLevel = watch('automationLevel');

  const toggleFocus = (focus: FocusArea) => {
    const next = focusAreas.includes(focus)
      ? focusAreas.filter((item) => item !== focus)
      : [...focusAreas, focus];

    setValue('focusAreas', next, { shouldValidate: true });
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="projectName">프로젝트 이름</Label>
          <Input id="projectName" placeholder="예: 창업 아이디어 도우미" {...register('projectName')} />
          {errors.projectName ? <p className="mt-1 text-xs text-red-600">{errors.projectName.message}</p> : null}
        </div>

        <div>
          <Label htmlFor="targetUsers">대상 사용자</Label>
          <Input id="targetUsers" placeholder="예: 예비 창업자, PM, 마케터" {...register('targetUsers')} />
          {errors.targetUsers ? <p className="mt-1 text-xs text-red-600">{errors.targetUsers.message}</p> : null}
        </div>
      </div>

      <div>
        <Label htmlFor="ideaSummary">아이디어 한 줄 요약</Label>
        <Textarea
          id="ideaSummary"
          placeholder="무엇을 만들고 싶은지 한 줄로 설명하세요."
          {...register('ideaSummary')}
        />
        {errors.ideaSummary ? <p className="mt-1 text-xs text-red-600">{errors.ideaSummary.message}</p> : null}
      </div>

      <div>
        <Label htmlFor="problemStatement">해결하려는 문제</Label>
        <Textarea
          id="problemStatement"
          placeholder="사용자가 현재 어떤 불편을 겪고 있는지 구체적으로 적어주세요."
          {...register('problemStatement')}
        />
        {errors.problemStatement ? <p className="mt-1 text-xs text-red-600">{errors.problemStatement.message}</p> : null}
      </div>

      <Controller
        control={control}
        name="coreFeatures"
        render={({ field }) => (
          <TagInputField
            label="핵심 기능/가치"
            placeholder="예: 자동 요약"
            value={field.value}
            onChange={field.onChange}
            helpText="기술 스펙 대신 사용자 가치 중심으로 입력하세요."
          />
        )}
      />
      {errors.coreFeatures ? <p className="text-xs text-red-600">{errors.coreFeatures.message as string}</p> : null}

      <div>
        <Label htmlFor="successCriteria">성공 기준</Label>
        <Textarea
          id="successCriteria"
          placeholder="이 프로젝트가 성공했다고 판단할 기준을 적어주세요."
          {...register('successCriteria')}
        />
        {errors.successCriteria ? <p className="mt-1 text-xs text-red-600">{errors.successCriteria.message}</p> : null}
      </div>

      <Controller
        control={control}
        name="nonNegotiables"
        render={({ field }) => (
          <TagInputField
            label="절대 지켜야 할 조건"
            placeholder="예: 개인정보는 외부로 전송 금지"
            value={field.value}
            onChange={field.onChange}
            helpText="보안/정책/브랜드 규칙 등 반드시 지킬 조건"
          />
        )}
      />

      <div>
        <Label>중점 작업 유형</Label>
        <p className="mb-2 text-xs text-slate-500">필요한 Skill/Hook/Agent를 자동으로 추천하는 기준입니다.</p>
        <div className="grid gap-2 md:grid-cols-3">
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
                aria-label={`${option.label} 선택`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className={`mt-1 text-xs ${checked ? 'text-slate-100' : 'text-slate-500'}`}>{option.desc}</p>
              </button>
            );
          })}
        </div>
        {errors.focusAreas ? <p className="mt-1 text-xs text-red-600">{errors.focusAreas.message as string}</p> : null}
      </div>

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
    </section>
  );
}
