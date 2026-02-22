import type {
  ChatHistoryMessage,
  ContextAssemblyResult,
  ContextBudgetConfig,
  GeneratedFile,
} from '@/types';

const DEFAULT_CONTEXT_POLICY = 'quality_guard_v1';

const DEFAULT_CONTEXT_BUDGET: ContextBudgetConfig = {
  totalBudgetChars: 120_000,
  fileBudgetChars: 72_000,
  historyBudgetChars: 36_000,
  maxMessageChars: 4_000,
  maxHistoryTurns: 30,
  maxHistoryTurnChars: 2_000,
  pinnedHistoryTurns: 12,
  historySummaryMaxChars: 1_800,
  fileHeadLines: 120,
  fileTailLines: 80,
  fileWindowPadding: 40,
  fileMaxWindows: 8,
  promptOverheadChars: 7_000,
};

export type ChatContextPolicy = 'quality_guard_v1' | 'legacy';

interface AssembleChatContextInput {
  message: string;
  history: ChatHistoryMessage[];
  selectedFile: Pick<GeneratedFile, 'path' | 'content' | 'language'>;
  policy?: ChatContextPolicy;
}

interface HistoryAssemblyResult {
  history: ChatHistoryMessage[];
  summary: string;
  pinnedCount: number;
  receivedTurns: number;
  summarizedTurns: number;
}

interface FileAssemblyResult {
  context: string;
}

interface RangeCandidate {
  index: number;
  score: number;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function resolveChatContextPolicy(): ChatContextPolicy {
  const raw = (process.env.CHAT_CONTEXT_POLICY ?? DEFAULT_CONTEXT_POLICY).trim();
  return raw === 'legacy' ? 'legacy' : 'quality_guard_v1';
}

export function getContextBudgetConfig(): ContextBudgetConfig {
  return {
    totalBudgetChars: readPositiveIntEnv('CHAT_CONTEXT_TOTAL_BUDGET_CHARS', DEFAULT_CONTEXT_BUDGET.totalBudgetChars),
    fileBudgetChars: readPositiveIntEnv('CHAT_CONTEXT_FILE_BUDGET_CHARS', DEFAULT_CONTEXT_BUDGET.fileBudgetChars),
    historyBudgetChars: readPositiveIntEnv('CHAT_CONTEXT_HISTORY_BUDGET_CHARS', DEFAULT_CONTEXT_BUDGET.historyBudgetChars),
    maxMessageChars: DEFAULT_CONTEXT_BUDGET.maxMessageChars,
    maxHistoryTurns: DEFAULT_CONTEXT_BUDGET.maxHistoryTurns,
    maxHistoryTurnChars: DEFAULT_CONTEXT_BUDGET.maxHistoryTurnChars,
    pinnedHistoryTurns: DEFAULT_CONTEXT_BUDGET.pinnedHistoryTurns,
    historySummaryMaxChars: DEFAULT_CONTEXT_BUDGET.historySummaryMaxChars,
    fileHeadLines: DEFAULT_CONTEXT_BUDGET.fileHeadLines,
    fileTailLines: DEFAULT_CONTEXT_BUDGET.fileTailLines,
    fileWindowPadding: DEFAULT_CONTEXT_BUDGET.fileWindowPadding,
    fileMaxWindows: DEFAULT_CONTEXT_BUDGET.fileMaxWindows,
    promptOverheadChars: DEFAULT_CONTEXT_BUDGET.promptOverheadChars,
  };
}

function clipChars(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  if (maxChars <= 16) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 15)}...[truncated]`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const STOPWORDS = new Set([
  '그리고',
  '에서',
  '으로',
  '하는',
  '대한',
  '위한',
  '프로젝트',
  '서비스',
  '사용자',
  '수정',
  '해주세요',
  'the',
  'and',
  'for',
  'with',
  'this',
]);

function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[\s,./|()\[\]{}!?:;"'`~<>\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !/^\d+$/.test(token));

  return Array.from(new Set(tokens)).slice(0, 20);
}

function scoreByKeywords(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lowered = text.toLowerCase();
  return keywords.reduce((score, keyword) => (lowered.includes(keyword) ? score + 1 : score), 0);
}

function sumHistoryChars(history: ChatHistoryMessage[]): number {
  return history.reduce((acc, item) => acc + item.content.length, 0);
}

function toSentences(messages: ChatHistoryMessage[]): string[] {
  return messages
    .flatMap((message) => message.content.split(/[\n.!?]+/))
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean)
    .filter((sentence) => sentence.length >= 8)
    .slice(0, 80);
}

function buildSummaryMemory(messages: ChatHistoryMessage[], maxChars: number): string {
  if (messages.length === 0 || maxChars <= 0) {
    return '';
  }

  const sentences = toSentences(messages);
  if (sentences.length === 0) {
    return '';
  }

  const sections: Array<{ label: string; keywords: string[] }> = [
    { label: '결정', keywords: ['결정', '선택', '확정', '정책', '기준'] },
    { label: '제약', keywords: ['제약', '금지', '필수', '제한', '불가'] },
    { label: '수정이유', keywords: ['이유', '근거', '목적', '개선', '보강'] },
    { label: 'TODO', keywords: ['todo', '다음', '추가', '후속', '검토'] },
  ];

  const used = new Set<number>();
  const lines: string[] = ['[대화 요약 메모리]'];

  sections.forEach((section, sectionIndex) => {
    let pickedIndex = -1;

    for (let index = 0; index < sentences.length; index += 1) {
      if (used.has(index)) continue;
      const lowered = sentences[index].toLowerCase();
      if (section.keywords.some((keyword) => lowered.includes(keyword))) {
        pickedIndex = index;
        break;
      }
    }

    if (pickedIndex < 0) {
      pickedIndex = sentences.findIndex((_, index) => !used.has(index));
    }

    if (pickedIndex < 0) {
      return;
    }

    used.add(pickedIndex);
    const content = clipChars(sentences[pickedIndex], 240);
    lines.push(`- ${section.label}: ${content}`);

    if (sectionIndex === sections.length - 1) {
      const extra = sentences.find((_, index) => !used.has(index));
      if (extra) {
        lines.push(`- 메모: ${clipChars(extra, 240)}`);
      }
    }
  });

  return clipChars(lines.join('\n'), maxChars);
}

function assembleHistoryContext(params: {
  history: ChatHistoryMessage[];
  message: string;
  config: ContextBudgetConfig;
}): HistoryAssemblyResult {
  const { history, message, config } = params;

  const normalized = history
    .slice(-config.maxHistoryTurns)
    .map((item) => ({
      role: item.role,
      content: clipChars(item.content.trim(), config.maxHistoryTurnChars),
    }))
    .filter((item) => item.content.length > 0);

  const receivedTurns = normalized.length;

  const pinnedCount = Math.min(config.pinnedHistoryTurns, normalized.length);
  const pinnedStartIndex = normalized.length - pinnedCount;
  const pinned = normalized.slice(pinnedStartIndex);

  const older = normalized
    .slice(0, pinnedStartIndex)
    .map((item, index) => ({
      index,
      message: item,
      score: scoreByKeywords(item.content, tokenize(message)),
    }));

  const pinnedChars = sumHistoryChars(pinned);
  const selectedOlder: Array<{ index: number; message: ChatHistoryMessage; score: number }> = [];
  let historyChars = pinnedChars;

  const olderByRelevance = [...older].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.index - left.index;
  });

  olderByRelevance.forEach((candidate) => {
    if (historyChars + candidate.message.content.length > config.historyBudgetChars) {
      return;
    }

    selectedOlder.push(candidate);
    historyChars += candidate.message.content.length;
  });

  const selectedOlderIndexSet = new Set(selectedOlder.map((item) => item.index));
  const excludedOlder = older.filter((item) => !selectedOlderIndexSet.has(item.index)).map((item) => item.message);

  let summary = buildSummaryMemory(excludedOlder, config.historySummaryMaxChars);

  const selectedOlderChronological = [...selectedOlder]
    .sort((left, right) => left.index - right.index)
    .map((item) => item.message);

  const assembledHistory = [...selectedOlderChronological, ...pinned];

  if (historyChars + summary.length > config.historyBudgetChars) {
    const remain = Math.max(config.historyBudgetChars - historyChars, 0);
    summary = clipChars(summary, remain);
  }

  return {
    history: assembledHistory,
    summary,
    pinnedCount,
    receivedTurns,
    summarizedTurns: excludedOlder.length,
  };
}

function findFrontmatterRange(lines: string[]): { start: number; end: number } | null {
  if (lines.length < 3 || lines[0].trim() !== '---') {
    return null;
  }

  for (let index = 1; index < Math.min(lines.length, 300); index += 1) {
    if (lines[index].trim() === '---') {
      return { start: 0, end: index };
    }
  }

  return null;
}

function buildFileContextWithConfig(params: {
  path: string;
  content: string;
  keywords: string[];
  headLines: number;
  tailLines: number;
  padding: number;
  maxWindows: number;
}): string {
  const { path, content, keywords, headLines, tailLines, padding, maxWindows } = params;
  const lines = content.split(/\r?\n/);

  const included = new Array(lines.length).fill(false);
  const parts: string[] = [];

  const addRange = (label: string, start: number, end: number) => {
    if (lines.length === 0) return;

    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(lines.length - 1, end);
    if (safeStart > safeEnd) return;

    let blockStart = -1;
    for (let line = safeStart; line <= safeEnd; line += 1) {
      const canUse = !included[line];

      if (canUse && blockStart < 0) {
        blockStart = line;
      }

      if ((!canUse || line === safeEnd) && blockStart >= 0) {
        const blockEnd = canUse && line === safeEnd ? line : line - 1;

        for (let mark = blockStart; mark <= blockEnd; mark += 1) {
          included[mark] = true;
        }

        const block = lines.slice(blockStart, blockEnd + 1).join('\n').trimEnd();
        if (block) {
          parts.push(`[${label}:${blockStart + 1}-${blockEnd + 1}]`);
          parts.push(block);
        }

        blockStart = -1;
      }
    }
  };

  const frontmatterRange = findFrontmatterRange(lines);
  if (frontmatterRange) {
    addRange('frontmatter', frontmatterRange.start, frontmatterRange.end);
  }

  addRange('head', 0, headLines - 1);

  const candidates: RangeCandidate[] = lines
    .map((line, index) => ({ index, score: scoreByKeywords(line, keywords) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    })
    .slice(0, 64);

  candidates.slice(0, maxWindows).forEach((candidate) => {
    addRange('keyword-window', candidate.index - padding, candidate.index + padding);
  });

  addRange('tail', lines.length - tailLines, lines.length - 1);

  if (parts.length === 0) {
    addRange('head', 0, Math.min(lines.length - 1, 120));
  }

  return `# ${path}\n\n${parts.join('\n\n')}`.trim();
}

function assembleFileContext(params: {
  path: string;
  content: string;
  message: string;
  config: ContextBudgetConfig;
}): FileAssemblyResult {
  const { path, content, message, config } = params;

  if (content.length <= config.fileBudgetChars) {
    return { context: content };
  }

  const keywords = tokenize(message);
  let headLines = config.fileHeadLines;
  let tailLines = config.fileTailLines;
  let padding = config.fileWindowPadding;
  let maxWindows = config.fileMaxWindows;

  let context = buildFileContextWithConfig({
    path,
    content,
    keywords,
    headLines,
    tailLines,
    padding,
    maxWindows,
  });

  for (let guard = 0; guard < 24 && context.length > config.fileBudgetChars; guard += 1) {
    if (maxWindows > 2) {
      maxWindows -= 1;
    } else if (padding > 10) {
      padding -= 10;
    } else if (headLines > 40) {
      headLines -= 20;
    } else if (tailLines > 20) {
      tailLines -= 10;
    } else {
      break;
    }

    context = buildFileContextWithConfig({
      path,
      content,
      keywords,
      headLines,
      tailLines,
      padding,
      maxWindows,
    });
  }

  if (context.length > config.fileBudgetChars) {
    context = clipChars(context, config.fileBudgetChars);
  }

  return { context };
}

function estimatePromptChars(params: {
  message: string;
  history: ChatHistoryMessage[];
  historySummary: string;
  fileContext: string;
  config: ContextBudgetConfig;
}): number {
  const { message, history, historySummary, fileContext, config } = params;
  return message.length + sumHistoryChars(history) + historySummary.length + fileContext.length + config.promptOverheadChars;
}

function assembleLegacyContext(input: AssembleChatContextInput, config: ContextBudgetConfig): ContextAssemblyResult {
  const message = clipChars(input.message.trim(), config.maxMessageChars);
  const history = input.history
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: clipChars(item.content.trim(), config.maxHistoryTurnChars),
    }))
    .filter((item) => item.content.length > 0);

  const fileContext = clipChars(input.selectedFile.content, config.fileBudgetChars);

  const trimmedChars =
    input.message.length + sumHistoryChars(input.history) + input.selectedFile.content.length -
    (message.length + sumHistoryChars(history) + fileContext.length);

  return {
    message,
    history,
    historySummary: '',
    fileContext,
    budget: config,
    stats: {
      messageChars: message.length,
      fileCharsUsed: fileContext.length,
      historyCharsUsed: sumHistoryChars(history),
      historyTurnsReceived: input.history.length,
      historyTurnsUsed: history.length,
      historyTurnsSummarized: 0,
      trimmedChars: Math.max(trimmedChars, 0),
      appliedPolicy: 'legacy',
    },
  };
}

export function assembleChatContext(input: AssembleChatContextInput): ContextAssemblyResult {
  const config = getContextBudgetConfig();
  const policy = input.policy ?? resolveChatContextPolicy();

  if (policy === 'legacy') {
    return assembleLegacyContext(input, config);
  }

  const message = clipChars(input.message.trim(), config.maxMessageChars);

  const historyResult = assembleHistoryContext({
    history: input.history,
    message,
    config,
  });

  let history = [...historyResult.history];
  let historySummary = historyResult.summary;

  const fileResult = assembleFileContext({
    path: input.selectedFile.path,
    content: input.selectedFile.content,
    message,
    config,
  });

  let fileContext = fileResult.context;

  const removeNonPinnedHistory = () => {
    while (history.length > historyResult.pinnedCount) {
      history.shift();
      if (estimatePromptChars({ message, history, historySummary, fileContext, config }) <= config.totalBudgetChars) {
        return true;
      }
    }

    return false;
  };

  for (let guard = 0; guard < 40; guard += 1) {
    const estimate = estimatePromptChars({
      message,
      history,
      historySummary,
      fileContext,
      config,
    });

    if (estimate <= config.totalBudgetChars) {
      break;
    }

    const overflow = estimate - config.totalBudgetChars;

    if (historySummary.length > 0) {
      historySummary = clipChars(historySummary, Math.max(historySummary.length - overflow - 120, 0));
      continue;
    }

    if (removeNonPinnedHistory()) {
      continue;
    }

    if (fileContext.length > 4_000) {
      fileContext = clipChars(fileContext, Math.max(fileContext.length - overflow - 200, 4_000));
      continue;
    }

    break;
  }

  const trimmedChars =
    input.message.length +
    sumHistoryChars(input.history) +
    input.selectedFile.content.length -
    (message.length + sumHistoryChars(history) + historySummary.length + fileContext.length);

  return {
    message,
    history,
    historySummary,
    fileContext,
    budget: config,
    stats: {
      messageChars: message.length,
      fileCharsUsed: fileContext.length,
      historyCharsUsed: sumHistoryChars(history),
      historyTurnsReceived: historyResult.receivedTurns,
      historyTurnsUsed: history.length,
      historyTurnsSummarized: historyResult.summarizedTurns,
      trimmedChars: Math.max(trimmedChars, 0),
      appliedPolicy: 'quality_guard_v1',
    },
  };
}
