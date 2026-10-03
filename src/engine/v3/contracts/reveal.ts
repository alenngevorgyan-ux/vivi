/**
 * Runtime validation of the private author record (`RevealRecordV3`).
 *
 * A host loader's result is untrusted until it passes here: TypeScript and a
 * checked-in fixture validate nothing about what an async loader returns.
 * Closed keys, exact schema version, identity against the explicit variant
 * mapping, the status enum, bounded plain text (no markup, URLs or script),
 * source references and the author-option mapping rules. Generic: memory and
 * compound stories keep their legitimately absent option or fields; a story's
 * stricter launch profile is passed in, never assumed here.
 *
 * Issues carry a path and a code only — never the private text.
 */

import { REVEAL_SCHEMA_VERSION, type RevealRecordV3 } from './manifest.ts';
import { ID_RE, isSafeText, type IssueCode, type ValidationIssue, type ValidationResult } from './validate.ts';

export const REVEAL_STATUSES: readonly RevealRecordV3['status'][] = ['author_account', 'fictional_editorial', 'withheld', 'documented'];
export const REVEAL_TEXT_MAX = 2000;
const ACCOUNT_FIELDS = ['act', 'why', 'aftermath'] as const;
const KEYS = new Set(['revealSchemaVersion', 'experienceId', 'revision', 'status', 'act', 'why', 'aftermath', 'withheld', 'authorOption', 'authorHandle', 'sourceRefs']);

export interface RevealValidationOptions {
  experienceId: string;
  /**
   * The private record revision this manifest variant maps to. Explicit, because a naive equality with the
   * manifest revision would reject a control that shares its story's record.
   */
  recordRevision: string;
  /** The primary decision's option ids, or null for a story without a decision (memory form). */
  options: readonly string[] | null;
  /** A story's launch profile, e.g. gold-1: an exact status, required fields, exact sources and option. */
  profile?: {
    status?: RevealRecordV3['status'];
    requireFields?: ReadonlyArray<'act' | 'why' | 'aftermath' | 'withheld'>;
    sourceRefs?: readonly string[];
    authorOption?: string | null;
  };
}

export function validateRevealRecord(raw: unknown, o: RevealValidationOptions): ValidationResult<RevealRecordV3> {
  const issues: ValidationIssue[] = [];
  const add = (path: string, code: IssueCode, message: string) => issues.push({ path, code, message });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, issues: [{ path: '$', code: 'type', message: 'expected a reveal record' }] };
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!KEYS.has(k)) add(k, 'unknown_key', 'key is not part of the reveal contract');

  if (r.revealSchemaVersion !== REVEAL_SCHEMA_VERSION) add('revealSchemaVersion', 'version', 'unsupported reveal schema version');
  if (r.experienceId !== o.experienceId) add('experienceId', 'unknown_ref', 'record belongs to another experience');
  if (r.revision !== o.recordRevision) add('revision', 'version', 'record revision is not the one this variant maps to');
  if (!REVEAL_STATUSES.includes(r.status as RevealRecordV3['status'])) add('status', 'enum', 'unknown reveal status');
  if (!isSafeText(r.authorHandle, 80)) add('authorHandle', 'text_format', 'author handle must be short plain text');

  for (const f of [...ACCOUNT_FIELDS, 'withheld'] as const) {
    if (r[f] !== undefined && !isSafeText(r[f], REVEAL_TEXT_MAX)) add(f, 'text_format', 'account text must be non-empty plain text without markup, URLs or expressions');
  }
  const present = ACCOUNT_FIELDS.filter(f => r[f] !== undefined);
  // A withheld account carries no act/why/aftermath; any other status must actually say something.
  if (r.status === 'withheld' && present.length > 0) add('status', 'graph', 'a withheld account cannot carry account text');
  if (r.status !== 'withheld' && present.length === 0) add('act', 'missing_key', 'an account needs at least one of act, why, aftermath');

  if (r.authorOption !== undefined) {
    if (o.options === null) add('authorOption', 'graph', 'a story without a decision has no author option');
    else if (typeof r.authorOption !== 'string' || !o.options.includes(r.authorOption)) add('authorOption', 'unknown_ref', 'author option is not an option of this decision');
  }
  if (r.sourceRefs !== undefined && (!Array.isArray(r.sourceRefs) || r.sourceRefs.length > 12 || !r.sourceRefs.every(x => typeof x === 'string' && ID_RE.test(x)))) add('sourceRefs', 'id_format', 'source references must be identifiers');

  const p = o.profile;
  if (p) {
    if (p.status && r.status !== p.status) add('status', 'enum', 'status differs from the story profile');
    for (const f of p.requireFields ?? []) if (r[f] === undefined) add(f, 'missing_key', 'the story profile requires this field');
    if (p.sourceRefs && JSON.stringify(r.sourceRefs) !== JSON.stringify(p.sourceRefs)) add('sourceRefs', 'graph', 'source references differ from the story profile');
    if (p.authorOption !== undefined && (r.authorOption ?? null) !== p.authorOption) add('authorOption', 'graph', 'author option differs from the story profile');
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: r as unknown as RevealRecordV3, issues: [] };
}
