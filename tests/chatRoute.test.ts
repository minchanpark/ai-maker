import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/chat/route';
import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { baseInput } from '@/tests/fixtures';
import type { ChatRequestPayload } from '@/types';

function jsonHeaders(params?: { origin?: string; ip?: string }) {
  return {
    'Content-Type': 'application/json',
    Origin: params?.origin ?? 'http://localhost',
    'x-forwarded-for': params?.ip ?? '127.0.0.1',
  };
}

function createAnthropicStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
    },
  });
}

function buildPayload(): ChatRequestPayload {
  const generated = createGeneratedPackage(baseInput);
  const selectedFile = generated.files.find((file) => file.path.endsWith('/SKILL.md')) ?? generated.files[0]!;

  return {
    message: 'description을 더 구체적으로 수정해줘',
    selectedFile,
    availablePaths: generated.files.map((file) => file.path),
    projectInput: generated.projectInput,
    blueprint: generated.blueprint,
    history: [
      {
        role: 'user',
        content: '이전에 작성한 내용을 더 구체화해줘',
      },
      {
        role: 'assistant',
        content: '좋아요. 어떤 부분을 보강할까요?',
      },
    ],
  };
}

describe('/api/chat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CHAT_CONTEXT_POLICY;
    delete process.env.APP_ORIGIN;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.ORIGIN_CHECK_STRICT;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.CHAT_RATE_LIMIT_MAX;
  });

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ message: '' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when selected file path is not allowed by policy', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    payload.selectedFile = {
      path: 'hooks/random.txt',
      content: 'echo test',
      type: 'hook-script',
      language: 'bash',
    };
    payload.availablePaths = [...payload.availablePaths, 'hooks/random.txt'];

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 503 when API key is missing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(buildPayload()),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(503);
  });

  it('accepts empty history content without 400', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    payload.history = [
      {
        role: 'assistant',
        content: '',
      },
      {
        role: 'user',
        content: '이 부분만 더 명확하게 정리해줘',
      },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '```markdown\nno-op\n```' },
        })}\n\n`,
      ]),
    );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  it('streams token -> file_update -> done for quality-gate passing response', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    const updatedContent = payload.selectedFile.content.replace(
      /^description: .+$/m,
      `description: ${'실행 가능한 품질 기준과 트리거 키워드를 일관되게 유지하고 검증 체크리스트를 포함하도록 보강합니다. '.repeat(4).trim()}`,
    );

    const responseText = `\`\`\`markdown\n${updatedContent}\n\`\`\`\n- 수정 위치: description`;

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: responseText },
        })}\n\n`,
        `data: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
      ]),
    );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: token');
    expect(text).toContain('event: file_update');
    expect(text).toContain('event: done');
    expect(text).not.toContain('event: warning');
  });

  it('skips file_update when quality gate rejects changes', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    const invalidSkill = payload.selectedFile.content.replace(/^name: .+$/m, 'name: renamed-skill');
    const responseText = `\`\`\`markdown\n${invalidSkill}\n\`\`\``;

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: responseText },
        })}\n\n`,
      ]),
    );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: done');
    expect(text).not.toContain('event: file_update');
    expect(text).not.toContain('event: warning');
  });

  it('recovers from max_tokens stop and still emits file_update', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    const updatedContent = payload.selectedFile.content.replace(
      /^description: .+$/m,
      `description: ${'요청 맥락을 유지하면서 실행 가능한 체크리스트와 판단 기준을 상세하게 확장합니다. '.repeat(4).trim()}`,
    );

    const fetchMock = vi.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce(
        createAnthropicStreamResponse([
          `data: ${JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: '```markdown\n---\nname:' },
          })}\n\n`,
          `data: ${JSON.stringify({ type: 'message_stop', stop_reason: 'max_tokens' })}\n\n`,
        ]),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: `\`\`\`markdown\n${updatedContent}\n\`\`\`` }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: file_update');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles large context without warning event', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    const payload = buildPayload();
    payload.message = 'description 개선안을 유지한 채 구조를 명확하게 정리해줘';
    payload.history = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index + 1}번째 대화 맥락 ${'세부 문맥 '.repeat(80)}`.slice(0, 1150),
    }));

    payload.selectedFile = {
      ...payload.selectedFile,
      content: `${payload.selectedFile.content}\n${'# details\n'.repeat(7000)}`,
    };

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '코드 블록 없이 응답합니다.' },
        })}\n\n`,
      ]),
    );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: done');
    expect(text).not.toContain('event: warning');
  });

  it('streams error when upstream returns error payload', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'error',
          error: { message: 'upstream failed' },
        })}\n\n`,
      ]),
    );

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(buildPayload()),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: error');
    expect(text).toContain('event: done');
  });

  it('returns 403 when origin is not allowed', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';
    process.env.APP_ORIGIN = 'https://app.example.com';

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: jsonHeaders({ origin: 'https://evil.example.com' }),
      body: JSON.stringify(buildPayload()),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it('returns 429 when chat rate limit is exceeded', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';
    process.env.CHAT_RATE_LIMIT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    vi.spyOn(global, 'fetch').mockResolvedValue(
      createAnthropicStreamResponse([
        `data: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '```markdown\\nnoop\\n```' },
        })}\n\n`,
      ]),
    );

    const payload = buildPayload();
    const first = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: jsonHeaders({ ip: '203.0.113.77' }),
        body: JSON.stringify(payload),
      }) as never,
    );
    expect(first.status).toBe(200);

    const second = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: jsonHeaders({ ip: '203.0.113.77' }),
        body: JSON.stringify(payload),
      }) as never,
    );
    expect(second.status).toBe(429);
  });
});
