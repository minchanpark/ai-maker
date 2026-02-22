'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TagInputFieldProps {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
  helpText?: string;
}

export function TagInputField({ label, placeholder, value, onChange, helpText }: TagInputFieldProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const normalized = draft.trim();
    if (!normalized) return;
    if (value.includes(normalized)) {
      setDraft('');
      return;
    }

    onChange([...value, normalized]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div>
      <Label>{label}</Label>
      {helpText ? <p className="mb-2 text-xs text-slate-500">{helpText}</p> : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <Button variant="outline" onClick={addTag} aria-label={`${label} 추가`}>
          추가
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {value.length === 0 ? <p className="text-xs text-slate-500">아직 추가된 항목이 없습니다.</p> : null}
        {value.map((tag) => (
          <button
            type="button"
            key={tag}
            className="group"
            onClick={() => removeTag(tag)}
            aria-label={`${tag} 삭제`}
          >
            <Badge className="group-hover:bg-red-100 group-hover:text-red-700">{tag} ✕</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
