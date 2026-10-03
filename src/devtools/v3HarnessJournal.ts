/**
 * Dev-only acceptance journal for the V3 foundation harness: a sessionStorage outbox so a reload recovers an
 * accepted-but-unrecorded choice. It is NOT part of the runtime (the runtime owns no storage; hosts inject it).
 */

import type { AcceptanceJournal, JournalEntry } from '../components/experience/v3/hostContracts';

const keyOf = (s: { experienceId: string; manifestRevision: string; decisionVersion: string }) => `v3-journal:${s.experienceId}:${s.manifestRevision}:${s.decisionVersion}`;

export const harnessJournal: AcceptanceJournal = {
  write(e: JournalEntry) {
    // An unavailable store is a FAILED write, never a silent success.
    try {
      sessionStorage.setItem(keyOf(e.op), JSON.stringify(e));
    } catch {
      throw new Error('journal unavailable');
    }
  },
  read(scope) {
    try {
      const raw = sessionStorage.getItem(keyOf(scope));
      return raw ? (JSON.parse(raw) as JournalEntry) : undefined;
    } catch {
      return undefined;
    }
  },
};
