'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { DiffViewer } from '@/components/chat/DiffViewer';
import { FileList } from '@/components/result/FileList';
import { FileViewer } from '@/components/result/FileViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGeneratorStore } from '@/store/generatorStore';
import type { ChatRequestPayload, ChatSseEvent, FileUpdatePayload } from '@/types';

function makeMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ParsedSseBlock {
  event: ChatSseEvent['event'];
  data: unknown;
}

function parseSseBlock(raw: string): ParsedSseBlock | null {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  let event: ChatSseEvent['event'] | null = null;
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      const candidate = line.slice(6).trim();
      if (candidate === 'token' || candidate === 'file_update' || candidate === 'error' || candidate === 'done') {
        event = candidate;
      }
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  });

  if (!event || dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join('\n');
  try {
    return {
      event,
      data: JSON.parse(rawData),
    };
  } catch {
    return null;
  }
}

function readValidationDetails(details: unknown): string {
  if (!details || typeof details !== 'object') {
    return '';
  }

  const payload = details as {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };

  const fieldEntry = Object.entries(payload.fieldErrors ?? {}).find(([, messages]) => Array.isArray(messages) && messages.length > 0);
  if (fieldEntry && fieldEntry[1]?.[0]) {
    return `${fieldEntry[0]}: ${fieldEntry[1][0]}`;
  }

  if (Array.isArray(payload.formErrors) && payload.formErrors.length > 0) {
    return payload.formErrors[0] ?? '';
  }

  return '';
}

export default function ChatPage() {
  const [viewMode, setViewMode] = useState<'file' | 'diff'>('file');
  const {
    generatedPackage,
    selectedPath,
    setSelectedPath,
    chatMessages,
    isChatStreaming,
    chatError,
    fileHistory,
    lastDiff,
    setChatStreaming,
    setChatError,
    addChatMessage,
    appendAssistantToken,
    finalizeAssistantMessage,
    applyAiFileUpdate,
    undoFile,
  } = useGeneratorStore();

  const selectedFile = useMemo(
    () => generatedPackage?.files.find((file) => file.path === selectedPath) ?? generatedPackage?.files[0] ?? null,
    [generatedPackage, selectedPath],
  );

  const canUndo = selectedFile ? (fileHistory[selectedFile.path]?.length ?? 0) > 0 : false;

  if (!generatedPackage || !selectedFile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
        <Card className="w-full space-y-4">
          <h1 className="text-2xl font-bold">대화할 파일이 없습니다.</h1>
          <p className="text-sm text-slate-600">먼저 생성 화면에서 Skill/Hook/Agent 파일을 만들어 주세요.</p>
          <div className="flex gap-2">
            <Link href="/result">
              <Button variant="outline">결과 화면으로 이동</Button>
            </Link>
            <Link href="/generate">
              <Button>새 생성 시작</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const handleSend = async (message: string) => {
    if (isChatStreaming || !selectedFile) {
      return;
    }

    const history = chatMessages
      .filter((chatMessage) => chatMessage.role === 'user' || chatMessage.role === 'assistant')
      .filter((chatMessage) => (chatMessage.content ?? '').trim().length > 0)
      .filter((chatMessage) => chatMessage.status !== 'streaming')
      .map((chatMessage) => ({
        role: chatMessage.role,
        content: chatMessage.content.trim(),
      }))
      .slice(-100) as ChatRequestPayload['history'];

    addChatMessage({
      id: makeMessageId(),
      role: 'user',
      content: message,
      createdAt: Date.now(),
      status: 'done',
    });

    setChatError(null);
    setChatStreaming(true);
    appendAssistantToken('');

    let finalized = false;
    let latestFileUpdate: FileUpdatePayload | undefined;

    const finalize = (params?: Parameters<typeof finalizeAssistantMessage>[0]) => {
      if (finalized) return;
      finalizeAssistantMessage(params);
      finalized = true;
    };

    try {
      const payload: ChatRequestPayload = {
        message,
        selectedFile,
        availablePaths: generatedPackage.files.map((file) => file.path),
        projectInput: generatedPackage.projectInput,
        blueprint: generatedPackage.blueprint,
        history,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({ error: '채팅 요청에 실패했습니다.' }))) as {
          error?: string;
          details?: unknown;
        };

        const detail = readValidationDetails(errorPayload.details);
        const message = errorPayload.error || '채팅 요청에 실패했습니다.';
        throw new Error(detail ? `${message} (${detail})` : message);
      }

      if (!response.body) {
        throw new Error('채팅 응답 스트림이 비어 있습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex >= 0) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          separatorIndex = buffer.indexOf('\n\n');

          const parsed = parseSseBlock(rawEvent);
          if (!parsed) {
            continue;
          }

          switch (parsed.event) {
            case 'token': {
              const text =
                parsed.data && typeof parsed.data === 'object' && 'text' in parsed.data
                  ? String((parsed.data as { text?: string }).text ?? '')
                  : '';

              if (text) {
                appendAssistantToken(text);
              }
              break;
            }
            case 'file_update': {
              const data = parsed.data as FileUpdatePayload;
              const applied = applyAiFileUpdate(data.path, data.after, data.summary ?? []);
              latestFileUpdate = {
                ...data,
                summary: data.summary ?? [],
              };

              if (applied) {
                setViewMode('diff');
              }
              break;
            }
            case 'error': {
              const message =
                parsed.data && typeof parsed.data === 'object' && 'message' in parsed.data
                  ? String((parsed.data as { message?: string }).message ?? '오류가 발생했습니다.')
                  : '오류가 발생했습니다.';

              setChatError(message);
              addChatMessage({
                id: makeMessageId(),
                role: 'system',
                content: message,
                createdAt: Date.now(),
                status: 'error',
              });
              finalize({
                status: 'error',
                error: message,
                fileUpdate: latestFileUpdate,
              });
              break;
            }
            case 'done': {
              const ok =
                parsed.data && typeof parsed.data === 'object' && 'ok' in parsed.data
                  ? Boolean((parsed.data as { ok?: boolean }).ok)
                  : true;

              finalize({
                status: ok ? 'done' : 'error',
                fileUpdate: latestFileUpdate,
              });
              break;
            }
          }
        }
      }

      finalize({
        status: 'done',
        fileUpdate: latestFileUpdate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '채팅 처리 중 오류가 발생했습니다.';
      setChatError(message);
      finalize({
        status: 'error',
        error: message,
        fileUpdate: latestFileUpdate,
      });
    } finally {
      setChatStreaming(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Step 3: AI 대화형 개선</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">실시간 반영</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">생성된 파일</h2>
            <span className="text-xs text-slate-500">{generatedPackage.files.length}개</span>
          </div>
          <FileList
            files={generatedPackage.files}
            selectedPath={selectedFile.path}
            onSelect={(path) => {
              setSelectedPath(path);
              setViewMode('file');
            }}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant={viewMode === 'file' ? 'default' : 'outline'} onClick={() => setViewMode('file')}>
                  파일 보기
                </Button>
                <Button variant={viewMode === 'diff' ? 'default' : 'outline'} onClick={() => setViewMode('diff')}>
                  Diff 보기
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" disabled={!canUndo} onClick={() => undoFile(selectedFile.path)}>
                  Undo
                </Button>
                <Link href="/result">
                  <Button variant="ghost">결과 화면으로</Button>
                </Link>
              </div>
            </div>

            {viewMode === 'file' ? (
              <FileViewer file={selectedFile} />
            ) : (
              <DiffViewer
                path={lastDiff?.path ?? null}
                language={selectedFile.language}
                before={lastDiff?.before ?? ''}
                after={lastDiff?.after ?? ''}
              />
            )}
          </Card>

          <Card>
            <ChatPanel messages={chatMessages} isStreaming={isChatStreaming} error={chatError} onSend={handleSend} />
          </Card>
        </div>
      </div>
    </main>
  );
}
