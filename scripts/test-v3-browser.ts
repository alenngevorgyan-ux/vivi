import assert from 'node:assert/strict';
import net from 'node:net';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

/**
 * V3 browser tests: REAL keyboard and pointer events in a real Chrome, against
 * the dev-only foundation harness (`/?v3=foundation`).
 *
 * Why playwright-core: it is the one new dev dependency (no test runner, no
 * downloaded browsers). It drives the system Chrome, so nothing is installed
 * beyond one small package. Set V3_BROWSER_PATH to use a different binary.
 *
 * The harness exposes `window.__v3Test` (dev builds only). Test SETUP may call
 * `dispatch` to reach a state quickly; every assertion about ownership, focus,
 * scrolling and activation is driven by real `keyboard`/`mouse` input.
 */

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });

let server: ViteDevServer;
let browser: Browser;
let base = '';

interface Intent {
  type: string;
  vector?: [number, number];
  reason?: string;
  source?: string;
  scope?: string;
  activationId?: string;
}

const T = (id: string) => `[data-testid="${id}"]`;
const scrollY = (p: Page) => p.evaluate(() => Math.round(window.scrollY));
const active = (p: Page) => p.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? 'none');
const intents = (p: Page): Promise<Intent[]> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Test!.intents)));
const moves = async (p: Page) => (await intents(p)).filter(i => i.type === 'move');
const lastMove = async (p: Page) => (await moves(p)).at(-1);
const state = (p: Page): Promise<any> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Test!.getState())));
const events = (p: Page): Promise<Array<{ type: string; rejected?: string }>> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Test!.events)));
const decisions = (p: Page): Promise<Array<{ decision: string; option: string }>> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Test!.decisions)));
const settle = (p: Page, ms = 120) => p.waitForTimeout(ms);
const inside = (p: Page, testId: string) => p.evaluate(id => !!document.activeElement && !!document.querySelector(`[data-testid="${id}"]`)?.contains(document.activeElement), testId);
const dispatch = (p: Page, e: object) => p.evaluate(ev => window.__v3Test!.dispatch(ev as never)?.rejected?.code ?? 'ok', e);
let setupSeq = 0;
const sid = () => `setup${++setupSeq}`;

async function open(ctxOpts: Parameters<Browser['newContext']>[0] = { viewport: { width: 1280, height: 800 } }): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|WebSocket|HMR|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/?v3=foundation`);
  await page.waitForFunction(() => document.querySelector('[data-testid="phase"]')?.textContent === 'playing');
  return { page, errors };
}

/** Click the stage with the real mouse: the deliberate way into the scene controls. */
async function enterWorld(p: Page) {
  await p.locator(T('world-surface')).click({ position: { x: 20, y: 20 } });
  assert.equal(await active(p), 'world-surface', 'tapping the stage focuses the scene controls');
}

/** Setup: reach the decision scene with all minimum knowledge, through the controller (not the keyboard). */
async function reachDecision(p: Page) {
  const d = (e: object) => dispatch(p, e);
  assert.equal(await d({ type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: sid() }), 'ok');
  await d({ type: 'CLOSE_OBSERVATION' });
  for (const [portal, beats] of [['p_a_to_b', 2], ['p_b_to_c', 1]] as const) {
    assert.equal(await d({ type: 'REQUEST_PORTAL', id: portal, activationId: sid() }), 'ok');
    await p.waitForFunction(() => document.querySelector('[data-testid="phase"]')?.textContent === 'playing');
    for (let i = 0; i < beats; i++) assert.equal(await d({ type: 'ADVANCE' }), 'ok');
  }
  assert.equal((await state(p)).scene, 'scene_c');
}

const results: Array<[string, string | null]> = [];
async function test(name: string, fn: (p: Page) => Promise<void>, ctxOpts?: Parameters<Browser['newContext']>[0]) {
  if (process.env.V3_ONLY && !name.includes(process.env.V3_ONLY)) return;
  const { page, errors } = await open(ctxOpts);
  try {
    await fn(page);
    assert.deepEqual(errors, [], 'no page errors');
    results.push([name, null]);
    console.log(`✓ ${results.length}. ${name}`);
  } catch (e) {
    results.push([name, String((e as Error).stack ?? e)]);
    console.log(`✗ ${results.length}. ${name}\n   ${String((e as Error).message).split('\n').join('\n   ')}`);
  } finally {
    await page.context().close();
  }
}

async function main() {
  const port = await freePort();
  server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null as never }, logLevel: 'error', clearScreen: false });
  await server.listen();
  base = `http://127.0.0.1:${port}`;
  try {
    browser = process.env.V3_BROWSER_PATH ? await chromium.launch({ executablePath: process.env.V3_BROWSER_PATH }) : await chromium.launch({ channel: 'chrome' });
  } catch (e) {
    await server.close();
    console.error('Could not launch Chrome. Install Google Chrome or set V3_BROWSER_PATH to a Chromium binary.\n', String(e));
    process.exit(2);
  }
  console.log(`Testing V3 foundation in ${browser.version()}...\n`);

  /* ---------------------------------------------------------------- 1 --- */
  await test('Focused world: arrows and WASD issue player commands and the page does NOT scroll', async p => {
    await enterWorld(p);
    assert.equal(await scrollY(p), 0);
    for (const [key, vec] of [['ArrowDown', [0, 1]], ['ArrowUp', [0, -1]], ['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]], ['KeyS', [0, 1]], ['KeyW', [0, -1]], ['KeyA', [-1, 0]], ['KeyD', [1, 0]]] as const) {
      await p.keyboard.down(key);
      await settle(p, 40);
      assert.deepEqual((await lastMove(p))?.vector, vec, `${key} → ${JSON.stringify(vec)}`);
      assert.equal(await scrollY(p), 0, `${key} must not scroll the page`);
      await p.keyboard.up(key);
      assert.deepEqual((await lastMove(p))?.vector, [0, 0], `releasing ${key} stops movement`);
    }
    // A long hold (OS key repeat) still never scrolls.
    await p.keyboard.down('ArrowDown');
    for (let i = 0; i < 12; i++) await p.keyboard.down('ArrowDown');
    await settle(p);
    assert.equal(await scrollY(p), 0, 'a repeating ArrowDown never scrolls under an owned world');
    await p.keyboard.up('ArrowDown');
    // Diagonal and opposing keys.
    await p.keyboard.down('ArrowRight');
    await p.keyboard.down('ArrowDown');
    const [dx, dy] = (await lastMove(p))!.vector!;
    assert.ok(dx > 0.7 && dy > 0.7 && Math.abs(Math.hypot(dx, dy) - 1) < 0.01, 'diagonal is normalised');
    await p.keyboard.down('ArrowLeft');
    assert.deepEqual((await lastMove(p))!.vector, [0, 1], 'opposite keys cancel');
    await p.keyboard.up('ArrowLeft');
    await p.keyboard.up('ArrowRight');
    await p.keyboard.up('ArrowDown');
    assert.equal(await scrollY(p), 0);
  });

  /* ---------------------------------------------------------------- 2 --- */
  await test('Released world: ArrowDown is native browser scrolling and issues no command', async p => {
    await enterWorld(p);
    await p.evaluate(() => (document.activeElement as HTMLElement).blur());
    const before = (await intents(p)).length;
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await settle(p, 300);
    assert.ok((await scrollY(p)) > 0, 'the page scrolls natively when the world does not own the key');
    assert.equal((await intents(p)).length, before, 'no player command was produced');
    // Focus on an ordinary control: arrows are still the browser's.
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator(T('chrome-button')).focus();
    await p.keyboard.press('ArrowDown');
    await settle(p, 300);
    assert.ok((await scrollY(p)) > 0, 'arrows on a focused native button scroll natively');
    assert.equal((await intents(p)).length, before);
    // A player that has left the surface and returned owns the keys again.
    await p.evaluate(() => window.scrollTo(0, 0));
    await enterWorld(p);
    await p.keyboard.press('ArrowDown');
    await settle(p);
    assert.equal(await scrollY(p), 0);
  });

  /* ---------------------------------------------------------------- 3 --- */
  await test('Typing: WASD and arrows in a text field, a contenteditable and a modal field never move the player', async p => {
    await p.locator(T('typing-field')).focus();
    await p.keyboard.type('wasd');
    await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('ArrowLeft');
    await p.keyboard.type('X');
    assert.equal(await p.locator(T('typing-field')).inputValue(), 'waXsd', 'the field received the keys, caret moved by arrows');
    await p.keyboard.press('Enter');
    await p.locator(T('editable')).focus();
    await p.keyboard.type('ws');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('Enter');
    assert.match(await p.locator(T('editable')).innerText(), /ws/, 'contenteditable keeps native keys');
    assert.deepEqual(await intents(p), [], 'no command of any kind was produced while typing');
    // Held movement in the world, then focus a field: the held key is released and typing is untouched.
    await enterWorld(p);
    await p.keyboard.down('ArrowRight');
    assert.deepEqual((await lastMove(p))?.vector, [1, 0]);
    await p.locator(T('typing-field')).focus();
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'focus_left' }, 'leaving the surface clears held movement');
    await p.keyboard.up('ArrowRight');
    const n = (await moves(p)).length;
    await p.keyboard.type('dddd');
    assert.equal((await moves(p)).length, n, 'typing d does not move');
    // The same keys in the world still move (the field did not poison ownership).
    await enterWorld(p);
    await p.keyboard.press('KeyD');
    assert.ok((await moves(p)).length > n);
  });

  /* ---------------------------------------------------------------- 4 --- */
  await test('Enter in the focused world opens the action list (no target) or the contextual target, and never commits', async p => {
    await enterWorld(p);
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('sheet'));
    const s = await state(p);
    assert.equal(s.sheet.kind, 'actions');
    assert.equal(s.decision, undefined, 'Enter never decides');
    assert.ok(await inside(p, 'sheet'), 'focus moved into the sheet once, by the open');
    assert.ok((await intents(p)).some(i => i.type === 'activate' && i.source === 'key'));
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('sheet'), { state: 'detached' });
    assert.equal(await active(p), 'world-surface');

    // With a selected target that has one observation, Enter opens that observation directly.
    await p.locator(T('target-object-lamp')).click();
    assert.equal((await state(p)).selectedTarget.id, 'lamp');
    await enterWorld(p);
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('observation-panel'));
    assert.equal((await state(p)).openObservation, 'o_a1');
    assert.ok(await inside(p, 'observation-panel'));
    assert.ok((await state(p)).receivedFacts.includes('f1'));
    assert.equal((await state(p)).decision, undefined);
  });

  /* ---------------------------------------------------------------- 5 --- */
  await test('Enter on a focused native button activates that button only', async p => {
    await p.locator(T('chrome-button')).focus();
    await p.keyboard.press('Enter');
    await settle(p);
    assert.equal(await p.locator(T('native-clicks')).innerText(), '1', 'the button was activated once');
    assert.deepEqual(await intents(p), [], 'the InputManager did not claim the key');
    assert.equal(await p.locator(T('sheet')).count(), 0, 'no world action opened');
    await p.locator(T('probe-link')).focus();
    await p.keyboard.press('Enter');
    assert.deepEqual(await intents(p), []);
    // A readable-list button is native too: Enter activates exactly it.
    await p.locator(T('readable-observe-o_a1')).focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('observation-panel'));
    assert.equal((await state(p)).openObservation, 'o_a1');
    assert.deepEqual((await intents(p)).filter(i => i.type === 'activate'), []);
  });

  /* ---------------------------------------------------------------- 6 --- */
  await test('Opening a modal stops movement immediately; typing, Tab and focus stay inside it', async p => {
    await enterWorld(p);
    await p.keyboard.down('ArrowRight');
    assert.deepEqual((await lastMove(p))?.vector, [1, 0]);
    assert.equal(await dispatch(p, { type: 'OPEN_MODAL', id: 'settings' }), 'ok');
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'scope_opened' }, 'movement stops in the same tick the modal opens');
    await p.waitForSelector(T('settings-modal'));
    assert.ok(await p.evaluate(() => !!document.querySelector('[data-testid="chrome-button"]')!.closest('[inert]') && !!document.querySelector('[data-testid="world-surface"]')!.closest('[inert]')), 'the page chrome and the world are inert');
    assert.ok(await p.evaluate(() => !document.querySelector('[data-testid="settings-modal"]')!.closest('[inert]') && !document.querySelector('[data-testid="announcer"]')!.closest('[inert]')), 'the dialog and the live region are not');
    assert.ok(await inside(p, 'settings-modal'), 'focus moved into the modal');
    const n = (await moves(p)).length;
    await p.keyboard.down('ArrowRight'); // still physically held, repeating
    await p.keyboard.up('ArrowRight');
    await p.keyboard.type('wasd');
    assert.equal(await p.locator(T('modal-input')).inputValue(), 'wasd', 'a field in the modal types normally');
    assert.equal((await moves(p)).length, n, 'no movement behind a modal');
    for (let i = 0; i < 4; i++) {
      await p.keyboard.press('Tab');
      assert.ok(await inside(p, 'settings-modal'), `Tab ${i + 1} stays inside the modal`);
    }
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press('Shift+Tab');
      assert.ok(await inside(p, 'settings-modal'), 'Shift+Tab stays inside the modal');
    }
    // Pointer cannot reach the inert background either.
    const before = await p.locator(T('native-clicks')).innerText();
    await p.locator(T('chrome-button')).click({ force: true }).catch(() => undefined);
    assert.equal(await p.locator(T('native-clicks')).innerText(), before, 'an inert control is not activated');
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('settings-modal'), { state: 'detached' });
    await p.locator(T('chrome-button')).click();
    assert.equal(await p.locator(T('native-clicks')).innerText(), String(Number(before) + 1), 'and it works again once the modal is closed');
  });

  /* ---------------------------------------------------------------- 7 --- */
  await test('Escape closes the modal / sheet / pending act / selection and restores focus to the invoker', async p => {
    // modal
    await enterWorld(p);
    await dispatch(p, { type: 'OPEN_MODAL', id: 'settings' });
    await p.waitForSelector(T('settings-modal'));
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('settings-modal'), { state: 'detached' });
    assert.equal(await active(p), 'world-surface', 'modal: focus returns to the world surface');
    assert.equal(await p.locator('[inert]').count(), 0, 'inert is lifted');
    // modal opened from a native button restores to that button
    await p.locator(T('chrome-button')).focus();
    await dispatch(p, { type: 'OPEN_MODAL', id: 'settings' });
    await p.waitForSelector(T('settings-modal'));
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('settings-modal'), { state: 'detached' });
    assert.equal(await active(p), 'chrome-button', 'modal: focus returns to the control that was focused');
    // Escape from inside the modal's own text field still closes the dialog
    await dispatch(p, { type: 'OPEN_MODAL', id: 'settings' });
    await p.waitForSelector(T('settings-modal'));
    await p.locator(T('modal-input')).focus();
    await p.keyboard.type('hi');
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('settings-modal'), { state: 'detached' });
    // sheet
    await enterWorld(p);
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('sheet'));
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('sheet'), { state: 'detached' });
    assert.equal(await active(p), 'world-surface', 'sheet: focus returns to the world');
    // selection: the first Escape clears it, the second leaves the scene controls
    await p.locator(T('target-object-lamp')).click();
    await enterWorld(p);
    await p.keyboard.press('Escape');
    assert.equal((await state(p)).selectedTarget, undefined, 'Escape clears the selection first');
    assert.equal(await active(p), 'world-surface');
    await p.keyboard.press('Escape');
    assert.equal(await active(p), 'entry-button', 'Escape with nothing to cancel releases to the visible entry control');
    // pending act: Escape cancels and focus returns to where the sheet was opened
    await reachDecision(p);
    await enterWorld(p);
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('sheet'));
    await p.locator(T('sheet-act-act_speak')).focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('confirm-button'));
    assert.equal((await state(p)).phase, 'confirming');
    assert.equal(await active(p), 'confirm-heading', 'confirmation focuses the exact act, not a button a stray key could press');
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('sheet'), { state: 'detached' });
    assert.equal((await state(p)).phase, 'playing');
    assert.equal((await state(p)).reservation, undefined);
    assert.equal((await state(p)).decision, undefined, 'cancel records nothing');
    assert.equal(await active(p), 'world-surface');
  });

  /* ---------------------------------------------------------------- 8 --- */
  await test('Held keys are cleared on blur, hidden, pointer cancel, ineligibility, focus loss and route change', async p => {
    const hold = async () => {
      await enterWorld(p);
      await p.keyboard.down('ArrowRight');
      assert.deepEqual((await lastMove(p))?.vector, [1, 0]);
    };
    await hold();
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'blur' }, 'window blur');
    await p.keyboard.up('ArrowRight');

    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await hold();
    await p.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));");
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'hidden' }, 'tab hidden');
    await p.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));");
    await p.keyboard.up('ArrowRight');

    await hold();
    await p.evaluate(() => document.querySelector('[data-testid="world-surface"]')!.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 7 })));
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'pointer_cancel' }, 'pointer cancellation');
    await p.keyboard.up('ArrowRight');

    await hold();
    assert.equal(await dispatch(p, { type: 'PAUSE', reason: 'user' }), 'ok');
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'ineligible' }, 'the world stops being interactive');
    await p.keyboard.up('ArrowRight');
    await dispatch(p, { type: 'RESUME', reason: 'user' });

    await hold();
    await p.keyboard.press('Tab');
    assert.deepEqual(await lastMove(p), { type: 'move', vector: [0, 0], reason: 'focus_left' }, 'Tab out of the surface');
    await p.keyboard.up('ArrowRight');

    // Route change: the player unmounts with a key held. Everything goes with it.
    await hold();
    await p.evaluate(() => (document.querySelector('[data-testid="unmount-player"]') as HTMLElement).click());
    await p.waitForSelector(T('player-gone'));
    const last = await lastMove(p);
    assert.deepEqual(last?.vector, [0, 0], 'unmounting releases held movement');
    assert.ok(['disposed', 'surface_removed', 'focus_left'].includes(last!.reason!), `released by ${last?.reason}`);
    const n = (await intents(p)).length;
    await p.keyboard.up('ArrowRight');
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await settle(p, 300);
    assert.ok((await scrollY(p)) > 0, 'after the route changed the page owns the arrows again');
    assert.equal((await intents(p)).length, n, 'no listener survives the route change');
    // And it can come back: a fresh owner works.
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator(T('mount-player')).click();
    await p.waitForFunction(() => document.querySelector('[data-testid="phase"]')?.textContent === 'playing');
    await enterWorld(p);
    await p.keyboard.press('ArrowDown');
    await settle(p);
    assert.equal(await scrollY(p), 0, 'the remounted world owns the arrows again');
  });

  /* ---------------------------------------------------------------- 9 --- */
  await test('Key repeat and double click never confirm twice, and one press never opens AND confirms', async p => {
    await reachDecision(p);
    // (a) A single held Enter from the world: opens the sheet, and no repeat can select or confirm.
    // Arrange the sheet so its FIRST button is a consequential act: the worst case for one gesture doing two things.
    for (const id of ['prep_stand', 'prep_hold_note', 'prep_put_back_note']) assert.equal(await dispatch(p, { type: 'APPLY_PREPARATION', id, activationId: sid() }), 'ok');
    await enterWorld(p);
    await p.keyboard.down('Enter');
    for (let i = 0; i < 8; i++) await p.keyboard.down('Enter');
    await settle(p);
    await p.keyboard.up('Enter');
    await settle(p);
    let s = await state(p);
    assert.equal(s.decision, undefined, 'a held Enter never commits');
    assert.notEqual(s.phase, 'confirming', 'nor even reaches the confirmation');
    assert.equal(s.sheet?.kind, 'actions', 'it only opened the list');
    assert.equal(await active(p), 'sheet-act-act_speak', 'the held key landed on a consequential act and did nothing to it');
    assert.ok((await events(p)).filter(e => e.type === 'REQUEST_INTENT' || e.type === 'CONFIRM').every(e => e.rejected), 'every repeat that reached the controller was refused');
    assert.deepEqual(await decisions(p), []);

    // (b) A second, distinct press selects; a held repeat of it cannot confirm.
    await p.locator(T('sheet-act-act_speak')).focus();
    await p.keyboard.down('Enter');
    for (let i = 0; i < 8; i++) await p.keyboard.down('Enter');
    await settle(p);
    await p.keyboard.up('Enter');
    await settle(p);
    s = await state(p);
    assert.equal(s.phase, 'confirming', 'a separate press selected the act');
    assert.equal(s.decision, undefined, 'its repeats did not confirm it');
    assert.deepEqual(await decisions(p), []);

    // (c) Holding Enter on the focused Confirm button: exactly one decision.
    await p.locator(T('confirm-button')).focus();
    await p.keyboard.down('Enter');
    for (let i = 0; i < 10; i++) await p.keyboard.down('Enter');
    await settle(p, 300);
    await p.keyboard.up('Enter');
    await settle(p);
    assert.equal((await decisions(p)).length, 1, 'one persisted decision');
    assert.deepEqual(await decisions(p), [{ decision: 'd_main', option: 'act_speak' }]);
    assert.equal((await state(p)).decision.option, 'act_speak');
    assert.equal((await events(p)).filter(e => e.type === 'CONFIRM' && !e.rejected).length, 1, 'one accepted CONFIRM');
  });

  await test('A burst of clicks from one press, and a mouse double-click, confirm once', async p => {
    await reachDecision(p);
    assert.equal(await dispatch(p, { type: 'REQUEST_INTENT', id: 'act_wait', activationId: sid() }), 'ok');
    await p.waitForSelector(T('confirm-button'));
    // Five click events delivered in one tick, as a held Enter on a button produces.
    await p.evaluate(() => {
      const b = document.querySelector('[data-testid="confirm-button"]') as HTMLButtonElement;
      for (let i = 0; i < 5; i++) b.click();
    });
    await settle(p);
    assert.equal((await decisions(p)).length, 1);
    assert.equal((await state(p)).decision.option, 'act_wait');
    assert.ok((await events(p)).filter(e => e.type === 'CONFIRM').slice(1).every(e => e.rejected), 'the other four were refused');

    // Mouse double-click on Confirm.
    const q = await open();
    try {
      await reachDecision(q.page);
      await dispatch(q.page, { type: 'REQUEST_INTENT', id: 'act_ask', activationId: sid() });
      await q.page.waitForSelector(T('confirm-button'));
      await q.page.locator(T('confirm-button')).dblclick();
      await settle(q.page);
      assert.equal((await decisions(q.page)).length, 1, 'a double-click is one decision');
      assert.equal((await state(q.page)).decision.option, 'act_ask');
    } finally {
      await q.page.context().close();
    }
  });

  /* --------------------------------------------------------- 10b --- */
  await test('Assistive-technology (synthetic, detail 0) activations: act then confirm both succeed with distinct ids; virtual Enter with an empty code is an Enter', async p => {
    await reachDecision(p);
    // A screen reader / switch / programmatic click is a click with detail 0 and NO key press. Two of them in a row must both count.
    await p.evaluate(() => (document.querySelector('[data-testid="readable-act-act_speak"]') as HTMLButtonElement).click());
    await p.waitForSelector(T('confirm-button'));
    assert.equal((await state(p)).phase, 'confirming', 'synthetic action 1 (choose the act) succeeded');
    await p.evaluate(() => (document.querySelector('[data-testid="confirm-button"]') as HTMLButtonElement).click());
    await settle(p);
    assert.equal((await state(p)).decision?.option, 'act_speak', 'synthetic action 2 (confirm) succeeded');
    assert.equal((await decisions(p)).length, 1);
    const ev = await events(p);
    assert.ok(!ev.some(e => e.type === 'CONFIRM' && e.rejected === 'duplicate_activation'), 'the two synthetic actions had different activation ids');
  });

  await test('Virtual keyboard Enter (key "Enter", empty code) in the focused world is an activation', async p => {
    await enterWorld(p);
    await p.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      for (const type of ['keydown', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: '', bubbles: true, cancelable: true, composed: true }));
    });
    const acts = (await intents(p)).filter(i => i.type === 'activate' && i.source === 'key');
    assert.equal(acts.length, 1, 'the virtual Enter reached the controls');
    assert.match(acts[0].activationId!, /^k[1-9]/, 'and carries a real press id, not k0');
    assert.equal((await state(p)).sheet?.kind, 'actions', 'it opened the action list like a physical Enter');
    // physical-layout movement semantics are untouched: a letter key with no code does not walk the player
    await p.evaluate(() => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: '', bubbles: true, cancelable: true })));
    assert.equal((await moves(p)).length, 0, 'KeyW semantics stay physical: key "w" without a code does not move');
  });

  /* --------------------------------------------------------- 10c --- */
  // KNOWN GAP (QA BUG-04, deferred to Integration Review): a rejected persistDecision is swallowed by useExperience.
  // This test pins the CURRENT behaviour so it is visible and cannot change silently; it is not an endorsement.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    try {
      await page.goto(`${base}/?v3=foundation&persist=reject`);
      await page.waitForFunction(() => document.querySelector('[data-testid="phase"]')?.textContent === 'playing');
      await reachDecision(page);
      await page.evaluate(() => (document.querySelector('[data-testid="readable-act-act_speak"]') as HTMLButtonElement).click());
      await page.waitForSelector(T('confirm-button'));
      await page.evaluate(() => (document.querySelector('[data-testid="confirm-button"]') as HTMLButtonElement).click());
      await settle(page, 300);
      const s = await state(page);
      assert.equal(s.decision.status, 'accepted', 'a failed write leaves the decision unrecorded (never "recorded")');
      assert.equal((await decisions(page)).length, 1, 'the write was attempted exactly once: nothing retries it');
      assert.equal((await events(page)).filter(e => e.type === 'DECISION_RECORDED').length, 0, 'no DECISION_RECORDED and no failure event is ever dispatched');
      assert.deepEqual(errors, [], 'the rejection is swallowed silently (no page error, no diagnostic)');
      results.push(['KNOWN GAP BUG-04: a rejected persistDecision is swallowed (decision stays accepted, unrecorded, no retry, no error surface)', null]);
      console.log(`✓ ${results.length}. KNOWN GAP BUG-04: a rejected persistDecision is swallowed (pinned, deferred to Integration Review)`);
    } catch (e) {
      results.push(['BUG-04 repro', String((e as Error).stack ?? e)]);
      console.log(`✗ ${results.length}. BUG-04 repro\n   ${String((e as Error).message).split('\n').join('\n   ')}`);
    } finally {
      await ctx.close();
    }
  }

  /* --------------------------------------------------------------- 10 --- */
  await test('Tab leaves the scene controls normally; the world never traps focus', async p => {
    await enterWorld(p);
    const n = (await intents(p)).length;
    await p.keyboard.press('Tab');
    const next = await active(p);
    assert.notEqual(next, 'world-surface', 'Tab moved on');
    assert.ok(next.startsWith('target-') || next === 'BUTTON', `next real control (${next})`);
    await p.keyboard.press('Shift+Tab');
    assert.equal(await active(p), 'world-surface', 'and Shift+Tab comes back');
    await p.keyboard.press('Shift+Tab');
    assert.equal(await active(p), 'entry-button', 'the entry button precedes the surface');
    // Tab all the way through the page and out: never stuck on the world.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press('Tab');
      seen.add(await active(p));
    }
    assert.ok(seen.size > 8, 'the whole page is reachable by Tab');
    assert.deepEqual((await intents(p)).slice(n).filter(i => i.type === 'move' && i.reason === 'input'), [], 'Tab never moves the player');
    assert.equal(await scrollY(p) >= 0, true);
  });

  /* --------------------------------------------------------------- 11 --- */
  await test('Leaving a scene and returning keeps what the player knows; focus lands back on the world', async p => {
    // Look at the lamp with the keyboard path, then travel A → B → A → B using the sheet.
    await p.locator(T('target-object-lamp')).click();
    await enterWorld(p);
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('observation-panel'));
    await p.keyboard.press('Escape');
    await p.waitForSelector(T('observation-panel'), { state: 'detached' });
    assert.equal(await active(p), 'world-surface', 'closing an observation restores sensible focus');
    await p.locator(T('readable-prepare-prep_hold_note')).click();
    assert.deepEqual((await state(p)).entities.find((e: any) => e.id === 'note').owner, { kind: 'actor', id: 'hero' });

    const travelBySheet = async (portal: string, to: string) => {
      await enterWorld(p);
      await p.keyboard.press('Enter');
      await p.waitForSelector(T('sheet'));
      await p.locator(T(`sheet-travel-${portal}`)).focus();
      await p.keyboard.press('Enter');
      await p.waitForFunction(scene => document.querySelector('[data-testid="scene-id"]')?.textContent === scene && document.querySelector('[data-testid="phase"]')?.textContent === 'playing', to);
      assert.equal(await active(p), 'world-surface', `after arriving in ${to} the world owns focus again`);
    };
    await travelBySheet('p_a_to_b', 'scene_b');
    assert.equal(await scrollY(p), 0);
    await p.keyboard.down('ArrowDown');
    await settle(p);
    assert.deepEqual((await lastMove(p))?.vector, [0, 1], 'the new scene accepts movement at once');
    await p.keyboard.up('ArrowDown');
    await p.locator(T('readable-advance')).click();
    await travelBySheet('p_b_peek_a', 'scene_a');

    const s = await state(p);
    assert.equal(s.scene, 'scene_a');
    assert.equal(s.arcIndex, 1, 'the excursion did not move the arc');
    assert.deepEqual(s.seenObservations, ['o_a1']);
    assert.ok(s.receivedFacts.includes('f1') && s.receivedFacts.includes('f2'));
    assert.deepEqual(s.entities.find((e: any) => e.id === 'note').owner, { kind: 'actor', id: 'hero' }, 'what was picked up is still carried');
    assert.deepEqual(s.entities.find((e: any) => e.id === 'other').owner, { kind: 'location', id: 'room_b' }, 'the other person did not move or reset');
    assert.deepEqual(s.visitedScenes, ['scene_a', 'scene_b']);
    assert.match(await p.locator(T('facts')).innerText(), /lamp is on/i);
    assert.match(await p.locator(T('readable-observe-o_a1')).innerText(), /seen/);
    await travelBySheet('p_a_back_b', 'scene_b');
    assert.equal((await state(p)).scene, 'scene_b');
  });

  /* ------------------------------------------------- readable-only path --- */
  await test('The whole decision is reachable with Tab and Enter on native controls alone, and reveal focuses its heading once', async p => {
    const press = async (testId: string) => {
      await p.locator(T(testId)).focus();
      await p.keyboard.press('Enter');
      await settle(p, 60);
    };
    await press('readable-observe-o_a1');
    await p.keyboard.press('Escape');
    await press('readable-travel-p_a_to_b');
    await p.waitForFunction(() => document.querySelector('[data-testid="scene-id"]')?.textContent === 'scene_b');
    await press('readable-advance');
    await press('readable-advance');
    await press('readable-travel-p_b_to_c');
    await p.waitForFunction(() => document.querySelector('[data-testid="scene-id"]')?.textContent === 'scene_c');
    await press('readable-advance');
    await press('readable-act-act_ask');
    await p.waitForSelector(T('confirm-button'));
    await p.locator(T('confirm-button')).focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector(T('reveal-heading'));
    await settle(p, 200);
    assert.equal(await active(p), 'reveal-heading', 'the reveal heading takes focus');
    assert.equal((await state(p)).decision.option, 'act_ask');
    assert.equal((await state(p)).phase, 'revealed');
    // Typing/Tab afterwards does not steal focus back to the heading (once only).
    await p.locator(T('typing-field')).focus();
    await p.keyboard.type('abc');
    await settle(p, 100);
    assert.equal(await active(p), 'typing-field');
    // The accepted act is frozen: the world accepts no more.
    assert.equal(await dispatch(p, { type: 'REQUEST_PORTAL', id: 'p_b_peek_a', activationId: sid() }), 'locked');
    // The author's record never appears in the DOM before or alongside the boundary text.
    const html = await p.content();
    assert.ok(!/CANARY-(ACT|WHY|AFTER)/.test(html), 'reveal-only text is not in the page');
  });

  /* ------------------------------------------------------- pointer ------ */
  await test('Pointer: a tap on the stage enters the controls and reports one activation; a drag is not a tap and nothing moves on pointer-down', async p => {
    const box = (await p.locator(T('world-surface')).boundingBox())!;
    // press and drag: no activation, no movement, at any point of the gesture
    await p.mouse.move(box.x + 30, box.y + 30);
    await p.mouse.down();
    assert.deepEqual(await intents(p), [], 'pointer-down alone does nothing');
    await p.mouse.move(box.x + 120, box.y + 80, { steps: 6 });
    await p.mouse.up();
    assert.deepEqual((await intents(p)).filter(i => i.type === 'activate'), [], 'a drag is not a tap');
    assert.deepEqual(await moves(p), [], 'and never walks the player');
    // a tap: focuses the surface (no scroll) and reports a semantic, normalised point
    await p.mouse.move(box.x + 40, box.y + 20);
    await p.mouse.down();
    await p.mouse.up();
    const taps = (await intents(p)).filter(i => i.type === 'activate');
    assert.equal(taps.length, 1);
    assert.equal(taps[0].source, 'pointer');
    assert.ok(taps[0].activationId!.startsWith('p'));
    assert.equal(await active(p), 'world-surface');
    assert.equal(await scrollY(p), 0, 'entering by pointer never scrolls');
    assert.equal((await state(p)).decision, undefined, 'a tap decides nothing');
  });

  await test('Touch: a tap enters the controls; a scroll gesture starting on the stage scrolls the page and is not a tap or a walk', async p => {
    const box = (await p.locator(T('world-surface')).boundingBox())!;
    await p.touchscreen.tap(box.x + 30, box.y + 20);
    assert.equal(await active(p), 'world-surface', 'tap focuses the surface');
    assert.equal((await intents(p)).filter(i => i.type === 'activate').length, 1);
    await p.evaluate(() => (document.activeElement as HTMLElement).blur());
    const n = (await intents(p)).length;
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + 40), y: Math.round(box.y + 40), yDistance: -400, gestureSourceType: 'touch', speed: 1200 });
    await settle(p, 300);
    assert.ok((await scrollY(p)) > 50, 'native vertical scrolling still works from the stage');
    assert.equal((await intents(p)).slice(n).filter(i => i.type === 'activate').length, 0, 'a scroll is not a tap');
    assert.deepEqual((await moves(p)).filter(m => m.reason === 'input'), [], 'a scroll is not a walk');
  }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* --------------------------------------------------------------- 12 --- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => m.type() === 'error' && !/favicon|WebSocket|HMR|Failed to load resource/i.test(m.text()) && errors.push(m.text()));
    try {
      await page.goto(`${base}/`);
      await page.waitForSelector('text=STORIES YOU CAN ENTER');
      assert.ok((await page.locator('button').count()) > 3, 'the feed renders');
      assert.equal(await page.locator('[data-v3-world-surface]').count(), 0, 'no V3 owner outside V3');
      // An editorial V2 experience plays through the unchanged V2 player (its own stage, its own keyboard model).
      await page.goto(`${base}/?play=v2-apartment-ru`);
      await page.waitForSelector('.vivi-play .vivi-stage', { timeout: 20000 });
      assert.equal(await page.locator('[data-v3-world-surface]').count(), 0, 'V2 does not mount the V3 owner');
      await page.locator('button', { hasText: 'Дальше' }).first().click();
      await page.waitForFunction(() => document.querySelectorAll('.vivi-play button').length > 4, undefined, { timeout: 20000 });
      const figure = page.locator('.vivi-figure.is-player').first();
      const before = await figure.boundingBox();
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(700);
      await page.keyboard.up('ArrowRight');
      const after = await figure.boundingBox();
      assert.ok(before && after && (Math.abs(after.x - before.x) > 2 || Math.abs(after.y - before.y) > 2), 'V2 still walks its hero with the arrow keys');
      await page.keyboard.press('Tab');
      assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY', 'V2 controls are reachable by Tab');
      // A legacy hero story from the seed archive still opens through the loader.
      await page.goto(`${base}/`);
      await page.waitForSelector('text=STORIES YOU CAN ENTER');
      const enter = page.locator('button', { hasText: /enter|войти|play|играть/i }).first();
      if (await enter.count()) {
        await enter.click();
        await page.waitForTimeout(800);
      }
      assert.deepEqual(errors, [], 'no page errors on V1/V2 routes');
      results.push(['V1/V2 routes remain functional (feed, V2 editorial play, legacy entry) with no V3 owner mounted', null]);
      console.log(`✓ ${results.length}. V1/V2 routes remain functional (feed, V2 editorial play, legacy entry) with no V3 owner mounted`);
    } catch (e) {
      results.push(['V1/V2 routes', String((e as Error).stack ?? e)]);
      console.log(`✗ ${results.length}. V1/V2 routes\n   ${String((e as Error).message).split('\n').join('\n   ')}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  await server.close();
  const failed = results.filter(([, err]) => err);
  console.log(failed.length ? `\n${failed.length} of ${results.length} browser checks FAILED.` : `\nAll ${results.length} V3 browser checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(async e => {
  console.error(e);
  await browser?.close().catch(() => undefined);
  await server?.close().catch(() => undefined);
  process.exit(1);
});
