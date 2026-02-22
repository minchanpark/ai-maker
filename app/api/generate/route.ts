import { NextRequest, NextResponse } from 'next/server';

import { createGeneratedPackageWithClaude } from '@/lib/api/generatePackage';
import { projectInputSchema } from '@/lib/schemas/projectInput';

export async function POST(req: NextRequest) {
  try {
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
