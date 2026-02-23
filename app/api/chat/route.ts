import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildChatSystemPrompt } from '@/lib/chat/buildChatPrompt';
import { assembleChatContext, resolveChatContextPolicy } from '@/lib/chat/contextPolicy';
import { extractCodeBlocks, extractFirstCodeBlock, extractSummaryLines } from '@/lib/chat/parseChatResponse';
import { evaluateUpdate } from '@/lib/chat/qualityGate';
import {
  enforceRateLimit,
  getChatRateLimitMax,
  getRateLimitWindowMs,
  verifyOrigin,
} from '@/lib/security/requestGuards';
import { isAllowedChatTargetPath, validateFileUpdate } from '@/lib/chat/validateFileUpdate';
import type { ChatSseEvent } from '@/types';

export const runtime = 'nodejs';

const DEFAULT_MAX_RESPONSE_CHARS = 1_000_000;
const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_CHAT_MAX_TOKENS = 16_384;
const DEFAULT_CHAT_STREAM_TOTAL_TIMEOUT_MS = 180_000;
const DEFAULT_CHAT_STREAM_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CHAT_RECOVERY_TIMEOUT_MS = 45_000;

const generatedFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  type: z.enum(['skill', 'hook-config', 'hook-script', 'agent']),
  language: z.enum(['markdown', 'json', 'bash', 'python']),
});

const chatRequestSchema = z.object({
  message: z.string().min(1, '메시지를 입력하세요.'),
  selectedFile: generatedFileSchema,
  availablePaths: z.array(z.string().min(1)).min(1),
  projectInput: z.object({
    projectName: z.string().min(1),
    ideaSummary: z.string().min(1),
    targetUsers: z.string().min(1),
    problemStatement: z.string().min(1),
    coreFeatures: z.array(z.string()),
    successCriteria: z.string().min(1),
    nonNegotiables: z.array(z.string()),
    focusAreas: z.array(z.enum(['planning', 'design', 'development'])),
    collaborationMode: z.enum(['balanced', 'speed', 'safe']),
    automationLevel: z.enum(['minimal', 'recommended', 'aggressive']),
  }),
  blueprint: z.object({
    primaryRole: z.enum(['planner', 'designer', 'developer']),
    skillName: z.string().min(1),
    triggerKeywords: z.array(z.string()),
    hookEvents: z.array(z.enum(['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop', 'Notification'])),
    agentNames: z.array(z.string()),
  }),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(100),
});

function resolveChatModel(): string {
  const explicitChatModel = process.env.CLAUDE_CHAT_MODEL?.trim();
  if (explicitChatModel) {
    return explicitChatModel;
  }

  return DEFAULT_CHAT_MODEL;
}

function resolveChatMaxTokens(): number {
  const raw = process.env.CLAUDE_CHAT_MAX_TOKENS;
  if (!raw) {
    return DEFAULT_CHAT_MAX_TOKENS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHAT_MAX_TOKENS;
  }

  return Math.max(1024, parsed);
}

function resolveMaxResponseChars(): number {
  const raw = process.env.CLAUDE_CHAT_MAX_RESPONSE_CHARS;
  if (!raw) {
    return DEFAULT_MAX_RESPONSE_CHARS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_RESPONSE_CHARS;
  }

  return Math.max(10_000, parsed);
}

function resolveChatStreamTotalTimeoutMs(): number {
  const raw = process.env.CLAUDE_CHAT_STREAM_TOTAL_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_CHAT_STREAM_TOTAL_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHAT_STREAM_TOTAL_TIMEOUT_MS;
  }

  return Math.max(30_000, parsed);
}

function resolveChatStreamIdleTimeoutMs(): number {
  const raw = process.env.CLAUDE_CHAT_STREAM_IDLE_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_CHAT_STREAM_IDLE_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHAT_STREAM_IDLE_TIMEOUT_MS;
  }

  return Math.max(10_000, parsed);
}

function resolveChatRecoveryTimeoutMs(): number {
  const raw = process.env.CLAUDE_CHAT_RECOVERY_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_CHAT_RECOVERY_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHAT_RECOVERY_TIMEOUT_MS;
  }

  return Math.max(10_000, parsed);
}

function createTimedAbortController(timeoutMs: number): {
  controller: AbortController;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

function createStreamingAbortController(params: {
  totalTimeoutMs: number;
  idleTimeoutMs: number;
}): {
  controller: AbortController;
  touch: () => void;
  clear: () => void;
} {
  const { totalTimeoutMs, idleTimeoutMs } = params;
  const controller = new AbortController();
  const totalTimer = setTimeout(() => {
    controller.abort();
  }, totalTimeoutMs);

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const touch = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      controller.abort();
    }, idleTimeoutMs);
  };

  touch();

  return {
    controller,
    touch,
    clear: () => {
      clearTimeout(totalTimer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
    },
  };
}

function readAnthropicError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if ('error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return '';
}

function parseSseDataLines(rawEvent: string): string[] {
  return rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line.length > 0 && line !== '[DONE]');
}

function encodeSseEvent(event: ChatSseEvent['event'], data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function pickBestCodeBlockCandidate(path: string, responseText: string): string | null {
  const blocks = extractCodeBlocks(responseText);
  if (blocks.length === 0) {
    return extractFirstCodeBlock(responseText);
  }

  const validCandidates = blocks.filter((block) => validateFileUpdate(path, block).ok);
  const pool = validCandidates.length > 0 ? validCandidates : blocks;
  return pool.sort((left, right) => right.length - left.length)[0] ?? null;
}

function extractPlainTextCandidate(path: string, responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline >= 0) {
      const unfenced = trimmed
        .slice(firstNewline + 1)
        .replace(/\n```$/, '')
        .trim();
      if (unfenced.length > 0) {
        return unfenced;
      }
    }
  }

  if (path === 'hooks/settings.json') {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1).trim();
    }
  }

  if (path.startsWith('hooks/scripts/')) {
    const shebangIndex = trimmed.indexOf('#!');
    if (shebangIndex >= 0) {
      return trimmed.slice(shebangIndex).trim();
    }
  }

  if (path.endsWith('.md')) {
    const frontmatterIndex = trimmed.indexOf('---\nname:');
    if (frontmatterIndex >= 0) {
      return trimmed.slice(frontmatterIndex).trim();
    }

    if (trimmed.startsWith('#')) {
      return trimmed;
    }

    const headingMatch = trimmed.match(/(^|\n)#{1,6}\s+/);
    if (headingMatch && headingMatch.index !== undefined) {
      return trimmed.slice(headingMatch.index).trim();
    }
  }

  return null;
}

function isSoftGateFailure(reason?: string): boolean {
  if (!reason) return false;
  const softPatterns = [
    '변경 비율',
    '앵커 키워드',
    '품질 점수',
  ];

  return softPatterns.some((pattern) => reason.includes(pattern));
}

function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('content' in payload)) {
    return '';
  }

  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const node = item as { type?: string; text?: string };
      return node.type === 'text' && typeof node.text === 'string' ? node.text : '';
    })
    .join('\n')
    .trim();
}

async function fetchRecoveryText(params: {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string } | { role: 'user'; content: string }>;
  attempt: number;
  timeoutMs: number;
}): Promise<string> {
  const { apiKey, model, maxTokens, system, messages, attempt, timeoutMs } = params;
  const retryTokens = maxTokens + attempt * 4_096;
  const abort = createTimedAbortController(timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: abort.controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: retryTokens,
        temperature: 0.2,
        stream: false,
        system: `${system}\n\n[재시도 규칙]\n응답이 중간에 끊겼습니다. 변경 요약 없이 수정된 파일 전체를 코드블록 하나로 출력하세요.`,
        messages,
      }),
    });
  } catch {
    return '';
  } finally {
    abort.clear();
  }

  if (!response.ok) {
    return '';
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return extractAnthropicText(payload);
}

function extractUpdateCandidate(path: string, responseText: string): string | null {
  const codeBlockCandidate = pickBestCodeBlockCandidate(path, responseText);
  if (codeBlockCandidate) {
    return codeBlockCandidate;
  }

  return extractPlainTextCandidate(path, responseText);
}

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
      bucket: 'api-chat',
      limit: getChatRateLimitMax(),
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
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: '채팅 요청 검증에 실패했습니다.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    if (!input.availablePaths.includes(input.selectedFile.path)) {
      return NextResponse.json(
        {
          error: '선택 파일이 허용된 파일 목록에 없습니다.',
        },
        { status: 400 },
      );
    }

    if (!isAllowedChatTargetPath(input.selectedFile.path)) {
      return NextResponse.json(
        {
          error: '채팅에서 수정할 수 없는 파일 경로입니다.',
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'CLAUDE_API_KEY(또는 ANTHROPIC_API_KEY)가 설정되지 않았습니다.',
        },
        { status: 503 },
      );
    }

    const model = resolveChatModel();
    const maxTokens = resolveChatMaxTokens();
    const maxResponseChars = resolveMaxResponseChars();
    const streamTotalTimeoutMs = resolveChatStreamTotalTimeoutMs();
    const streamIdleTimeoutMs = resolveChatStreamIdleTimeoutMs();
    const recoveryTimeoutMs = resolveChatRecoveryTimeoutMs();
    const policy = resolveChatContextPolicy();

    const context = assembleChatContext({
      message: input.message,
      history: input.history,
      selectedFile: input.selectedFile,
      policy,
    });

    const system = buildChatSystemPrompt({
      selectedFile: input.selectedFile,
      availablePaths: input.availablePaths,
      projectInput: input.projectInput,
      blueprint: input.blueprint,
      fileContext: context.fileContext,
      historySummary: context.historySummary,
      contextBudget: {
        totalBudgetChars: context.budget.totalBudgetChars,
        fileBudgetChars: context.budget.fileBudgetChars,
        historyBudgetChars: context.budget.historyBudgetChars,
        maxMessageChars: context.budget.maxMessageChars,
        maxHistoryTurns: context.budget.maxHistoryTurns,
        maxHistoryTurnChars: context.budget.maxHistoryTurnChars,
        pinnedHistoryTurns: context.budget.pinnedHistoryTurns,
        fileCharsUsed: context.stats.fileCharsUsed,
        historyCharsUsed: context.stats.historyCharsUsed,
        messageChars: context.stats.messageChars,
        historyTurnsReceived: context.stats.historyTurnsReceived,
        historyTurnsUsed: context.stats.historyTurnsUsed,
        historyTurnsSummarized: context.stats.historyTurnsSummarized,
        trimmedChars: context.stats.trimmedChars,
      },
    });

    const messages = [
      ...context.history.map((history) => ({
        role: history.role,
        content: history.content,
      })),
      {
        role: 'user' as const,
        content: context.message,
      },
    ];

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let doneSent = false;

        const sendEvent = (
          event: Extract<ChatSseEvent['event'], 'token' | 'file_update' | 'error' | 'done'>,
          data: unknown,
        ) => {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };

        const sendDone = (ok: boolean) => {
          if (doneSent) {
            return;
          }
          doneSent = true;
          sendEvent('done', { ok });
        };

        const upstreamAbort = createStreamingAbortController({
          totalTimeoutMs: streamTotalTimeoutMs,
          idleTimeoutMs: streamIdleTimeoutMs,
        });

        try {
          const upstreamResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: upstreamAbort.controller.signal,
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              temperature: 0.2,
              stream: true,
              system,
              messages,
            }),
          });

          if (!upstreamResponse.ok) {
            const payload = (await upstreamResponse.json().catch(() => null)) as unknown;
            const detail = readAnthropicError(payload);
            sendEvent('error', {
              message: detail || `Claude API 호출 실패 (status ${upstreamResponse.status})`,
            });
            sendDone(false);
            return;
          }

          if (!upstreamResponse.body) {
            sendEvent('error', {
              message: 'Claude API 응답 스트림이 비어 있습니다.',
            });
            sendDone(false);
            return;
          }

          const reader = upstreamResponse.body.getReader();
          const decoder = new TextDecoder();

          let buffer = '';
          let fullResponse = '';
          let overflowed = false;
          let stopReason = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            upstreamAbort.touch();
            buffer += decoder.decode(value, { stream: true });

            let separatorIndex = buffer.indexOf('\n\n');
            while (separatorIndex >= 0) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              separatorIndex = buffer.indexOf('\n\n');

              if (!rawEvent.trim()) {
                continue;
              }

              const dataLines = parseSseDataLines(rawEvent);
              for (const dataLine of dataLines) {
                let payload: unknown;
                try {
                  payload = JSON.parse(dataLine);
                } catch {
                  continue;
                }

                const delta =
                  payload &&
                  typeof payload === 'object' &&
                  'type' in payload &&
                  (payload as { type?: string }).type === 'content_block_delta'
                    ? (payload as { delta?: { type?: string; text?: string } }).delta
                    : null;

                if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                  fullResponse += delta.text;
                  sendEvent('token', { text: delta.text });

                  if (fullResponse.length > maxResponseChars) {
                    overflowed = true;
                    await reader.cancel();
                    break;
                  }
                }

                const errorPayload =
                  payload &&
                  typeof payload === 'object' &&
                  'type' in payload &&
                  (payload as { type?: string }).type === 'error'
                    ? (payload as { error?: { message?: string } }).error
                    : null;

                if (errorPayload?.message) {
                  sendEvent('error', {
                    message: `Claude API 오류: ${errorPayload.message}`,
                  });
                  sendDone(false);
                  return;
                }

                const upstreamStopReason =
                  payload &&
                  typeof payload === 'object' &&
                  'type' in payload &&
                  (payload as { type?: string }).type === 'message_delta'
                    ? (payload as { delta?: { stop_reason?: string } }).delta?.stop_reason
                    : null;

                if (typeof upstreamStopReason === 'string' && upstreamStopReason.length > 0) {
                  stopReason = upstreamStopReason;
                }

                const stopReasonFromStop =
                  payload &&
                  typeof payload === 'object' &&
                  'type' in payload &&
                  (payload as { type?: string }).type === 'message_stop'
                    ? (payload as { stop_reason?: string }).stop_reason
                    : null;

                if (typeof stopReasonFromStop === 'string' && stopReasonFromStop.length > 0) {
                  stopReason = stopReasonFromStop;
                }
              }

              if (overflowed) {
                break;
              }
            }

            if (overflowed) {
              break;
            }
          }

          if (!overflowed) {
            let updatedContent = extractUpdateCandidate(input.selectedFile.path, fullResponse);

            if (stopReason === 'max_tokens') {
              for (let attempt = 1; attempt <= 3; attempt += 1) {
                const recoveryText = await fetchRecoveryText({
                  apiKey,
                  model,
                  maxTokens,
                  system,
                  messages,
                  attempt,
                  timeoutMs: recoveryTimeoutMs,
                });
                if (!recoveryText) {
                  continue;
                }

                const recoveryCandidate = extractUpdateCandidate(input.selectedFile.path, recoveryText);
                if (recoveryCandidate) {
                  fullResponse = recoveryText;
                  updatedContent = recoveryCandidate;
                  break;
                }
              }
            }

            if (updatedContent) {
              const gate = evaluateUpdate({
                path: input.selectedFile.path,
                before: input.selectedFile.content,
                after: updatedContent,
                blueprint: input.blueprint,
                userMessage: context.message,
              });

              if (gate.ok) {
                sendEvent('file_update', {
                  path: input.selectedFile.path,
                  before: input.selectedFile.content,
                  after: updatedContent,
                  summary: extractSummaryLines(fullResponse),
                });
              } else if (isSoftGateFailure(gate.reason) && validateFileUpdate(input.selectedFile.path, updatedContent).ok) {
                sendEvent('file_update', {
                  path: input.selectedFile.path,
                  before: input.selectedFile.content,
                  after: updatedContent,
                  summary: extractSummaryLines(fullResponse),
                });
              } else if (stopReason === 'max_tokens' && validateFileUpdate(input.selectedFile.path, updatedContent).ok) {
                sendEvent('file_update', {
                  path: input.selectedFile.path,
                  before: input.selectedFile.content,
                  after: updatedContent,
                  summary: extractSummaryLines(fullResponse),
                });
              }
            }
          }

          sendDone(true);
        } catch (error) {
          const message =
            error instanceof Error && error.name === 'AbortError'
              ? 'Claude API 응답 제한 시간을 초과했습니다.'
              : error instanceof Error
                ? error.message
                : '채팅 처리 중 알 수 없는 오류가 발생했습니다.';
          sendEvent('error', {
            message,
          });
          sendDone(false);
        } finally {
          upstreamAbort.clear();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '채팅 요청 처리 중 내부 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
