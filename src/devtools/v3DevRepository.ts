/**
 * Dev-only decision repository and journal wrapper for the V3 visual player's development entry. NOT a production
 * service: a sessionStorage store that honours the repository contract (idempotent on the key; a different first
 * answer for the same attempt and decision version is a conflict, never a replacement), with explicit fault
 * injection for browser QA. The runtime owns no storage; hosts inject these.
 */

import type { AcceptanceJournal, DecisionAck, DecisionOperation, DecisionRepository } from '../components/experience/v3/hostContracts';
import { harnessJournal } from './v3HarnessJournal';

export type PersistFault = 'none' | 'reject' | 'flaky' | 'mismatch';

const STORE = 'v3-dev-repository';
const read = (): Record<string, DecisionOperation> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '{}');
  } catch {
    return {};
  }
};

export function devRepository(fault: () => PersistFault, log?: (op: DecisionOperation) => void): DecisionRepository {
  let calls = 0;
  return {
    record(op): Promise<DecisionAck> {
      calls++;
      log?.(op);
      const f = fault();
      if (f === 'reject' || (f === 'flaky' && calls === 1)) return Promise.reject(new Error('repository unavailable'));
      const all = read();
      const conflict = Object.values(all).find(x => x.experienceId === op.experienceId && x.decisionVersion === op.decisionVersion && x.attemptId === op.attemptId && x.key !== op.key);
      if (conflict) return Promise.reject(new Error('conflicting first answer'));
      if (!all[op.key]) {
        all[op.key] = op;
        try {
          sessionStorage.setItem(STORE, JSON.stringify(all));
        } catch {
          return Promise.reject(new Error('repository unavailable'));
        }
      }
      if (f === 'mismatch') return Promise.resolve({ key: op.key, decisionId: op.decisionId, option: 'another_option' });
      return Promise.resolve({ key: op.key, decisionId: op.decisionId, option: op.option });
    },
  };
}

export type JournalFault = 'none' | 'reject' | 'flaky';

export function devJournal(fault: () => JournalFault): AcceptanceJournal {
  let calls = 0;
  return {
    write(e) {
      calls++;
      const f = fault();
      if (f === 'reject' || (f === 'flaky' && calls === 1)) throw new Error('journal unavailable');
      return harnessJournal.write(e);
    },
    read: scope => harnessJournal.read(scope),
  };
}

/** Dev resume store: the snapshot saved at completed transitions and acceptance (reload support). */
export const devSnapshots = {
  key: (experienceId: string, revision: string) => `v3-dev-snapshot:${experienceId}:${revision}`,
  read(experienceId: string, revision: string): unknown {
    try {
      const raw = sessionStorage.getItem(this.key(experienceId, revision));
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  },
  write(experienceId: string, revision: string, snapshot: unknown) {
    try {
      sessionStorage.setItem(this.key(experienceId, revision), JSON.stringify(snapshot));
    } catch {
      /* resume support only; the journal carries the accepted act */
    }
  },
};

/** Dev per-viewer display preferences (readable mode, reduced motion), in sessionStorage. */
export const devPrefs = {
  read(key: string): boolean | undefined {
    try {
      const v = sessionStorage.getItem(`v3p:${key}`);
      return v === null ? undefined : v === '1';
    } catch {
      return undefined;
    }
  },
  write(key: string, value: boolean) {
    try {
      sessionStorage.setItem(`v3p:${key}`, value ? '1' : '0');
    } catch {
      /* a convenience only */
    }
  },
};
