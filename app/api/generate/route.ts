import { NextRequest, NextResponse } from 'next/server';

import { createGeneratedPackageWithClaude } from '@/lib/api/generatePackage';
import {
  enforceRateLimit,
  getGenerateRateLimitMax,
  getRateLimitWindowMs,
  verifyOrigin,
} from '@/lib/security/requestGuards';
import { projectInputSchema } from '@/lib/schemas/projectInput';

export async function POST(req: NextRequest) {
  try {
    const originCheck = verifyOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        {
          error: '허용되지 않은 요청 출처입니다.',
          details: originCheck.reason,
        },
        { status: 403 },
      );
    }

    const rateLimit = enforceRateLimit(req, {
      bucket: 'api-generate',
      limit: getGenerateRateLimitMax(),
      windowMs: getRateLimitWindowMs(),
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const body = await req.json();
    const parsed = projectInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: '입력값 검증에 실패했습니다.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const generated = await createGeneratedPackageWithClaude(parsed.data);

    return NextResponse.json(generated);
  } catch (error) {
    return NextResponse.json(
      {
        error: '파일 생성 중 내부 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
