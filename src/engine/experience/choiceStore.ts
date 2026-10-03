/**
 * The player's own choices, on this device only.
 *
 * There is no shared backend in this build, so there are no "how others
 * chose" numbers to show — and none are invented. What is kept is honest and
 * local: the first choice a player made in a given version of a scene (made
 * before any reveal), counted once however many times it is persisted, and
 * replays kept apart from it.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ChoiceRecord {
  /** Post id + scene version key: a recompiled scene with other deeds is another scene. */
  key: string;
  firstChoiceId: string;
  firstAt: number;
  /** Attempts already recorded, so a double persist cannot double count. */
  attempts: string[];
  replays: Array<{ choiceId: string; at: number }>;
  /** The player's private note: why they chose this. */
  note?: string;
}

const STORAGE_KEY = 'vivi_choices_v2';

/** A scene's version key: same post and the same deeds on offer. */
export function sceneKey(postId: string, compilerVersion: string | undefined, choiceIds: string[]): string {
  return `${postId}@${compilerVersion ?? 'legacy'}#${[...choiceIds].sort().join(',')}`;
}

function load(storage: StorageLike): Record<string, ChoiceRecord> {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function save(storage: StorageLike, all: Record<string, ChoiceRecord>) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: the experience still works, it just is not remembered
  }
}

/**
 * Record a commitment. `attemptId` identifies one playthrough; persisting the
 * same attempt twice is a no-op.
 */
export function persistChoice(storage: StorageLike, key: string, choiceId: string, attemptId: string, now = Date.now()): ChoiceRecord {
  const all = load(storage);
  const existing = all[key];
  if (!existing) {
    const record: ChoiceRecord = { key, firstChoiceId: choiceId, firstAt: now, attempts: [attemptId], replays: [] };
    all[key] = record;
    save(storage, all);
    return record;
  }
  if (existing.attempts.includes(attemptId)) return existing;
  const record: ChoiceRecord = {
    ...existing,
    attempts: [...existing.attempts, attemptId].slice(-50),
    replays: [...existing.replays, { choiceId, at: now }].slice(-50),
  };
  all[key] = record;
  save(storage, all);
  return record;
}

export function readChoice(storage: StorageLike, key: string): ChoiceRecord | undefined {
  return load(storage)[key];
}

export function saveNote(storage: StorageLike, key: string, note: string): ChoiceRecord | undefined {
  const all = load(storage);
  if (!all[key]) return undefined;
  all[key] = { ...all[key], note: note.slice(0, 600) };
  save(storage, all);
  return all[key];
}
