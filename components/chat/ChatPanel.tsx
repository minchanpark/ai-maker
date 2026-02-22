'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ChatMessage } from '@/components/chat/ChatMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatPanelProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
}

export function ChatPanel({ messages, isStreaming, error, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const disabled = useMemo(() => isStreaming || isSubmitting || input.trim().length === 0, [isStreaming, isSubmitting, input]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const message = input.trim();
    if (!message || isStreaming || isSubmitting) {
      return;
    }

    setInput('');
    setIsSubmitting(true);
    try {
      await onSend(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-3">
      <div ref={viewportRef} className="flex-1 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">요청을 입력하면 AI가 선택 파일을 수정합니다.</p>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="예: description을 더 구체적으로 보강해줘"
          disabled={isStreaming || isSubmitting}
        />
        <Button type="submit" disabled={disabled}>
          전송
        </Button>
      </form>
    </div>
  );
}
