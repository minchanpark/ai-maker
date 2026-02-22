'use client';

import { create } from 'zustand';

import type {
  ChatMessage,
  FileUpdatePayload,
  GeneratedPackage,
  ProjectInput,
} from '@/types';

interface DiffSnapshot {
  path: string;
  before: string;
  after: string;
}

interface GeneratorState {
  projectInput: ProjectInput | null;
  generatedPackage: GeneratedPackage | null;
  selectedPath: string | null;
  isGenerating: boolean;
  error: string | null;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  chatError: string | null;
  fileHistory: Record<string, string[]>;
  lastDiff: DiffSnapshot | null;
  setProjectInput: (input: ProjectInput | null) => void;
  setGeneratedPackage: (pkg: GeneratedPackage | null) => void;
  setSelectedPath: (path: string | null) => void;
  setGenerating: (value: boolean) => void;
  setError: (error: string | null) => void;
  setChatStreaming: (value: boolean) => void;
  setChatError: (error: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  appendAssistantToken: (token: string) => void;
  finalizeAssistantMessage: (params?: {
    status?: 'streaming' | 'done' | 'error';
    error?: string;
    fileUpdate?: FileUpdatePayload;
  }) => void;
  applyAiFileUpdate: (path: string, after: string, summary: string[]) => boolean;
  undoFile: (path: string) => void;
  resetChat: () => void;
  reset: () => void;
}

function makeMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneFiles(pkg: GeneratedPackage): GeneratedPackage['files'] {
  return pkg.files.map((file) => ({ ...file }));
}

export const useGeneratorStore = create<GeneratorState>((set) => ({
  projectInput: null,
  generatedPackage: null,
  selectedPath: null,
  isGenerating: false,
  error: null,
  chatMessages: [],
  isChatStreaming: false,
  chatError: null,
  fileHistory: {},
  lastDiff: null,
  setProjectInput: (projectInput) => set({ projectInput }),
  setGeneratedPackage: (generatedPackage) =>
    set({
      generatedPackage,
      selectedPath: generatedPackage?.files[0]?.path ?? null,
      chatMessages: [],
      isChatStreaming: false,
      chatError: null,
      fileHistory: {},
      lastDiff: null,
    }),
  setSelectedPath: (selectedPath) => set({ selectedPath }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  setChatStreaming: (isChatStreaming) => set({ isChatStreaming }),
  setChatError: (chatError) => set({ chatError }),
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),
  appendAssistantToken: (token) =>
    set((state) => {
      const chatMessages = [...state.chatMessages];
      const last = chatMessages[chatMessages.length - 1];

      if (!last || last.role !== 'assistant' || last.status !== 'streaming') {
        chatMessages.push({
          id: makeMessageId(),
          role: 'assistant',
          content: token,
          createdAt: Date.now(),
          status: 'streaming',
        });
      } else {
        chatMessages[chatMessages.length - 1] = {
          ...last,
          content: `${last.content}${token}`,
        };
      }

      return { chatMessages };
    }),
  finalizeAssistantMessage: (params) =>
    set((state) => {
      const chatMessages = [...state.chatMessages];
      const assistantIndex = [...chatMessages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === 'assistant')?.index;

      if (assistantIndex === undefined) {
        return {};
      }

      const assistantMessage = chatMessages[assistantIndex];
      chatMessages[assistantIndex] = {
        ...assistantMessage,
        status: params?.status ?? (assistantMessage.status === 'error' ? 'error' : 'done'),
        error: params?.error,
        fileUpdate: params?.fileUpdate ?? assistantMessage.fileUpdate,
      };

      return { chatMessages };
    }),
  applyAiFileUpdate: (path, after, summary) => {
    let applied = false;

    set((state) => {
      if (!state.generatedPackage) {
        return {};
      }

      const fileIndex = state.generatedPackage.files.findIndex((file) => file.path === path);
      if (fileIndex < 0) {
        return {};
      }

      const currentFile = state.generatedPackage.files[fileIndex];
      if (currentFile.content === after) {
        return {};
      }

      const nextFiles = cloneFiles(state.generatedPackage);
      nextFiles[fileIndex] = {
        ...currentFile,
        content: after,
      };

      const previousVersions = state.fileHistory[path] ?? [];
      const nextHistory = {
        ...state.fileHistory,
        [path]: [...previousVersions, currentFile.content],
      };

      applied = true;

      return {
        generatedPackage: {
          ...state.generatedPackage,
          files: nextFiles,
        },
        fileHistory: nextHistory,
        lastDiff: {
          path,
          before: currentFile.content,
          after,
        },
      };
    });

    if (applied) {
      set((state) => {
        const chatMessages = [...state.chatMessages];
        const assistantIndex = [...chatMessages]
          .map((message, index) => ({ message, index }))
          .reverse()
          .find(({ message }) => message.role === 'assistant')?.index;

        if (assistantIndex === undefined) {
          return {};
        }

        const assistantMessage = chatMessages[assistantIndex];
        chatMessages[assistantIndex] = {
          ...assistantMessage,
          fileUpdate: {
            path,
            before: state.lastDiff?.before ?? '',
            after,
            summary,
          },
        };

        return { chatMessages };
      });
    }

    return applied;
  },
  undoFile: (path) =>
    set((state) => {
      if (!state.generatedPackage) {
        return {};
      }

      const history = state.fileHistory[path] ?? [];
      if (history.length === 0) {
        return {};
      }

      const fileIndex = state.generatedPackage.files.findIndex((file) => file.path === path);
      if (fileIndex < 0) {
        return {};
      }

      const currentFile = state.generatedPackage.files[fileIndex];
      const previousContent = history[history.length - 1];

      const nextFiles = cloneFiles(state.generatedPackage);
      nextFiles[fileIndex] = {
        ...currentFile,
        content: previousContent,
      };

      const trimmedHistory = history.slice(0, -1);
      const nextHistory = { ...state.fileHistory };
      if (trimmedHistory.length > 0) {
        nextHistory[path] = trimmedHistory;
      } else {
        delete nextHistory[path];
      }

      return {
        generatedPackage: {
          ...state.generatedPackage,
          files: nextFiles,
        },
        fileHistory: nextHistory,
        lastDiff: {
          path,
          before: currentFile.content,
          after: previousContent,
        },
      };
    }),
  resetChat: () =>
    set({
      chatMessages: [],
      isChatStreaming: false,
      chatError: null,
      fileHistory: {},
      lastDiff: null,
    }),
  reset: () =>
    set({
      projectInput: null,
      generatedPackage: null,
      selectedPath: null,
      isGenerating: false,
      error: null,
      chatMessages: [],
      isChatStreaming: false,
      chatError: null,
      fileHistory: {},
      lastDiff: null,
    }),
}));
