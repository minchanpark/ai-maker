import { beforeEach, describe, expect, it } from 'vitest';

import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { useGeneratorStore } from '@/store/generatorStore';
import { baseInput } from '@/tests/fixtures';

describe('generatorStore chat updates', () => {
  beforeEach(() => {
    useGeneratorStore.getState().reset();
    useGeneratorStore.getState().setGeneratedPackage(createGeneratedPackage(baseInput));
  });

  it('applyAiFileUpdate pushes history and updates diff', () => {
    const initialState = useGeneratorStore.getState();
    const file = initialState.generatedPackage?.files[0];

    expect(file).toBeTruthy();

    const updatedContent = `${file!.content}\n# updated`;
    const applied = useGeneratorStore.getState().applyAiFileUpdate(file!.path, updatedContent, ['내용 보강']);

    expect(applied).toBe(true);

    const nextState = useGeneratorStore.getState();
    const nextFile = nextState.generatedPackage?.files.find((item) => item.path === file!.path);

    expect(nextFile?.content).toBe(updatedContent);
    expect(nextState.fileHistory[file!.path]).toEqual([file!.content]);
    expect(nextState.lastDiff).toEqual({
      path: file!.path,
      before: file!.content,
      after: updatedContent,
    });
  });

  it('undoFile restores previous content in multi-step history', () => {
    const file = useGeneratorStore.getState().generatedPackage!.files[0]!;
    const firstUpdate = `${file.content}\n# first`;
    const secondUpdate = `${firstUpdate}\n# second`;

    useGeneratorStore.getState().applyAiFileUpdate(file.path, firstUpdate, []);
    useGeneratorStore.getState().applyAiFileUpdate(file.path, secondUpdate, []);

    useGeneratorStore.getState().undoFile(file.path);
    let current = useGeneratorStore.getState().generatedPackage!.files.find((item) => item.path === file.path)!;
    expect(current.content).toBe(firstUpdate);

    useGeneratorStore.getState().undoFile(file.path);
    current = useGeneratorStore.getState().generatedPackage!.files.find((item) => item.path === file.path)!;
    expect(current.content).toBe(file.content);
    expect(useGeneratorStore.getState().fileHistory[file.path]).toBeUndefined();
  });
});
