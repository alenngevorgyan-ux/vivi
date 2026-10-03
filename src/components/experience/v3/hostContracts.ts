/**
 * The V3 host contracts: what a player shell must supply around the pure reducer.
 *
 * The reducer stays pure and synchronous. Everything asynchronous — preparing a
 * scene's resources, writing the acceptance journal, recording the decision,
 * loading the private author record, completing a presentation phase — is done
 * by the host and reported back only through guarded controller events. None
 * of these functions may be called by the reducer, and none is optional in a
 * visual host: a missing one is a configuration failure, never a success.
 */

import type { RevealRecordV3 } from '../../../engine/v3/contracts/manifest.ts';
import type { RevealValidationOptions } from '../../../engine/v3/contracts/reveal.ts';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state.ts';

/** Who is asking. A completion is applied only if this still matches the live host exactly. */
export interface HostIdentity {
  experienceId: string;
  manifestRevision: string;
  decisionVersion: string;
  assetRevisions: Readonly<Record<string, string>>;
  attemptId: string;
  /** Mount generation: bumped on every attach/detach, so a callback from an earlier mount can never land. */
  mount: number;
}

/* ------------------------------------------------------------ preload --- */

export interface PreloadSceneRequest {
  sceneId: string;
  /** The portal transaction id, or `entry` for the initial / restored scene. */
  txId: string;
  identity: HostIdentity;
  /** Aborted on unmount, revision change or a replaced attempt. Stop work and dispose resources. */
  signal: AbortSignal;
}

/**
 * Resolve only when the destination can mount: validated/hash-matched resources fetched, images decoded,
 * fonts/layout available. An explicitly approved still/readable fallback counts as prepared. Never reveal material.
 */
export interface PreparedScene {
  sceneId: string;
  fallback?: 'still' | 'readable';
}
export type PreloadScene = (request: PreloadSceneRequest) => Promise<PreparedScene>;

/* -------------------------------------------------------- persistence --- */

/** The idempotent record of one accepted choice. Retries send this exact operation; the key never changes. */
export interface DecisionOperation {
  /** `v3:<experience>:<decisionVersion>:<attempt>:<option>` — attempt + decision version + option. */
  key: string;
  experienceId: string;
  manifestRevision: string;
  decisionVersion: string;
  decisionId: string;
  option: string;
  attemptId: string;
}

/** A repository acknowledgement. It must name this exact key, decision and option to count. */
export interface DecisionAck {
  key: string;
  decisionId: string;
  option: string;
}

/**
 * Durable decision storage. `record` is idempotent: the same key returns the original ack. A conflict (a
 * different first answer already stored) must reject, never silently replace. A synchronous throw and a rejected
 * promise are treated identically.
 */
export interface DecisionRepository {
  record(op: DecisionOperation): Promise<DecisionAck> | DecisionAck;
}

export interface JournalEntry {
  op: DecisionOperation;
  /** The accepted snapshot. Pre-boundary by construction: it never holds reveal content. */
  snapshot: RuntimeSnapshot;
}

/**
 * The local durable acceptance journal (outbox). `write` resolves only once the entry would survive a reload;
 * `read` returns the entry for this experience/decision version so a reload recovers an accepted-but-unrecorded
 * choice. Operational metadata, never a second decision authority: recovery re-validates the snapshot.
 */
export interface AcceptanceJournal {
  write(entry: JournalEntry): Promise<void> | void;
  read(scope: { experienceId: string; manifestRevision: string; decisionVersion: string }): Promise<JournalEntry | undefined> | JournalEntry | undefined;
}

/* -------------------------------------------------------------- reveal --- */

/** The trusted, explicit mapping from this manifest variant to its private record. */
export interface RevealBinding {
  revealRef: string;
  /** A control shares its story's record, so this is NOT assumed to equal the manifest revision. */
  recordRevision: string;
  /** A story's launch profile, checked on top of the generic record contract. */
  profile?: RevealValidationOptions['profile'];
}

export interface RevealLoadRequest {
  experienceId: string;
  manifestRevision: string;
  revealRef: string;
  recordRevision: string;
  signal: AbortSignal;
}
/** Must return the actual record. It is validated at runtime before anyone can render it. */
export type RevealLoader = (request: RevealLoadRequest) => Promise<unknown>;
export type { RevealRecordV3 };

/* -------------------------------------------------------------- config --- */

interface Common {
  /** Snapshot saves at completed transitions and acceptance (resume support). */
  onSave?: (snapshot: RuntimeSnapshot) => void;
  /** Scheduling of host-side follow-up work (default: a microtask). Tests may substitute. */
  schedule?: (fn: () => void) => void;
}

/** A real renderer. Every contract is mandatory; nothing completes on its own. */
export interface VisualHostConfig extends Common {
  mode: 'visual';
  preloadScene: PreloadScene;
  repository: DecisionRepository;
  journal: AcceptanceJournal;
  loadReveal: RevealLoader;
  reveal: RevealBinding;
}

/**
 * A renderer-less host (tests, the Foundation harness). EXPLICITLY selected. Preparation completes at once when
 * no `preloadScene` is given, and presentation phases advance by themselves. Persistence and reveal loading
 * follow the same fail-closed rules as the visual host: an absent repository never records, an absent loader
 * never reveals. Durable acceptance is not required before the reveal unless `requireDurableAcceptance` is set.
 */
export interface HeadlessHostConfig extends Common {
  mode: 'headless';
  preloadScene?: PreloadScene;
  repository?: DecisionRepository;
  journal?: AcceptanceJournal;
  loadReveal?: RevealLoader;
  reveal?: RevealBinding;
  requireDurableAcceptance?: boolean;
}

export type HostConfig = VisualHostConfig | HeadlessHostConfig;

/* -------------------------------------------------------------- status --- */

/**
 * Host operational state: loading, saving and failure, for the shell to SHOW. It is never story state and
 * never a second phase machine — the snapshot alone says where the story is.
 */
export interface HostStatus {
  config: { missing: string[] };
  recovery: 'none' | 'recovered' | 'ignored_invalid';
  entry: 'idle' | 'preparing' | 'ready' | 'failed';
  transition: { state: 'idle' | 'preparing' | 'failed'; txId?: string; error?: 'unconfigured' | 'load_failed' | 'invalid_prepared' };
  persistence: {
    key?: string;
    journal: 'idle' | 'writing' | 'written' | 'failed' | 'unconfigured';
    repository: 'idle' | 'saving' | 'recorded' | 'failed' | 'unconfigured';
    attempts: number;
    error?: 'journal_failed' | 'repository_failed' | 'ack_mismatch';
    /** Durable when the local journal is written or a repository acknowledged the exact operation. */
    durable: boolean;
  };
  /** Why the boundary has (not) handed over to the private account. */
  revealGate: 'closed' | 'waiting_for_presentation' | 'waiting_for_durable_acceptance' | 'released';
  reveal: { state: 'idle' | 'loading' | 'ready' | 'failed'; error?: 'unconfigured' | 'load_failed' | 'invalid'; issues?: string[] };
}

/** Binds a presentation receipt to the exact mount, attempt, decision and phase it was rendered for. */
export interface PresentationToken {
  mount: number;
  attemptId: string;
  decisionId?: string;
  option?: string;
  phase: 'enacting' | 'holding' | 'boundary';
}

export type ReceiptResult = { ok: true } | { ok: false; reason: 'stale' | 'detached' | 'hidden' | 'wrong_phase' | 'rejected' };
