/**
 * Discriminated playback loader.
 *
 * Classifies a stored item and routes it. It never rewrites anything:
 *  - V3 posts (`postSchemaVersion: 3`) are validated and returned for the V3
 *    player;
 *  - V1/V2 posts (`schemaVersion: 2`) and legacy GameSpecs are returned as
 *    they are, to be played by the existing path exactly as before;
 *  - an unknown or future schema fails safely as `unsupported`; it is never
 *    guessed to be an older shape;
 *  - a V3 item that fails validation is `invalid_v3`, not "best effort".
 *
 * Inputs are only read. Old posts are not mutated, recompiled or re-expanded.
 */

import type { StoredPlayablePost } from '../../runtime/generationPipeline.ts';
import { isStoredPlayablePost } from '../../runtime/generationPipeline.ts';
import type { GameSpec } from '../../../types/gameSpec.ts';
import { POST_SCHEMA_VERSION, RUNTIME_MANIFEST_VERSION, type PlaybackManifestV3, type StoredPostV3 } from '../contracts/manifest.ts';
import { SEMANTIC_SCHEMA_VERSION } from '../contracts/semantic.ts';
import { formatIssues, validateStoredPostV3, type ValidationIssue } from '../contracts/validate.ts';

export interface V3Versions {
  postSchema: 3;
  runtimeManifest: 3;
  semanticSchema: 3;
  compiler: string;
  assetRevisions: Readonly<Record<string, string>>;
}

export type UnsupportedReason = 'future_post_schema' | 'unknown_post_schema' | 'future_manifest_version' | 'unrecognised_shape';

export type LoadResult =
  | { kind: 'v3'; post: StoredPostV3; manifest: PlaybackManifestV3; versions: V3Versions }
  | { kind: 'legacy_stored_post'; post: StoredPlayablePost }
  | { kind: 'legacy_game_spec'; game: GameSpec }
  /** Claims to be V3 but does not validate. Never played, never reinterpreted. */
  | { kind: 'invalid_v3'; issues: ValidationIssue[]; summary: string }
  | { kind: 'unsupported'; reason: UnsupportedReason };

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A legacy GameSpec is the long-standing shape of the archive: an id, a graph of nodes and a start node. */
function isLegacyGameSpec(item: Record<string, unknown>): boolean {
  return typeof item.id === 'string' && isRec(item.nodes) && typeof item.startNodeId === 'string';
}

export function loadPlayable(item: unknown): LoadResult {
  if (!isRec(item)) return { kind: 'unsupported', reason: 'unrecognised_shape' };

  /* V3 is identified only by an explicit marker; nothing else is promoted to it. */
  if ('postSchemaVersion' in item) {
    const v = item.postSchemaVersion;
    if (v !== POST_SCHEMA_VERSION) return { kind: 'unsupported', reason: typeof v === 'number' && v > POST_SCHEMA_VERSION ? 'future_post_schema' : 'unknown_post_schema' };
    const mv = isRec(item.playback) ? item.playback.runtimeManifestVersion : undefined;
    const sv = isRec(item.playback) ? item.playback.semanticSchemaVersion : undefined;
    if (typeof mv === 'number' && mv > RUNTIME_MANIFEST_VERSION) return { kind: 'unsupported', reason: 'future_manifest_version' };
    if (typeof sv === 'number' && sv > SEMANTIC_SCHEMA_VERSION) return { kind: 'unsupported', reason: 'future_manifest_version' };
    const r = validateStoredPostV3(item);
    if (!r.ok) return { kind: 'invalid_v3', issues: r.issues, summary: formatIssues(r.issues) };
    const manifest = r.value.playback;
    return {
      kind: 'v3',
      post: r.value,
      manifest,
      versions: { postSchema: 3, runtimeManifest: 3, semanticSchema: 3, compiler: manifest.compilerVersion, assetRevisions: manifest.assetRevisions },
    };
  }

  /* A V3-looking manifest without the post marker is not a post: refuse rather than guess. */
  if ('runtimeManifestVersion' in item) return { kind: 'unsupported', reason: 'unrecognised_shape' };

  /* V1/V2: exactly the check the app has always used. */
  if (isStoredPlayablePost(item)) return { kind: 'legacy_stored_post', post: item };
  if ('schemaVersion' in item) return { kind: 'unsupported', reason: typeof item.schemaVersion === 'number' && item.schemaVersion > 2 ? 'future_post_schema' : 'unknown_post_schema' };
  if (isLegacyGameSpec(item)) return { kind: 'legacy_game_spec', game: item as unknown as GameSpec };
  return { kind: 'unsupported', reason: 'unrecognised_shape' };
}
