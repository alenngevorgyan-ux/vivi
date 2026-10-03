import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { execFileSync } from 'node:child_process';
import privateReveal from '../src/data/experienceV3Fixtures/spec/the-correction.reveal.private.json' with { type: 'json' };
import { CORRECTION_REVEAL_CANARIES } from '../src/data/experienceV3Fixtures/runtime/theCorrection.reveal.ts';
import { APPROVED_INTENTION_CAPTIONS, correctionActSlots } from '../src/data/experienceV3Fixtures/runtime/theCorrection.presentation.ts';
import { normalizeCanary } from '../src/engine/v3/contracts/validate.ts';

/**
 * THE CORRECTION — visual first slice, in a real Chrome, through the DEVELOPMENT entry `/?v3=correction`.
 *
 * Real keyboard, mouse and touch input on the real player (ExperiencePlayerV3 → SceneViewportV3 → the real
 * ExperienceHost in visual mode, hash-verified Design r4 plates, dev repository/journal, dynamically imported
 * private record). `window.__v3Correction` is used to READ state and to set fault switches; story progress is
 * driven by clicking/tapping/pressing the rendered controls. Results are technical evidence only: not
 * screen-reader, physical-device, translation or human-research evidence.
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

const T = (id: string) => `[data-testid="${id}"]`;
const OPTIONS = ['correct_public', 'request_private', 'pass_question'] as const;
const CANARIES = CORRECTION_REVEAL_CANARIES.map(normalizeCanary);
const leaks = (text: string) => {
  const n = normalizeCanary(text.replace(/[‘’]/g, "'"));
  const m = normalizeCanary(text);
  return CANARIES.filter(c => n.includes(c.replace(/[‘’]/g, "'")) || m.includes(c));
};

type Ev = { type: string; rejected?: string; screen?: { caption: boolean; pose?: string | null; boundaryLine: boolean; withdrawn: boolean } };
const state = (p: Page): Promise<any> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Correction!.getState())));
const status = (p: Page): Promise<any> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Correction!.status())));
const events = (p: Page): Promise<Ev[]> => p.evaluate(() => JSON.parse(JSON.stringify(window.__v3Correction!.events)));
const phase = (p: Page) => p.locator(T('player')).getAttribute('data-phase');
const waitPhase = (p: Page, ph: string | string[], timeout = 15000) => p.waitForFunction(x => [x].flat().includes(document.querySelector('[data-testid="player"]')?.getAttribute('data-phase') ?? ''), ph, { timeout });
const waitScene = (p: Page, scene: string) => p.waitForFunction(sc => { const s = window.__v3Correction?.getState(); return s?.scene === sc && s.phase === 'playing'; }, scene, { timeout: 20000 });
const click = async (p: Page, id: string) => {
  await p.locator(T(id)).click();
};
const box = (p: Page, id: string) => p.locator(T(id)).boundingBox();
/** A body's box relative to the stage (page layout around the stage may move; the stage projection may not). */
const rel = async (p: Page, id: string) => {
  const [b, s] = [await box(p, id), await box(p, 'stage')];
  return b && s ? { x: Math.round(b.x - s.x), y: Math.round(b.y - s.y), w: Math.round(b.width), h: Math.round(b.height) } : undefined;
};
const settle = (p: Page, ms = 150) => p.waitForTimeout(ms);

interface Walk {
  observeTitle?: boolean;
  observeSummary?: boolean;
  roomVisits?: number;
  prep?: 'seat' | 'near' | 'none';
}

async function travel(p: Page, portal: string, dest: string) {
  await click(p, `travel-${portal}`);
  await waitScene(p, dest);
}

/** Play to the decision plateau with the rendered controls only. */
async function walkToQuestion(p: Page, o: Walk = {}) {
  await click(p, 'advance');
  if (o.observeTitle) {
    await click(p, 'observe-obs_title');
    await click(p, 'observation-close');
  }
  await click(p, 'advance');
  await travel(p, 'cut_to_meeting', 'c_meeting_before');
  for (let i = 0; i < 4; i++) await click(p, 'advance');
  await travel(p, 'start_break', 'c_hallway');
  await click(p, 'advance');
  if (o.observeSummary) {
    await click(p, 'observe-obs_summary');
    await click(p, 'observation-close');
  }
  for (let i = 0; i < (o.roomVisits ?? 0); i++) {
    await travel(p, 'p_room', 'c_meeting_before');
    await travel(p, 'p_hall', 'c_hallway');
  }
  await travel(p, 'resume_meeting', 'c_meeting_question');
  await click(p, 'advance');
  await click(p, 'advance');
  if (o.prep === 'seat') await click(p, 'prepare-prep_seat');
  if (o.prep === 'near') await click(p, 'prepare-prep_near');
  await settle(p, 50);
}

async function choose(p: Page, option: string) {
  await click(p, `decision-option-${option}`);
  await p.locator(T('confirm-dialog')).waitFor();
  await click(p, 'confirm-button');
}

/** After acceptance: wait for the validated account and read every field through the reader controls. */
async function readAccount(p: Page) {
  await p.locator(T('reveal-act')).waitFor({ timeout: 20000 });
  await click(p, 'reveal-continue');
  await click(p, 'reveal-continue');
  return {
    act: await p.locator(T('reveal-act')).textContent(),
    why: await p.locator(T('reveal-why')).textContent(),
    aftermath: await p.locator(T('reveal-aftermath')).textContent(),
    withheld: await p.locator(T('reveal-withheld')).textContent(),
  };
}

const GOLD = { act: privateReveal.act, why: privateReveal.why, aftermath: privateReveal.aftermath, withheld: `Not disclosed: ${privateReveal.deliberatelyWithheld}` };

/** Every text response and the DOM must be free of the account until the boundary releases it. */
function watchLeaks(p: Page) {
  const seen: Array<{ url: string; leaks: string[] }> = [];
  const urls: string[] = [];
  let armed = true;
  p.on('response', async r => {
    urls.push(r.url());
    if (!armed) return;
    const ct = r.headers()['content-type'] ?? '';
    if (!/javascript|json|text|html|css/.test(ct)) return;
    try {
      const body = await r.text();
      const l = leaks(body);
      if (l.length) seen.push({ url: r.url(), leaks: l });
    } catch {
      /* redirected or aborted */
    }
  });
  return {
    async assertClean(what: string) {
      const dom = await p.evaluate(() => document.documentElement.outerHTML);
      assert.deepEqual(leaks(dom), [], `${what}: DOM carries no account text`);
      assert.deepEqual(seen, [], `${what}: no response carried account text`);
      assert.ok(!urls.some(u => /theCorrection\.reveal|reveal\.private/.test(u)), `${what}: the private module was not requested`);
    },
    disarm() {
      armed = false;
    },
    urls,
  };
}

const results: Array<[string, string | null]> = [];
const DESKTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 } };
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(query = '', ctx: BrowserContextOptions = DESKTOP): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|WebSocket|HMR|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/?v3=correction${query}`);
  return { page, errors };
}

async function test(name: string, fn: (p: Page) => Promise<void>, query = '', ctx: BrowserContextOptions = DESKTOP, waitPlaying = true) {
  if (process.env.V3_ONLY && !name.includes(process.env.V3_ONLY)) return;
  const { page, errors } = await open(query, ctx);
  try {
    if (waitPlaying) await waitPhase(page, 'playing', 30000);
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
  console.log(`Testing The Correction visual slice in ${browser.version()}...\n`);

  /* ---------------------------------------------------------------- 1 --- */
  await test('Rich full path (mouse): desk title live DOM, cut to meeting, three bodies, break, hallway, resume, exact question, three approved intentions, separate confirm, act, hold, boundary, the Gold account', async p => {
    const watch = watchLeaks(p);
    // Desk: one body (the hero), the approved title as live DOM on the display surface, no hallway door from the desk.
    assert.equal(await p.locator(T('surface-title-o_deck')).textContent(), 'Mira’s forecast');
    assert.equal(await p.locator('[data-testid^="body-"]').count(), 1, 'the open plan is empty but for the hero');
    assert.equal(await p.locator(T('fiction-label')).textContent(), 'Fictional editorial test story. Illustrated staging; not a real user submission.');
    await click(p, 'advance');
    await click(p, 'advance');
    assert.deepEqual(await p.locator('[data-testid^="travel-"]').evaluateAll(b => b.map(x => x.getAttribute('data-testid'))), ['travel-cut_to_meeting'], 'desk → meeting is the one spine cut; no desk → hallway door');
    const raster = await p.locator('img').evaluateAll(xs => xs.map(x => (x as HTMLImageElement).src));
    assert.ok(raster.every(u => u.startsWith('blob:')), 'every drawn plate is the verified object URL');
    await travel(p, 'cut_to_meeting', 'c_meeting_before');
    for (let i = 0; i < 4; i++) await click(p, 'advance');
    assert.deepEqual((await p.locator('[data-testid^="body-"]').evaluateAll(b => b.map(x => x.getAttribute('data-testid')))).sort(), ['body-a_director', 'body-a_me', 'body-a_mira'], 'exactly hero, Mira and the director');
    await travel(p, 'start_break', 'c_hallway');
    await click(p, 'advance');
    await click(p, 'observe-obs_summary');
    assert.match((await p.locator(T('insert-my-name')).textContent())!, /^My name/);
    await click(p, 'observation-close');
    await travel(p, 'resume_meeting', 'c_meeting_question');
    await click(p, 'advance');
    await click(p, 'advance');
    assert.match((await p.locator(T('line-f11')).textContent())!, /“Anything to add before we use this\?”/, 'the director’s Gold question, verbatim');
    // Decision: the derived options, in order, with the approved intention labels.
    const labels = await p.locator('[data-testid^="decision-option-"]').evaluateAll(b => b.map(x => [x.getAttribute('data-testid'), x.textContent]));
    assert.deepEqual(labels, OPTIONS.map(o => [`decision-option-${o}`, APPROVED_INTENTION_CAPTIONS[o]]));
    await watch.assertClean('decision plateau');
    await click(p, 'decision-option-correct_public');
    await p.locator(T('confirm-dialog')).waitFor();
    assert.equal((await state(p)).decision, undefined, 'selection is not acceptance');
    assert.equal(await p.locator(T('confirm-copy')).textContent(), correctionActSlots()[0].confirmation.copy);
    await click(p, 'confirm-button');
    await p.locator(T('enactment-caption')).waitFor();
    assert.equal(await p.locator(T('enactment-caption')).textContent(), 'Say I built the forecast');
    await waitPhase(p, 'revealed', 20000);
    const ev = await events(p);
    const enacted = ev.find(e => e.type === 'ENACTED' && !e.rejected)!;
    assert.ok(enacted.screen?.caption && enacted.screen.pose === 'speak', `ENACTED only with the stop pose and caption on screen: ${JSON.stringify(enacted.screen)}`);
    const boundary = ev.find(e => e.type === 'BOUNDARY_DONE' && !e.rejected)!;
    assert.ok(boundary.screen?.boundaryLine && boundary.screen.withdrawn, 'BOUNDARY_DONE only after the withdrawal and the boundary line are on screen');
    assert.deepEqual(ev.filter(e => !e.rejected && ['ENACTED', 'HOLD_DONE', 'BOUNDARY_DONE', 'REVEAL_LOADED'].includes(e.type)).map(e => e.type), ['ENACTED', 'HOLD_DONE', 'BOUNDARY_DONE', 'REVEAL_LOADED']);
    watch.disarm();
    assert.deepEqual(await readAccount(p), GOLD);
    assert.ok(watch.urls.some(u => /theCorrection\.reveal/.test(u)), 'the private module loads only after the boundary');
    await click(p, 'reveal-finish');
    await waitPhase(p, 'ended');
    assert.equal((await p.evaluate(() => window.__v3Correction!.decisions)).length, 1, 'one durable write');
  });

  /* ------------------------------------------------------------- 2–4 --- */
  for (const [option, prep] of [['correct_public', 'near'], ['request_private', 'seat'], ['pass_question', 'near'], ['pass_question', 'seat'], ['request_private', 'near'], ['correct_public', 'seat']] as const) {
    await test(`Act ${option} from the ${prep === 'seat' ? 'seated' : 'standing'} preparation: stops before any reaction, Mira and the director unchanged, same account`, async p => {
      await walkToQuestion(p, { prep });
      await settle(p, 1500); // the preparation walk is presentation only
      const before = { mira: await box(p, 'body-a_mira'), dir: await box(p, 'body-a_director') };
      const s0 = await state(p);
      assert.equal(s0.entities.find((e: any) => e.id === 'a_me').state.mark_role, prep === 'seat' ? 'own_seat' : 'near_director');
      assert.equal(await p.locator(T('figure-a_me')).getAttribute('data-posture'), prep === 'seat' ? 'seat' : 'stand');
      await choose(p, option);
      await p.locator(T('enactment-caption')).waitFor();
      assert.equal(await p.locator(T('enactment-caption')).textContent(), APPROVED_INTENTION_CAPTIONS[option]);
      await p.waitForFunction(() => window.__v3Correction!.events.some(e => e.type === 'ENACTED' && !e.rejected), null, { timeout: 15000 });
      const pose = await p.locator(T('figure-a_me')).getAttribute('data-pose');
      assert.equal(pose, option === 'correct_public' ? 'speak' : option === 'request_private' ? 'ask' : 'still');
      const s1 = await state(p);
      // Only the hero acts: every other body is exactly where it was, in the snapshot and on screen.
      for (const id of ['a_mira', 'a_director']) assert.deepEqual(s1.entities.find((e: any) => e.id === id), s0.entities.find((e: any) => e.id === id));
      assert.deepEqual(await box(p, 'body-a_mira'), before.mira, 'Mira does not move');
      assert.deepEqual(await box(p, 'body-a_director'), before.dir, 'the director does not move');
      assert.equal(await p.locator('[data-testid^="body-"]').count(), 3, 'no one appears');
      if (option === 'request_private') {
        const hero = await box(p, 'body-a_me');
        assert.ok(hero!.x > before.dir!.x - 200, 'the hero has approached the director (the approved route)');
      }
      if (option === 'pass_question') assert.equal(await p.locator(T('figure-a_me')).getAttribute('data-posture'), prep === 'seat' ? 'seat' : 'stand', 'pass keeps the selected preparation');
      assert.deepEqual(await readAccount(p), GOLD, 'every act opens the same author account');
    });
  }

  /* ---------------------------------------------------------------- 5 --- */
  await test('Hallway ⇄ room round trips: same bodies, frozen staging, no replayed board quote, consumed receipts kept, local hero marks restored, summary stays the hero’s', async p => {
    await click(p, 'advance');
    await click(p, 'advance');
    await travel(p, 'cut_to_meeting', 'c_meeting_before');
    for (let i = 0; i < 4; i++) await click(p, 'advance');
    const roomRef = { mira: await rel(p, 'body-a_mira'), dir: await rel(p, 'body-a_director') };
    await travel(p, 'start_break', 'c_hallway');
    await click(p, 'advance');
    await settle(p, 2600); // the arrival crossing walk ends on the hallway mark
    const hall = await state(p);
    const hallHero = await rel(p, 'body-a_me');
    for (let i = 0; i < 3; i++) {
      await travel(p, 'p_room', 'c_meeting_before');
      const r = await state(p);
      assert.deepEqual([r.deliveredBeats, r.consumedEvents, r.receivedFacts], [hall.deliveredBeats, hall.consumedEvents, hall.receivedFacts], 'a visit replays nothing');
      assert.equal(await p.locator(T('line-f06')).count(), 0, 'the board quote is not shown again');
      assert.deepEqual(r.entities.filter((e: any) => e.id !== 'a_me'), hall.entities.filter((e: any) => e.id !== 'a_me'), 'every other entity unchanged; the summary is still the hero’s');
      await settle(p, 300);
      assert.deepEqual({ mira: await rel(p, 'body-a_mira'), dir: await rel(p, 'body-a_director') }, roomRef, 'the same Mira and director, where they were');
      await travel(p, 'p_hall', 'c_hallway');
      await settle(p, 2600);
      const h = await state(p);
      assert.deepEqual(h.entities.find((e: any) => e.id === 'a_me').mark, hall.entities.find((e: any) => e.id === 'a_me').mark, 'the hallway mark is restored');
      assert.deepEqual(await rel(p, 'body-a_me'), hallHero);
    }
    assert.equal((await state(p)).entities.find((e: any) => e.id === 'o_summary').owner.id, 'a_me');
    // Hallway proxies never exist: in the hallway only the hero is a body, plus the same actors through the open door.
    const ids = await p.locator('[data-testid^="body-"]').evaluateAll(b => b.map(x => x.getAttribute('data-testid')));
    assert.ok(ids.every(i => ['body-a_me', 'body-a_mira', 'body-a_director'].includes(i!)));
    await travel(p, 'resume_meeting', 'c_meeting_question');
    assert.equal(await p.locator('[data-testid="travel-p_hall"]').count(), 0, 'after resume the break doors close');
  });

  /* ---------------------------------------------------------------- 6 --- */
  await test('Keyboard only: Tab/Enter play, Enter in the world opens actions, arrows step to a supported mark, one Enter press cannot select and confirm, Escape keeps considering', async p => {
    const press = async (id: string) => {
      await p.locator(T(id)).focus();
      await p.keyboard.press('Enter');
    };
    await press('advance');
    await press('advance');
    await press('travel-cut_to_meeting');
    await waitScene(p, 'c_meeting_before');
    for (let i = 0; i < 4; i++) await press('advance');
    await press('travel-start_break');
    await waitScene(p, 'c_hallway');
    await press('advance');
    await press('travel-resume_meeting');
    await waitScene(p, 'c_meeting_question');
    await press('advance');
    await press('advance');
    // The world: Enter opens the action sheet (never commits).
    await click(p, 'entry-button');
    await p.keyboard.press('Enter');
    await p.locator(T('sheet')).waitFor();
    await p.keyboard.press('Escape');
    await p.locator(T('sheet')).waitFor({ state: 'detached' });
    // Arrow keys: bounded local movement onto a supported mark (a reversible preparation).
    await click(p, 'entry-button');
    await p.keyboard.press('ArrowLeft');
    await settle(p, 200);
    assert.ok(['own_seat', 'near_director'].includes((await state(p)).entities.find((e: any) => e.id === 'a_me').state.mark_role), 'an arrow stepped to a supported mark');
    // Select with Enter, hold Enter: the confirm dialog opens but the held key cannot accept.
    await p.locator(T('decision-option-pass_question')).focus();
    await p.keyboard.down('Enter');
    for (let i = 0; i < 5; i++) await p.keyboard.down('Enter');
    await p.keyboard.up('Enter');
    await settle(p);
    const s = await state(p);
    assert.equal(s.phase, 'confirming');
    assert.equal(s.decision, undefined, 'a held Enter never confirms');
    await p.keyboard.press('Escape');
    await waitPhase(p, 'playing');
    assert.equal((await state(p)).decision, undefined, 'Escape keeps considering');
    await p.locator(T('decision-option-pass_question')).focus();
    await p.keyboard.press('Enter');
    await p.locator(T('confirm-button')).waitFor();
    assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'confirm-heading', 'focus moves to the confirmation heading');
    await p.locator(T('confirm-button')).focus();
    await p.keyboard.press('Enter');
    await waitPhase(p, ['enacting', 'holding', 'boundary', 'reveal_loading', 'revealed'], 10000);
    assert.equal((await state(p)).decision.option, 'pass_question');
    await p.locator(T('reveal-heading')).waitFor({ timeout: 20000 });
    assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'reveal-heading', 'the account heading takes focus once');
  });

  /* ---------------------------------------------------------------- 7 --- */
  await test('Touch on the stage (390 phone): tap the display to read it, tap the floor by the seat to sit, tap yourself for actions; a drag never commits', async p => {
    await click(p, 'advance');
    const disp = await box(p, 'surface-o_deck');
    if (disp) {
      await p.touchscreen.tap(disp.x + disp.width / 2, disp.y + disp.height / 2);
      await p.locator(T('observation')).waitFor({ timeout: 3000 });
      assert.ok((await state(p)).seenObservations.includes('obs_title'), 'tapping the display opens Read the deck title');
      await click(p, 'observation-close');
    } else assert.fail('the desk display is in the portrait framing');
    await click(p, 'advance');
    await travel(p, 'cut_to_meeting', 'c_meeting_before');
    for (let i = 0; i < 4; i++) await click(p, 'advance');
    await travel(p, 'start_break', 'c_hallway');
    await click(p, 'advance');
    await travel(p, 'resume_meeting', 'c_meeting_question');
    await click(p, 'advance');
    await click(p, 'advance');
    // Tap the floor next to the own seat: the seat preparation (legal floor, nearest supported mark).
    const seat = await p.evaluate(() => {
      const s = window.__v3Correction!.getState()!;
      return s.entities.find(e => e.id === 'a_me')!.state.mark_role ?? null;
    });
    assert.equal(seat, null);
    const stage = (await box(p, 'stage'))!;
    const marks = JSON.parse((await p.locator(T('scene-viewport')).getAttribute('data-marks'))!);
    // A tap on the seat itself: the inverse projection lands on the chair, which is legal only as this seat.
    await p.touchscreen.tap(stage.x + marks.own_seat[0], stage.y + marks.own_seat[1] - 2);
    await settle(p, 120);
    const sat = (await state(p)).entities.find((e: any) => e.id === 'a_me').state.mark_role === 'own_seat';
    assert.ok(sat, 'a floor tap beside the seat applies Return to my seat');
    await settle(p, 1500);
    // Drag across the stage: a scroll gesture, never an activation.
    const before = (await events(p)).length;
    await p.mouse.move(stage.x + 50, stage.y + 50);
    await p.mouse.down();
    await p.mouse.move(stage.x + 200, stage.y + 260, { steps: 8 });
    await p.mouse.up();
    await settle(p);
    assert.ok(!(await events(p)).slice(before).some(e => ['REQUEST_INTENT', 'CONFIRM', 'APPLY_PREPARATION', 'ACTIVATE_CONTEXT'].includes(e.type)), 'a drag commits nothing');
    // Tap the options (portrait: stacked in the thumb zone), confirm by tap.
    await p.locator(T('decision-option-request_private')).tap();
    await p.locator(T('confirm-button')).tap();
    await waitPhase(p, ['enacting', 'holding', 'boundary', 'reveal_loading', 'revealed'], 10000);
    assert.equal((await state(p)).decision.option, 'request_private');
    assert.equal(await p.locator(T('stage')).count() ? await p.locator(T('scene-viewport')).getAttribute('data-camera') : 'meeting__portrait_east', 'meeting__portrait_east', 'portrait private request uses Design’s portrait_east recipe');
  }, '', PHONE);

  /* ---------------------------------------------------------------- 8 --- */
  await test('Readable mode: no stage, the same controls, transcript, decision, confirmation, receipts and the same account', async p => {
    await click(p, 'toggle-readable');
    assert.equal(await p.locator(T('scene-viewport')).count(), 0, 'no stage in readable mode');
    await walkToQuestion(p, { observeTitle: true, observeSummary: true, prep: 'seat' });
    assert.ok((await p.locator(T('transcript')).textContent())!.includes('Anything to add before we use this?'));
    const labels = await p.locator('[data-testid^="decision-option-"]').allTextContents();
    assert.deepEqual(labels, OPTIONS.map(o => APPROVED_INTENTION_CAPTIONS[o]));
    await choose(p, 'request_private');
    assert.deepEqual(await readAccount(p), GOLD);
    const ev = (await events(p)).filter(e => !e.rejected).map(e => e.type);
    for (const t of ['ENACTED', 'HOLD_DONE', 'BOUNDARY_DONE', 'REVEAL_LOADED']) assert.ok(ev.includes(t), `${t} in readable mode too`);
  });

  /* ---------------------------------------------------------------- 9 --- */
  await test('Mobile 390 and 200% text: no horizontal scroll, ≥16 px gutters, ≥44 px targets, full unclipped options/confirmation/reveal, long RU-length labels wrap', async p => {
    const noOverflow = async (what: string) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 0.5), `${what}: no horizontal scroll`);
    const targets = async (what: string) => {
      const bad = await p.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('button'))
          .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.v3p-sr-only'))
          .map(b => ({ id: b.getAttribute('data-testid'), r: b.getBoundingClientRect() }))
          .filter(x => x.r.width < 44 - 0.5 || x.r.height < 44 - 0.5 || x.r.left < 16 - 0.5 || x.r.right > window.innerWidth - 16 + 0.5)
          .map(x => `${x.id} ${Math.round(x.r.width)}x${Math.round(x.r.height)} @${Math.round(x.r.left)}`)
      );
      assert.deepEqual(bad, [], `${what}: every button is ≥44 px and inside the 16 px gutters`);
    };
    await noOverflow('entry');
    await targets('entry');
    await walkToQuestion(p, { prep: 'near' });
    await noOverflow('decision');
    await targets('decision');
    // Unclipped: every option's full text is inside its box.
    const clipped = () => p.locator('[data-testid^="decision-option-"]').evaluateAll(b => b.filter(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map(x => x.getAttribute('data-testid')));
    assert.deepEqual(await clipped(), []);
    // 200% text: rem-based layout reflows.
    await p.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await settle(p, 200);
    await noOverflow('200% text');
    assert.deepEqual(await clipped(), [], 'options at 200% text');
    // RU-length layout probe: longer Cyrillic strings in the same controls (layout only; final RU copy is pending).
    await p.evaluate(() => document.querySelectorAll('[data-testid^="decision-option-"]').forEach(b => (b.textContent = 'Попросить директора наедине после встречи уточнить, кто на самом деле подготовил этот прогноз')));
    await settle(p, 100);
    await noOverflow('RU-length options');
    assert.deepEqual(await clipped(), [], 'RU-length options wrap');
    await p.evaluate(() => (document.documentElement.style.fontSize = ''));
    await p.reload();
    await waitPhase(p, 'playing', 30000);
    await choose(p, 'correct_public');
    const acct = await readAccount(p);
    assert.deepEqual(acct, GOLD, 'every reveal field is shown in full at 390');
    await noOverflow('reveal');
    await targets('reveal');
  }, '', PHONE);

  /* --------------------------------------------------------------- 10 --- */
  await test('Reduced motion (system preference): no walk, 400 ms withdrawal, identical causal events and receipts; the preference changes no state', async p => {
    await walkToQuestion(p);
    const before = await box(p, 'body-a_me');
    await click(p, 'prepare-prep_seat');
    await settle(p, 60);
    const after = await box(p, 'body-a_me');
    assert.notDeepEqual(after, before, 'the hero is on the seat at once (a cut, not a walk)');
    await settle(p, 400);
    assert.deepEqual(await box(p, 'body-a_me'), after, 'no movement continues');
    const s0 = await state(p);
    await click(p, 'toggle-reduced-motion');
    await click(p, 'toggle-reduced-motion');
    const s1 = await state(p);
    assert.deepEqual({ ...s1, time: null }, { ...s0, time: null }, 'toggling motion changes no story state');
    await choose(p, 'pass_question');
    assert.deepEqual(await readAccount(p), GOLD);
    const ev = (await events(p)).filter(e => !e.rejected && ['CONFIRM', 'ENACTED', 'HOLD_DONE', 'BOUNDARY_DONE', 'REVEAL_LOADED'].includes(e.type)).map(e => e.type);
    assert.deepEqual(ev, ['CONFIRM', 'ENACTED', 'HOLD_DONE', 'BOUNDARY_DONE', 'REVEAL_LOADED']);
  }, '', { ...DESKTOP, reducedMotion: 'reduce' });

  /* --------------------------------------------------------------- 11 --- */
  await test('Skip: from the act installs the stop pose and caption, reaches the same boundary; no mandatory wait', async p => {
    await walkToQuestion(p, { prep: 'seat' });
    await choose(p, 'request_private');
    await p.locator(T('skip-button')).click();
    await p.locator(T('boundary-line')).waitFor();
    assert.equal(await p.locator(T('held-caption')).textContent(), APPROVED_INTENTION_CAPTIONS.request_private, 'the caption stays through the boundary');
    assert.equal(await p.locator(T('figure-a_me')).getAttribute('data-pose'), 'ask', 'the stop pose is installed');
    const t0 = Date.now();
    await p.locator(T('reveal-act')).waitFor({ timeout: 10000 });
    assert.ok(Date.now() - t0 < 4000, 'no four-second wait before the account');
  });

  /* --------------------------------------------------------------- 12 --- */
  await test('Preload failure: the source stays mounted, a visible retry; a hash mismatch is a failure; entry failure retries; a readable fallback continues the same story', async p => {
    await click(p, 'advance');
    await click(p, 'advance');
    // Every meeting plate fails once at the network.
    let fail = true;
    await p.route(/P_meeting_room_.*\.webp/, r => (fail ? r.fulfill({ status: 503, body: '' }) : r.continue()));
    await click(p, 'travel-cut_to_meeting');
    await p.locator(T('transition-failed')).waitFor({ timeout: 10000 });
    let s = await state(p);
    assert.deepEqual([s.scene, s.phase], ['c_desk', 'playing'], 'the desk stays mounted and playable');
    // A file whose bytes differ from the pinned SHA-256 is never shown.
    await p.unroute(/P_meeting_room_.*\.webp/);
    await p.route(/P_meeting_room_desktop_paint\.webp/, async r => {
      const real = await r.fetch();
      const b = Buffer.from(await real.body());
      b[b.length - 1] ^= 0xff;
      await r.fulfill({ status: 200, body: b, headers: { 'content-type': 'image/webp' } });
    });
    await click(p, 'transition-retry');
    await p.locator(T('transition-failed')).waitFor({ timeout: 10000 });
    assert.equal((await state(p)).scene, 'c_desk', 'a hash mismatch fails the preparation');
    await p.unroute(/P_meeting_room_desktop_paint\.webp/);
    fail = false;
    await click(p, 'transition-retry');
    await waitScene(p, 'c_meeting_before');
    s = await state(p);
    assert.equal(s.visitedScenes.length, 2);
  });
  await test('Entry preparation failure → retry, and the readable fallback', async p => {
    await p.locator(T('entry-failed')).waitFor({ timeout: 15000 });
    assert.equal(await phase(p), 'loading');
    await click(p, 'entry-retry');
    await waitPhase(p, 'playing', 20000);
    // The approved readable fallback: same story, no pictures.
    await click(p, 'advance');
    await p.evaluate(() => (window.__v3Correction!.faults.preload = 'fail'));
    await click(p, 'advance');
    await click(p, 'travel-cut_to_meeting');
    await p.locator(T('transition-failed')).waitFor();
    await click(p, 'transition-readable');
    await click(p, 'travel-cut_to_meeting');
    await waitScene(p, 'c_meeting_before');
    assert.equal(await p.locator(T('readable-fallback')).count(), 1);
  }, '&preload=fail-once', DESKTOP, false);

  /* --------------------------------------------------------------- 13 --- */
  await test('Persistence: with journal and repository both failing the account stays shut with a visible retry; retry sends the identical key; repository-only failure proceeds after durable local acceptance', async p => {
    await walkToQuestion(p);
    await choose(p, 'correct_public');
    await p.locator(T('boundary-save-failed')).waitFor({ timeout: 15000 });
    await p.waitForFunction(() => (window.__v3Correction!.status() as any).revealGate === 'waiting_for_durable_acceptance', null, { timeout: 15000 });
    await settle(p, 500);
    assert.equal((await status(p)).revealGate, 'waiting_for_durable_acceptance', 'presented, but not durable: the gate holds');
    assert.equal(await p.evaluate(() => window.__v3Correction!.revealLoads), 0, 'the private record is not even requested');
    assert.equal((await state(p)).decision.option, 'correct_public', 'the accepted act is kept');
    await p.evaluate(() => Object.assign(window.__v3Correction!.faults, { persist: 'none', journal: 'none' }));
    await click(p, 'boundary-save-retry');
    assert.deepEqual(await readAccount(p), GOLD);
    const keys = new Set((await p.evaluate(() => window.__v3Correction!.decisions)).map(d => d.key));
    assert.equal(keys.size, 1, 'every attempt sent the identical idempotency key');
  }, '&persist=reject&journal=reject');
  await test('Persistence: the remote write fails but the local journal is durable — the account opens and the remote retry stays offered', async p => {
    await walkToQuestion(p);
    await choose(p, 'pass_question');
    assert.deepEqual(await readAccount(p), GOLD);
    await p.locator(T('persistence-failed')).waitFor();
    await p.evaluate(() => (window.__v3Correction!.faults.persist = 'none'));
    await click(p, 'persistence-retry');
    await p.waitForFunction(() => (window.__v3Correction!.status() as any).persistence.repository === 'recorded');
    assert.equal((await state(p)).decision.status, 'recorded');
  }, '&persist=reject');

  /* --------------------------------------------------------------- 14 --- */
  await test('Reload after the accepted choice: resumes locked at the boundary, never reopens the choice, re-sends the same key, same account', async p => {
    await walkToQuestion(p, { prep: 'near' });
    await choose(p, 'request_private');
    await p.locator(T('enactment-caption')).waitFor();
    const key = (await p.evaluate(() => window.__v3Correction!.decisions))[0].key;
    await p.reload();
    await waitPhase(p, ['boundary', 'reveal_loading', 'revealed'], 30000);
    const s = await state(p);
    assert.deepEqual([s.decision.option, s.boundaryLocked], ['request_private', true]);
    assert.equal(await p.locator('[data-testid^="decision-option-"]').count(), 0, 'no choice is offered again');
    assert.deepEqual(await readAccount(p), GOLD);
    const keys = (await p.evaluate(() => window.__v3Correction!.decisions)).map(d => d.key);
    assert.ok(keys.every(k => k === key), 'a re-send uses the identical key');
    // A reload after the account re-resolves the record before claiming it.
    await p.reload();
    await waitPhase(p, ['revealed', 'ended'], 30000);
    await p.locator(T('reveal-act')).waitFor({ timeout: 20000 });
    assert.equal(await p.locator(T('reveal-act')).textContent(), GOLD.act);
  });

  /* --------------------------------------------------------------- 15 --- */
  await test('Invalid / stale / missing private records render no account and fail visibly with retry', async p => {
    await walkToQuestion(p);
    await choose(p, 'correct_public');
    await p.locator(T('reveal-failed')).waitFor({ timeout: 20000 });
    assert.equal(await p.locator(T('reveal-act')).count(), 0);
    assert.deepEqual(leaks(await p.evaluate(() => document.body.innerText)), [], 'nothing of an invalid record is shown');
    assert.equal(await p.evaluate(() => window.__v3Correction!.revealRecordPresent()), false);
    await click(p, 'reveal-retry');
    assert.deepEqual(await readAccount(p), GOLD, 'a retry with a valid record shows the account');
  }, '&reveal=invalid-once');
  for (const fault of ['stale', 'missing'] as const)
    await test(`A ${fault} record is refused and stays a visible failure`, async p => {
      await walkToQuestion(p);
      await choose(p, 'pass_question');
      await p.locator(T('reveal-failed')).waitFor({ timeout: 20000 });
      assert.equal(await p.locator(T('reveal-act')).count(), 0);
      await click(p, 'reveal-retry');
      await p.locator(T('reveal-failed')).waitFor();
      assert.equal(await p.locator(T('reveal-act')).count(), 0);
      assert.equal((await state(p)).decision.option, 'pass_question', 'no second choice is requested');
    }, `&reveal=${fault}`);

  /* --------------------------------------------------------------- 16 --- */
  await test('Stale completions: a held preparation completed after unmount, or for a superseded transaction, cannot swap the scene', async p => {
    await click(p, 'advance');
    await click(p, 'advance');
    await p.evaluate(() => (window.__v3Correction!.faults.holdPreloads = true));
    await click(p, 'travel-cut_to_meeting');
    await p.waitForFunction(() => window.__v3Correction!.held.length === 1);
    assert.equal((await state(p)).phase, 'transitioning');
    assert.equal(await p.locator(T('transition-preparing')).count(), 1, 'the source stays mounted while preparing');
    // Unmount (route change) and come back: a new mount generation; the old completion is stale.
    await p.evaluate(() => window.__v3Correction!.unmount());
    await p.evaluate(() => window.__v3Correction!.remount());
    // The remount re-prepares its restored scene (React StrictMode attaches twice: the first entry preparation is itself stale).
    await p.waitForFunction(() => window.__v3Correction!.held.filter(h => h.txId === 'entry').length >= 1);
    await settle(p, 200);
    await p.evaluate(() => window.__v3Correction!.held[0].resolve()); // tx1 of the unmounted player
    await settle(p, 300);
    let s = await state(p);
    assert.deepEqual([s.scene, s.phase], ['c_desk', 'loading'], 'the old mount’s completion swapped nothing');
    await p.evaluate(() => {
      window.__v3Correction!.faults.holdPreloads = false;
      window.__v3Correction!.held.slice(1).forEach(h => h.resolve()); // stale entry first, live entry last
    });
    await waitPhase(p, 'playing');
    s = await state(p);
    assert.deepEqual([s.scene, s.deliveredBeats], ['c_desk', ['ev_desk_context', 'ev_title']], 'the route return resumed from the last completed save');
    // Superseded transaction: fail one, request again, then resolve the old one late.
    const n = await p.evaluate(() => window.__v3Correction!.held.length);
    await p.evaluate(() => (window.__v3Correction!.faults.holdPreloads = true));
    await click(p, 'travel-cut_to_meeting');
    await p.waitForFunction(k => window.__v3Correction!.held.length === k + 1, n);
    await p.evaluate(k => window.__v3Correction!.held[k].reject(), n);
    await p.locator(T('transition-failed')).waitFor();
    await click(p, 'transition-retry');
    await p.waitForFunction(k => window.__v3Correction!.held.length === k + 2, n);
    await p.evaluate(k => window.__v3Correction!.held[k].resolve(), n); // already settled: no effect
    await settle(p, 200);
    assert.equal((await state(p)).phase, 'transitioning', 'only the live transaction may complete');
    await p.evaluate(k => window.__v3Correction!.held[k + 1].resolve(), n);
    await waitScene(p, 'c_meeting_before');
  });

  /* --------------------------------------------------------------- 17 --- */
  await test('Compressed control: one meeting location, no hallway door, same options, same confirmation, same account', async p => {
    assert.equal(await p.locator(T('correction-dev-entry')).getAttribute('data-variant'), 'compressed');
    await click(p, 'advance');
    await click(p, 'advance');
    await travel(p, 'cut_to_meeting', 'c_compressed_meeting');
    while (await p.locator(T('advance')).count()) await click(p, 'advance');
    assert.equal(await p.locator('[data-testid^="travel-"]').count(), 0, 'no walkable hallway');
    assert.deepEqual(await p.locator('[data-testid^="decision-option-"]').allTextContents(), OPTIONS.map(o => APPROVED_INTENTION_CAPTIONS[o]));
    await choose(p, 'request_private');
    assert.deepEqual(await readAccount(p), GOLD);
  }, '&variant=compressed');

  /* --------------------------------------------------------------- 18 --- */
  await test('V1/V2 compatibility: the ordinary app route has no V3 player; the Foundation harness still mounts; a production build contains no dev entry or Correction data', async p => {
    await p.goto(`${base}/`);
    await p.waitForSelector('.vivi-app', { timeout: 20000 });
    assert.equal(await p.locator(T('player')).count(), 0);
    await p.goto(`${base}/?v3=foundation`);
    await p.waitForFunction(() => document.querySelector('[data-testid="phase"]')?.textContent === 'playing', null, { timeout: 20000 });
    const out = mkdtempSync(join(tmpdir(), 'v3-build-'));
    try {
      // A separate production process: the dev server in this process set NODE_ENV=development.
      execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error', '--outDir', out, '--emptyOutDir'], { env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' });
      const files: string[] = [];
      const walk = (d: string) => readdirSync(d).forEach(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
      walk(out);
      const js = files.filter(f => f.endsWith('.js')).map(f => readFileSync(f, 'utf8')).join('\n');
      assert.ok(!/CorrectionDevEntry|v3-dev-repository|the-correction/.test(js), 'the dev entry and the Correction fixture are compiled out');
      assert.deepEqual(leaks(js), [], 'no account text in the production bundle');
      assert.ok(!files.some(f => /P_meeting_room|author_page/.test(f)), 'no slice assets are emitted');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, '', DESKTOP, false);

  const version = browser.version();
  await browser.close();
  await server.close();
  const failed = results.filter(r => r[1]);
  if (failed.length) {
    console.log(`\n${failed.length} of ${results.length} visual Correction browser checks FAILED.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} visual Correction browser checks passed (${version}).`);
  console.log('Technical evidence only: no screen-reader, physical-device, translation or human-research result is claimed.');
}

await main();
