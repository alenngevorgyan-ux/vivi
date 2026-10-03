/**
 * Input ownership, as a pure decision table.
 *
 * Context priority, highest first:
 *
 *   text_entry > modal > intent_sheet > observation > transition > world > page
 *
 * Only the highest eligible context handles a command. This module holds the
 * rules; `InputManager` feeds it facts about a real DOM event and carries out
 * the result. Being pure, the whole table is unit-testable without a browser.
 *
 * Two deliberate rules:
 *  - The world surface owns the DEFAULT BEHAVIOUR of arrow/WASD keys while it
 *    has focus, even when locomotion is not currently possible, so the page
 *    never suddenly starts scrolling under a player who is "in" the scene.
 *    Locomotion itself happens only when the world is the top scope and
 *    movement is eligible.
 *  - Nothing outside the world surface is ever prevented. Native controls,
 *    editors, links, Tab and every modifier combination keep browser behaviour.
 */

export type ScopeKind = 'text_entry' | 'modal' | 'intent_sheet' | 'observation' | 'transition' | 'world' | 'page';
export type RegisteredScope = 'modal' | 'intent_sheet' | 'observation' | 'transition';

export const SCOPE_ORDER: readonly ScopeKind[] = ['text_entry', 'modal', 'intent_sheet', 'observation', 'transition', 'world', 'page'];
const REGISTERED_ORDER: readonly RegisteredScope[] = ['modal', 'intent_sheet', 'observation', 'transition'];
/** Scopes that own Escape (they can be closed). Transition/enactment cannot be undone. */
const CLOSABLE: readonly RegisteredScope[] = ['modal', 'intent_sheet', 'observation'];

export type MoveCode = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD';
const MOVE_CODES: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

export type TargetKind = 'world_surface' | 'editable' | 'native_control' | 'other';

export interface KeyFacts {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  repeat: boolean;
  isComposing: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export interface RouteContext {
  target: TargetKind;
  scopes: readonly RegisteredScope[];
  movementEligible: boolean;
}

export type RouteAction =
  | { kind: 'none' }
  | { kind: 'move_down'; code: MoveCode }
  /** The world owns the key but locomotion is not possible right now. */
  | { kind: 'blocked' }
  | { kind: 'activate' }
  | { kind: 'cancel'; scope: ScopeKind };

export interface RouteResult {
  owner: ScopeKind;
  preventDefault: boolean;
  action: RouteAction;
}

const NONE = (owner: ScopeKind): RouteResult => ({ owner, preventDefault: false, action: { kind: 'none' } });

/**
 * Movement keys are identified by PHYSICAL position (`code`) so WASD works on
 * RU and HY layouts. When a synthetic event carries no `code`, only arrows are
 * recognised by `key`. Text commands elsewhere should use the logical `key`.
 */
export function movementCode(k: Pick<KeyFacts, 'key' | 'code'>): MoveCode | undefined {
  if (MOVE_CODES.includes(k.code)) return k.code as MoveCode;
  if (!k.code) {
    const arrow = ({ ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' } as const)[k.key as 'ArrowUp'];
    if (arrow) return arrow;
  }
  return undefined;
}

/** Screen-space vector: x right, y down. Opposite keys cancel; diagonals are normalised. */
export function movementVector(held: ReadonlySet<MoveCode>): [number, number] {
  const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
  const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
  if (x !== 0 && y !== 0) return [Math.round(x * Math.SQRT1_2 * 1000) / 1000, Math.round(y * Math.SQRT1_2 * 1000) / 1000];
  return [x, y];
}

export function topRegistered(scopes: readonly RegisteredScope[]): RegisteredScope | undefined {
  return REGISTERED_ORDER.find(s => scopes.includes(s));
}

/** Who owns input right now, for this event target. */
export function ownerOf(ctx: Pick<RouteContext, 'target' | 'scopes'>): ScopeKind {
  if (ctx.target === 'editable') return 'text_entry';
  const top = topRegistered(ctx.scopes);
  if (top) return top;
  return ctx.target === 'world_surface' ? 'world' : 'page';
}

export function routeKeydown(k: KeyFacts, ctx: RouteContext): RouteResult {
  const owner = ownerOf(ctx);
  // IME composition and dead keys belong to the editor, always.
  if (k.isComposing || k.key === 'Process' || k.key === 'Dead') return NONE(owner);

  const top = topRegistered(ctx.scopes);
  const closable = top && CLOSABLE.includes(top) ? top : undefined;

  /* text entry owns everything natively; only dialog policy may close a dialog with Escape */
  if (ctx.target === 'editable') {
    if (k.key === 'Escape' && closable && !k.ctrl && !k.meta && !k.alt && !k.shift) return { owner: closable, preventDefault: true, action: k.repeat ? { kind: 'none' } : { kind: 'cancel', scope: closable } };
    return NONE(owner);
  }

  /* browser and OS shortcuts are never ours */
  if (k.ctrl || k.meta || k.alt || k.shift) return NONE(owner);

  const move = movementCode(k);
  if (move) {
    if (ctx.target !== 'world_surface') return NONE(owner); // native: a button, a link or the page itself
    const worldIsTop = !top;
    return { owner, preventDefault: true, action: worldIsTop && ctx.movementEligible ? { kind: 'move_down', code: move } : { kind: 'blocked' } };
  }

  if (k.key === 'Enter') {
    // Enter on anything but the world surface is native activation, untouched.
    if (ctx.target !== 'world_surface' || top) return NONE(owner);
    // A held key is swallowed: one press, one command.
    return { owner, preventDefault: true, action: k.repeat ? { kind: 'none' } : { kind: 'activate' } };
  }

  if (k.key === 'Escape') {
    if (closable) return { owner: closable, preventDefault: true, action: k.repeat ? { kind: 'none' } : { kind: 'cancel', scope: closable } };
    if (ctx.target === 'world_surface' && !top) return { owner: 'world', preventDefault: true, action: k.repeat ? { kind: 'none' } : { kind: 'cancel', scope: 'world' } };
    return NONE(owner);
  }

  // Tab, Space and everything else keep native behaviour. The world surface never traps focus.
  return NONE(owner);
}
