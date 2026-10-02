/**
 * OpenRouter provider, provider selection and generation-guard tests.
 *
 *   node --import tsx scripts/test-openrouter-provider.ts
 *
 * No network: every request goes to a mock fetch. The fake key below is a
 * test fixture shaped like a real one so redaction can be checked.
 */
import assert from 'node:assert/strict';
import { compileViviStory, type CachedSemantics } from '../src/engine/compiler/compileViviStory.ts';
import { HERO_DSL } from '../src/data/heroStories/dslFixtures.ts';
import { validateDSL } from '../src/engine/compiler/dsl.ts';
import { WORLDS, ROLES, OBJECTS, VERBS, EVENT_SIGNATURES, GRAMMARS } from '../src/engine/compiler/vocabulary.ts';
import { buildDslJsonSchema, wireToDsl, STRUCTURED_SYSTEM_PROMPT, STRUCTURED_REPAIR_SYSTEM } from '../src/engine/compiler/structuredContract.ts';
import { createOpenRouterProvider, OpenRouterError, type ModelCapabilities } from '../src/server/openRouterProvider.ts';
import { selectSemanticProvider } from '../src/server/semanticProvider.ts';
import { createGenerationGuard } from '../src/server/generationGuard.ts';
import { redactSecrets } from '../src/server/redact.ts';

console.log('Testing OpenRouter provider...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

const FAKE_KEY = ['sk', 'or', 'v1', 'testfixture0000000000000000000000000000'].join('-');
const CAPS: ModelCapabilities = { temperature: true, reasoning: true, structuredOutputs: true };
const STORY = 'The elevator opened on my floor at 3 AM, but nobody came out.';

/** A valid wire-form reply for the story above. */
const WIRE = {
  w: 'hall', g: 'intrusion', t: 'eerie',
  c: [{ r: 'neighbor', p: 'off', n: null }],
  o: ['elevator', 'door'],
  e: [
    { k: 'clock', tx: '03:00' },
    { k: 'elevator', m: 'empty' },
    { k: 'light', m: 'flicker' },
    { k: 'handle', p: 'front_door' },
  ],
  a: [
    { v: 'look', t: 'elevator', l: 'Look into the lift', ob: 'The cabin is lit and empty.', out: 'The doors start to close on nothing.' },
    { v: 'lock', t: 'front_door', l: 'Lock your door', ob: 'Your keys are still in your hand.', out: 'The lock turns. The corridor goes quiet.' },
    { v: 'call', t: 'neighbor', l: 'Call your neighbour', ob: 'Their light is off.', out: 'It rings and rings behind their door.' },
  ],
  cg: 'suspense', st: 'isolated_subject',
  x: { ti: 'Third Floor', op: 'The elevator chimes at 3 AM.', q: 'Would you look inside?' },
};

interface Sent { url: string; body: any; headers: Record<string, string> }

function mockFetch(responder: (body: any, call: number) => { status?: number; json?: unknown; text?: string } | Promise<never>) {
  const sent: Sent[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ url: String(url), body, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = await responder(body, sent.length - 1);
    const text = r.text ?? JSON.stringify(r.json);
    return new Response(text, { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fn, sent };
}

const chat = (content: unknown, usage: Record<string, unknown> = {}) => ({
  json: {
    model: 'qwen/qwen3.8-flash',
    provider: 'Alibaba',
    choices: [{ finish_reason: 'stop', message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
    usage: { prompt_tokens: 820, completion_tokens: 190, total_tokens: 1010, cost: 0.000212, completion_tokens_details: { reasoning_tokens: 7 }, prompt_tokens_details: { cached_tokens: 512 }, ...usage },
  },
});

const provider = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) =>
  createOpenRouterProvider({ apiKey: FAKE_KEY, model: 'qwen/qwen3.8-flash', fetch: fetchImpl, capabilities: CAPS, ...extra });

/* ------------------------------------------------------- schema & wire */

{
  const schema = buildDslJsonSchema() as any;
  assert.deepEqual(schema.properties.w.enum, Object.keys(WORLDS), 'world enum comes from vocabulary');
  assert.deepEqual(schema.properties.g.enum, [...GRAMMARS]);
  assert.deepEqual(schema.$defs.role.enum, [...ROLES]);
  assert.deepEqual(schema.$defs.obj.enum, [...OBJECTS]);
  assert.deepEqual(schema.properties.a.items.properties.v.enum, [...VERBS]);
  assert.equal(schema.properties.e.items.anyOf.length, Object.keys(EVENT_SIGNATURES).length, 'one event schema per signature');
  const strictEverywhere = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, 'strict: no additional properties');
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), 'strict: every property required');
    }
    Object.values(node).forEach(strictEverywhere);
  };
  strictEverywhere(schema);
}
ok('Strict JSON schema is generated from vocabulary.ts (one source of truth) and is strict-mode compliant');

{
  for (const [id, fixture] of Object.entries(HERO_DSL)) {
    const d = fixture.dsl;
    const keyFor: Record<string, string> = { role: 'r', obj: 'o', place: 'p', sound: 's', vehicle: 'v', text: 'tx', int: 'n', mode: 'm' };
    const wire = {
      ...d,
      c: d.c.map(([r, p, count]) => ({ r, p, n: count ?? null })),
      e: d.e.map(([k, ...args]) => {
        const ev: Record<string, unknown> = { k };
        (EVENT_SIGNATURES[k] as readonly string[]).forEach((spec, i) => (ev[keyFor[spec.replace('?', '')]] = args[i] ?? null));
        return ev;
      }),
      a: d.a.map(([v, t, l, ob, out]) => ({ v, t, l, ob: ob ?? '', out: out ?? '' })),
    };
    const back = validateDSL(wireToDsl(wire));
    const direct = validateDSL(d);
    assert.ok(back.ok && direct.ok, `${id} round-trips`);
    if (back.ok && direct.ok) assert.deepEqual(back.dsl, direct.dsl, `${id}: wire → DSL is lossless`);
  }
  assert.ok(validateDSL(wireToDsl(WIRE)).ok, 'sample wire reply validates');
}
ok('Wire form converts to positional DSL losslessly (golden fixtures round-trip)');

/* --------------------------------------------------- request & parsing */

{
  const m = mockFetch(() => chat(WIRE));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn) });
  assert.equal(result.report.source, 'model');
  assert.equal(result.report.firstPassValid, true);
  assert.equal(result.report.repaired, false);
  assert.equal(result.compiled.dsl.w, 'hall');
  const u = result.report.usage!;
  assert.equal(u.inputTokens, 820);
  assert.equal(u.outputTokens, 190);
  assert.equal(u.reasoningTokens, 7);
  assert.equal(u.cachedInputTokens, 512);
  assert.equal(u.costUsd, 0.000212);
  assert.ok(typeof u.latencyMs === 'number');
  assert.equal(result.report.upstream, 'Alibaba');
  assert.equal(result.report.providerId, 'openrouter:qwen/qwen3.8-flash');

  const { url, body, headers } = m.sent[0];
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(headers.Authorization, `Bearer ${FAKE_KEY}`, 'key travels only in the Authorization header');
  assert.equal(headers['X-Title'], 'Vivi');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.provider.require_parameters, true);
  assert.equal(body.provider.data_collection, 'deny');
  assert.equal(body.max_tokens, 700);
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.reasoning, { enabled: false });
  assert.deepEqual(body.usage, { include: true });
  assert.equal(body.messages[0].content, STRUCTURED_SYSTEM_PROMPT);
  assert.ok(!JSON.stringify(body).includes(FAKE_KEY), 'key is never in the body');
}
ok('Request: strict json_schema, require_parameters, data_collection deny, max_tokens 700, temp 0.2, reasoning off; usage extracted');

{
  const m = mockFetch(() => chat('```json\n' + JSON.stringify(WIRE) + '\n```'));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn, { capabilities: { temperature: false, reasoning: false, structuredOutputs: true } }) });
  assert.equal(result.report.source, 'model', 'fenced JSON still parses');
  assert.equal(m.sent[0].body.temperature, undefined, 'no temperature where endpoints do not accept it');
  assert.equal(m.sent[0].body.reasoning, undefined, 'no reasoning param where unsupported');
}
ok('Unsupported parameters are omitted so require_parameters can still route');

/* --------------------------------------------------------------- repair */

{
  const broken = { ...WIRE, e: [...WIRE.e, { k: 'exit', r: 'neighbor', p: 'platform' }] }; // a hallway has no platform
  const m = mockFetch((_b, call) => (call === 0 ? chat(broken) : chat(WIRE, { prompt_tokens: 300, completion_tokens: 180, cost: 0.0001 })));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn) });
  assert.equal(result.report.source, 'model');
  assert.equal(result.report.firstPassValid, false);
  assert.ok(result.report.firstPassErrors!.some(e => e.includes('does not exist in world')));
  assert.equal(result.report.repaired, true);
  assert.equal(m.sent.length, 2, 'exactly one repair request');
  const repair = m.sent[1].body;
  assert.equal(repair.messages[0].content, STRUCTURED_REPAIR_SYSTEM, 'repair uses the short system line');
  assert.ok(!JSON.stringify(repair).includes(STRUCTURED_SYSTEM_PROMPT.slice(0, 60)), 'repair does not resend the full system prompt');
  assert.ok(!repair.messages[1].content.includes(STORY), 'repair does not resend the story');
  assert.equal(result.report.repairUsage?.costUsd, 0.0001, 'repair cost measured independently');
  assert.equal(result.report.usage?.costUsd, 0.000312, 'total = first pass + repair');
}
ok('Invalid DSL → one concise repair (errors + invalid JSON only), repair usage measured separately');

{
  const broken = { ...WIRE, a: [WIRE.a[0]] }; // one commitment
  const m = mockFetch(() => chat(broken));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn) });
  assert.equal(m.sent.length, 2, 'never more than one repair');
  assert.equal(result.report.source, 'deterministic');
  assert.equal(result.report.fallbackReason, 'model DSL invalid after repair');
  assert.ok(result.post.scenario.actions.length >= 2, 'deterministic fallback is still playable');
}
ok('Repair failure → deterministic fallback, still playable');

/* -------------------------------------------------------------- failures */

for (const [status, code] of [[401, 'unauthorized'], [402, 'insufficient_credits'], [429, 'rate_limited'], [404, 'model_unavailable'], [503, 'upstream_error']] as const) {
  const m = mockFetch(() => ({ status, json: { error: { code: status, message: `failure for key ${FAKE_KEY} Bearer ${FAKE_KEY}` } } }));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn) });
  assert.equal(result.report.source, 'deterministic', `${status} falls back`);
  assert.ok(result.report.fallbackReason?.includes(code), `${status} → ${code}: ${result.report.fallbackReason}`);
  const everything = JSON.stringify({ report: result.report, post: result.post });
  assert.ok(!everything.includes(FAKE_KEY), `${status}: key never reaches the report or the stored post`);
  assert.ok(!everything.includes('sk-or-'), `${status}: nothing key-shaped in the post`);
  try {
    await provider(m.fn).compileStory({ story: STORY, hints: result.hints });
    assert.fail('should throw');
  } catch (err) {
    assert.ok(err instanceof OpenRouterError);
    assert.ok(!err.message.includes(FAKE_KEY) && !(err.detail ?? '').includes(FAKE_KEY), 'error message and detail are redacted');
    assert.ok(!String(err.stack).includes(FAKE_KEY), 'stack trace is redacted');
  }
}
ok('401 / 402 / 429 / 404 / 503 → deterministic fallback; key never in errors, stacks, reports or posts');

{
  const hang = (async (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
    })) as typeof fetch;
  const started = Date.now();
  // AbortSignal.timeout uses an unref'd timer; a running server keeps the loop alive, a bare test must.
  const keepAlive = setInterval(() => undefined, 50);
  const result = await compileViviStory({ story: STORY }, { provider: provider(hang, { timeoutMs: 150 }) });
  clearInterval(keepAlive);
  assert.equal(result.report.source, 'deterministic');
  assert.ok(result.report.fallbackReason?.includes('timeout'), result.report.fallbackReason);
  assert.ok(Date.now() - started < 3000, 'timeout is enforced');
}
{
  // Headers arrive at once (200), then the body stalls past the timeout — OpenRouter's keep-alive pattern.
  const stall = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('\n'));
        init?.signal?.addEventListener('abort', () => controller.error(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
      },
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  const keepAlive = setInterval(() => undefined, 50);
  const result = await compileViviStory({ story: STORY }, { provider: provider(stall, { timeoutMs: 150 }) });
  clearInterval(keepAlive);
  assert.equal(result.report.source, 'deterministic');
  assert.ok(result.report.fallbackReason?.includes('timeout'), `body-read timeout is reported as a timeout: ${result.report.fallbackReason}`);
}
ok('Timeout → deterministic fallback (before headers and while reading a 200 body)');

{
  const m = mockFetch(() => ({ json: { choices: [{ message: { content: '' } }] } }));
  const result = await compileViviStory({ story: STORY }, { provider: provider(m.fn) });
  assert.equal(result.report.source, 'deterministic');
  assert.ok(result.report.fallbackReason?.includes('empty_reply'));
  const m2 = mockFetch(() => ({ json: { error: { code: 502, message: 'upstream died' } } }));
  assert.equal((await compileViviStory({ story: STORY }, { provider: provider(m2.fn) })).report.source, 'deterministic', '200 with error body falls back');
}
ok('Empty replies and in-body errors fall back');

{
  const m = mockFetch((body, call) =>
    call === 0 && body.reasoning?.enabled === false
      ? { status: 400, json: { error: { code: 400, message: 'Reasoning is mandatory for this endpoint and cannot be disabled.' } } }
      : chat(WIRE)
  );
  const p = provider(m.fn, { model: 'openai/gpt-5-nano' });
  const result = await compileViviStory({ story: STORY }, { provider: p });
  assert.equal(result.report.source, 'model');
  assert.deepEqual(m.sent[1].body.reasoning, { effort: 'minimal', exclude: true }, 'falls back to the lowest effort the model accepts');
  await compileViviStory({ story: 'A different story about a train.' }, { provider: p });
  assert.deepEqual(m.sent[2].body.reasoning, { effort: 'minimal', exclude: true }, 'learned per model');
}
ok('Mandatory-reasoning models drop to minimal effort automatically');

/* ---------------------------------------------------------------- truth */

{
  const canary = 'CANARY-7f3a: I opened the door and it was my brother.';
  const m = mockFetch(() => chat({ ...WIRE, a: [WIRE.a[0]] })); // forces a repair too
  const result = await compileViviStory({ story: STORY, actualOutcome: canary }, { provider: provider(m.fn) });
  for (const s of m.sent) assert.ok(!JSON.stringify(s.body).includes('CANARY-7f3a'), 'outcome never in any request, including repair');
  assert.equal(result.post.scenario.authorTruth.text, canary, 'outcome still preserved on the post');
}
ok('actualOutcome never reaches OpenRouter (first pass or repair) and is preserved on the post');

/* ---------------------------------------------------------------- cache */

{
  const cache = new Map<string, CachedSemantics>();
  const m = mockFetch(() => chat(WIRE));
  const a = provider(m.fn, { model: 'qwen/qwen3.8-flash' });
  const b = provider(m.fn, { model: 'openai/gpt-5.4-nano' });
  const first = await compileViviStory({ story: STORY }, { provider: a, cache });
  const again = await compileViviStory({ story: STORY }, { provider: a, cache });
  const other = await compileViviStory({ story: STORY }, { provider: b, cache });
  assert.equal(first.report.cacheHit, false);
  assert.equal(again.report.cacheHit, true, 'same model → cache hit');
  assert.equal(other.report.cacheHit, false, 'different model → no cache hit');
  assert.equal(m.sent.length, 2);
}
ok('Semantic cache is model-specific');

/* ------------------------------------------------------------ selection */

{
  const fake = FAKE_KEY;
  const or = selectSemanticProvider({ OPENROUTER_API_KEY: fake, GEMINI_API_KEY: 'g-key-123456' });
  assert.equal(or.kind, 'openrouter');
  assert.equal(or.model, 'qwen/qwen3.8-flash', 'default model');
  const switched = selectSemanticProvider({ OPENROUTER_API_KEY: fake, OPENROUTER_MODEL: 'openai/gpt-5.4-nano' });
  assert.equal(switched.provider?.id, 'openrouter:openai/gpt-5.4-nano', 'one env change switches the model');
  const withFallback = selectSemanticProvider({ OPENROUTER_API_KEY: fake, OPENROUTER_MODEL: 'qwen/qwen3-32b', OPENROUTER_FALLBACK_MODEL: 'openai/gpt-5-nano' });
  assert.equal(withFallback.provider?.id, 'openrouter:qwen/qwen3-32b+openai/gpt-5-nano');
  const body = await (withFallback.provider as ReturnType<typeof createOpenRouterProvider>).buildBody('s', 'u');
  assert.deepEqual(body.models, ['qwen/qwen3-32b', 'openai/gpt-5-nano'], 'router-native fallback, one request');

  const gemini = selectSemanticProvider({ GEMINI_API_KEY: 'g-key-123456' });
  assert.equal(gemini.kind, 'gemini', 'legacy Gemini path when only GEMINI_API_KEY is set');
  assert.equal(selectSemanticProvider({ OPENROUTER_API_KEY: fake, GEMINI_API_KEY: 'g', SEMANTIC_PROVIDER: 'gemini' }).kind, 'gemini', 'explicit override');
  assert.equal(selectSemanticProvider({ OPENROUTER_API_KEY: fake, SEMANTIC_PROVIDER: 'deterministic' }).kind, 'deterministic');
  const none = selectSemanticProvider({});
  assert.equal(none.kind, 'deterministic');
  assert.equal(none.provider, null);
  const missing = selectSemanticProvider({ SEMANTIC_PROVIDER: 'openrouter' });
  assert.equal(missing.kind, 'deterministic');
  assert.ok(missing.warnings.some(w => w.includes('OPENROUTER_API_KEY')));
  const leaky = selectSemanticProvider({ VITE_OPENROUTER_API_KEY: fake });
  assert.ok(leaky.warnings.some(w => w.includes('VITE_')), 'warns about secrets in VITE_ variables');
  for (const sel of [or, switched, gemini, none, missing, leaky]) {
    assert.ok(!JSON.stringify({ w: sel.warnings, m: sel.model, id: sel.provider?.id }).includes(fake), 'selection output never contains the key');
  }
  const det = await compileViviStory({ story: STORY }, { provider: none.provider });
  assert.equal(det.report.source, 'deterministic');
  assert.equal(det.report.fallbackReason, 'no semantic provider configured');
}
ok('Provider selection: OpenRouter → Gemini → deterministic; SEMANTIC_PROVIDER override; OPENROUTER_MODEL switch');

/* ------------------------------------------------------- guard & redact */

{
  let t = 0;
  const g = createGenerationGuard({ perClient: 2, windowMs: 1000, maxConcurrent: 2, now: () => t });
  const a1 = g.acquire('a');
  assert.ok(a1.ok);
  const a2 = g.acquire('a');
  assert.ok(!a2.ok && a2.reason === 'client_busy', 'one in-flight generation per client');
  if (a1.ok) a1.release();
  const a3 = g.acquire('a');
  assert.ok(a3.ok);
  if (a3.ok) a3.release();
  const a4 = g.acquire('a');
  assert.ok(!a4.ok && a4.reason === 'rate_limited' && a4.status === 429, 'per-client rate limit');
  const b = g.acquire('b');
  const c = g.acquire('c');
  const d = g.acquire('d');
  assert.ok(b.ok && c.ok && !d.ok && d.reason === 'server_busy', 'global concurrency cap');
  t = 5000;
  if (b.ok) b.release();
  assert.ok(g.acquire('a').ok, 'window slides');
}
ok('Generation guard: per-client rate limit, one in-flight per client, global concurrency cap');

{
  const fakeGoogle = ['AIza', 'Sy', 'X'.repeat(30)].join('');
  const text = `Authorization: Bearer ${FAKE_KEY} {"authorization":"Bearer abc"} key=${FAKE_KEY} google ${fakeGoogle}`;
  const red = redactSecrets(text);
  assert.ok(!red.includes(FAKE_KEY) && !red.includes(fakeGoogle) && !red.includes('Bearer abc'), red);
  assert.equal(redactSecrets('custom-secret-value here', ['custom-secret-value']), '[redacted] here');
}
ok('redactSecrets removes OpenRouter/Google keys and Authorization values');

console.log(`\nAll ${n} OpenRouter provider checks passed.`);
