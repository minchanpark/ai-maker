import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function roleLabel(role: ChatMessageType['role']): string {
  if (role === 'user') return '사용자';
  if (role === 'assistant') return 'AI';
  return '시스템';
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        isUser && 'border-slate-900 bg-slate-900 text-white',
        isAssistant && 'border-slate-200 bg-white text-slate-800',
        message.role === 'system' && 'border-amber-300 bg-amber-50 text-amber-900',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-xs opacity-80">
        <span>{roleLabel(message.role)}</span>
        <span>
          {new Date(message.createdAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </span>
      </div>

      <p className="whitespace-pre-wrap break-words">{message.content}</p>

      {message.fileUpdate?.summary?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          {message.fileUpdate.summary.map((summary) => (
            <li key={summary}>{summary}</li>
          ))}
        </ul>
      ) : null}

      {message.error ? <p className="mt-2 text-xs text-red-400">{message.error}</p> : null}
      {message.status === 'streaming' ? <p className="mt-2 text-xs opacity-70">응답 생성 중...</p> : null}
    </div>
  );
}
