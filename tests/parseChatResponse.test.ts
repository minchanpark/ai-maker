import { describe, expect, it } from 'vitest';

import { extractFirstCodeBlock, extractSummaryLines } from '@/lib/chat/parseChatResponse';

describe('parseChatResponse', () => {
  it('extracts first code block content', () => {
    const response = `\`\`\`markdown\n# Title\ncontent\n\`\`\`\n- 수정 위치: description`;

    expect(extractFirstCodeBlock(response)).toBe('# Title\ncontent');
  });

  it('returns null when code block is missing', () => {
    const response = '코드 블록 없이 설명만 있습니다.';

    expect(extractFirstCodeBlock(response)).toBeNull();
  });

  it('extracts summary bullet lines up to 3', () => {
    const response = `\`\`\`json\n{}\n\`\`\`\n- 수정 위치: description\n- 수정 내용: 키워드 보강\n- 수정 이유: 명확성 향상\n- 추가: 무시`;

    expect(extractSummaryLines(response)).toEqual([
      '수정 위치: description',
      '수정 내용: 키워드 보강',
      '수정 이유: 명확성 향상',
    ]);
  });
});
