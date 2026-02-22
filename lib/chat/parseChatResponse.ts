const CODE_BLOCK_REGEX = /```(?:[\w-]+)?\s*\n([\s\S]*?)```/;
const CODE_BLOCK_GLOBAL_REGEX = /```(?:[\w-]+)?\s*\n([\s\S]*?)```/g;

function normalizeLine(line: string): string {
  return line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
}

export function extractFirstCodeBlock(text: string): string | null {
  const match = text.match(CODE_BLOCK_REGEX);
  if (!match?.[1]) {
    return null;
  }

  const content = match[1].trim();
  return content.length > 0 ? content : null;
}

export function extractCodeBlocks(text: string): string[] {
  const matches = Array.from(text.matchAll(CODE_BLOCK_GLOBAL_REGEX));
  const blocks: string[] = [];

  for (const match of matches) {
    const content = (match[1] ?? '').trim();
    if (content.length > 0) {
      blocks.push(content);
    }
  }

  return blocks;
}

export function extractSummaryLines(text: string): string[] {
  const summaryArea = text.replace(CODE_BLOCK_REGEX, '').trim();
  if (!summaryArea) {
    return [];
  }

  return summaryArea
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line) || line.includes('수정'))
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 3);
}
