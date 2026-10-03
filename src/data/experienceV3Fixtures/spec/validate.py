"""Offline planning audit only; no runtime imports, network, models or schema ownership."""
from pathlib import Path
import hashlib
import json
import unicodedata

HERE = Path(__file__).resolve().parent
errors = []
checks = 0


def check(ok, context):
    global checks
    checks += 1
    if not ok:
        errors.append(context)


def ids(records, label):
    found = [r['id'] for r in records]
    check(len(found) == len(set(found)), f'{label}: duplicate IDs')
    return set(found)


def refs(values, allowed, label):
    check(set(values) <= allowed, f'{label}: unknown references {set(values) - allowed}')


for path in sorted(HERE.glob('*.semantic.json')):
    name = path.name.removesuffix('.semantic.json')
    semantic = json.loads(path.read_text())
    source = json.loads((HERE / f'{name}.source.private.json').read_text())
    reveal = json.loads((HERE / f'{name}.reveal.private.json').read_text())
    check(all(x['experienceId'] == name for x in (source, semantic, reveal)), f'{name}: identity')
    check(semantic['revision'] == reveal['revision'] == 'gold-1', f'{name}: revision')
    check(semantic['editorialStatus'] == source['status'] == reveal['status'] == 'fictional_editorial', f'{name}: fiction label')
    original = source['originalPreBoundary']
    normalized = unicodedata.normalize('NFC', original)
    check(normalized == source['normalizedPreBoundary'], f'{name}: NFC source')
    check(hashlib.sha256(normalized.encode()).hexdigest() == source['sourceSha256'], f'{name}: source hash')
    for text, spans, disclosure in [(normalized, source['spans'], 'before_boundary'),
                                    (source['revealSource']['text'], source['revealSource']['spans'], 'reveal_only')]:
        spanids = ids(spans, f'{name}/{disclosure}')
        check('\n\n'.join(x['excerpt'] for x in spans) == text, f'{name}: complete span coverage {disclosure}')
        previous_end = -2
        for span in spans:
            start, end = span['startCodePoint'], span['endCodePoint']
            check(0 <= start < end <= len(text), f'{name}/{span["id"]}: range')
            check(start == previous_end + 2, f'{name}/{span["id"]}: paragraph offset')
            check(text[start:end] == span['excerpt'], f'{name}/{span["id"]}: exact excerpt')
            check(span['sourceRevision'] == source['sourceRevision'], f'{name}/{span["id"]}: source revision')
            check(span['disclosure'] == disclosure, f'{name}/{span["id"]}: disclosure')
            previous_end = end
        facts = source['evidenceFacts'] if disclosure == 'before_boundary' else source['revealSource']['evidenceFacts']
        ids(facts, f'{name}/{disclosure}/facts')
        for f in facts:
            refs(f['sourceSpanIds'], spanids, f'{name}/{f["id"]}/spans')
            check(bool(f['sourceSpanIds']), f'{name}/{f["id"]}: nonempty source')
            check(f['disclosure'] == disclosure, f'{name}/{f["id"]}: fact disclosure')
            check(f['approval'] in ('verbatim', 'author_confirmed'), f'{name}/{f["id"]}: approved')
    publicfacts = ids(semantic['evidenceFacts'], name + '/facts')
    check(publicfacts == {f['id'] for f in source['evidenceFacts']}, name + ': public/private fact identity')
    check(semantic['evidenceFacts'] == [{k: f[k] for k in ('id', 'claim', 'type', 'required')} for f in source['evidenceFacts']], name + ': exact approved public projection')
    locs = ids(semantic['locations'], name + '/locations')
    actors = ids(semantic['actors'], name + '/actors')
    objects = ids(semantic['objects'], name + '/objects')
    scenes = ids(semantic['scenes'], name + '/scenes')
    events = ids(semantic['softTimeEvents'], name + '/events')
    observations = ids(semantic['observations'], name + '/observations')
    preparations = ids(semantic['preparations'], name + '/preparations')
    options = ids(semantic['opportunities'], name + '/options')
    portals = ids(semantic['portals'], name + '/portals')
    check(actors.isdisjoint(objects), name + ': unique entity IDs')
    check(1 <= len(scenes) <= 4 and len(locs) <= 3 and len(publicfacts) <= 32, name + ': launch caps')
    check(2 <= len(options) <= 4, name + ': opportunity cap')
    check(semantic['presentation']['timer'] is None and semantic['presentation']['time'] == 'soft', name + ': no timer')
    refs(semantic['spine'], scenes, name + '/spine')
    check(set(semantic['spine']) == scenes and len(semantic['spine']) == len(scenes), name + ': exact spine coverage')
    refs([semantic['tension']['perspectiveActor']], actors, name + '/perspective')
    for pole in semantic['tension']['poles']:
        refs(pole['stakeFacts'], publicfacts, name + '/tension')
    for record in semantic['actors'] + semantic['objects'] + semantic['locations']:
        refs(record['supportFacts'], publicfacts, name + '/' + record['id'] + '/support')
        check(bool(record['supportFacts']), name + '/' + record['id'] + ': support exists')
        if 'initialLocation' in record:
            refs([record['initialLocation']], locs, name + '/actor location')
        if 'owner' in record:
            owner = record['owner']
            refs([owner['id']], actors if owner['kind'] == 'actor' else locs, name + '/object owner')
    for record in semantic['scenes']:
        refs([record['location']], locs, name + '/scene location')
        for field, allowed in [('presentActors', actors), ('persistentObjects', objects), ('requiredFacts', publicfacts),
                               ('optionalFacts', publicfacts), ('observationIds', observations),
                               ('preparationIds', preparations), ('opportunityIds', options), ('beats', events)]:
            refs(record[field], allowed, name + '/' + record['id'] + '/' + field)
        check(set(record['requiredFacts']).isdisjoint(record['optionalFacts']), name + '/scene required vs optional')
    for transition in semantic['sceneTransitions']:
        refs([transition['fromScene'], transition['toScene']], scenes, name + '/transition scenes')
        refs(transition['supportFacts'], publicfacts, name + '/transition support')
    seen = set()
    for ev in semantic['softTimeEvents']:
        refs(ev['facts'], publicfacts, name + '/' + ev['id'] + '/facts')
        refs(ev['after'], seen, name + '/' + ev['id'] + ': dependency order / cycles')
        seen.add(ev['id'])
        check(ev['classification'] in ('ambient', 'evidence_delivery', 'causal'), name + '/event class')
        if ev['classification'] == 'ambient':
            check(not ev['facts'] and not ev['effects'], name + '/ambient cannot mutate knowledge/world')
        if ev['classification'] == 'causal':
            check(bool(ev['facts']) and bool(ev['effects']), name + '/causal provenance/effect')
        for effect in ev['effects']:
            if effect['kind'] == 'entity_transfer':
                refs([effect['entity']], actors | objects, name + '/effect entity')
                refs([effect['to']], locs, name + '/effect destination')
    state_keys = {'scene', 'decisionPhase'} | set(semantic['worldPersistence']['variables'])

    def gate(g, depth=0):
        check(depth <= 2, name + '/gate depth')
        if g['kind'] == 'all':
            for child in g['gates']:
                gate(child, depth + 1)
        elif g['kind'] == 'fact_received':
            refs([g['id']], publicfacts, name + '/gate fact')
        elif g['kind'] == 'beat_delivered':
            refs([g['id']], events, name + '/gate beat')
        elif g['kind'] == 'state_is':
            refs([g['key']], state_keys, name + '/gate state')
            values = scenes if g['key'] == 'scene' else {'ready'} if g['key'] == 'decisionPhase' else set(semantic['worldPersistence']['variables'][g['key']])
            refs([g['value']], values, name + '/gate state value')
        else:
            check(False, name + '/unknown gate')

    for p in semantic['portals']:
        refs([p['fromLocation'], p['toLocation']], locs, name + '/portal endpoints')
        refs(p['supportFacts'], publicfacts, name + '/portal support')
        inverse = next((q for q in semantic['portals'] if q['id'] == p['returnPortal']), None)
        check(inverse is not None and inverse['fromLocation'] == p['toLocation'] and inverse['toLocation'] == p['fromLocation'] and inverse['returnPortal'] == p['id'], name + '/inverse portal')
        gate(p['available'])
    minimum = {f['id'] for f in semantic['evidenceFacts'] if f['required']}
    decision = semantic['primaryDecision']
    refs([decision['scene']], scenes, name + '/decision scene')
    check(set(decision['minimumKnowledge']) == minimum, name + ': required decision knowledge')
    check(set(decision['options']) == options, name + ': decision option coverage')
    check(semantic['truthBoundary']['scene'] == decision['scene'] and semantic['truthBoundary']['after'] == 'primary_act', name + '/boundary')
    check(set(semantic['truthBoundary']['stopFrames']) == options, name + '/all stop frames')
    delivered = {f for e in semantic['softTimeEvents'] for f in e['facts']} | {f for o in semantic['observations'] for f in o['facts']}
    refs(minimum, delivered, name + ': minimum facts deliverable')
    for record in semantic['observations'] + semantic['preparations'] + semantic['opportunities']:
        target = record['target']
        if target['kind'] != 'self':
            refs([target['id']], actors if target['kind'] == 'actor' else objects, name + '/target')
        gate(record['available'])
        if 'scenes' in record:
            refs(record['scenes'], scenes, name + '/interaction scenes')
        for field in ('facts', 'supportFacts', 'fearedCostFacts', 'feasibilityFacts'):
            if field in record:
                refs(record[field], publicfacts, name + '/interaction facts')
        if 'decision' in record:
            check(record['decision'] == decision['id'], name + '/one primary decision')
            check(set(record['minimumKnowledge']) == minimum, name + '/equal option knowledge')
            check(all(record.get(k) for k in ('physicalEnactment', 'confirmationCopy', 'finalPose', 'stopFrame')), name + '/concrete acts')
    for field in ('act', 'why', 'aftermath'):
        check(reveal[field] == next(x['excerpt'] for x in source['revealSource']['spans'] if x['field'] == field), name + '/exact reveal ' + field)
    if 'authorOption' in reveal:
        refs([reveal['authorOption']], options, name + '/author option')
    else:
        check(bool(reveal.get('mappingNote')), name + '/intentional no forced mapping')
    publictext = json.dumps(semantic, ensure_ascii=False)
    forbidden_keys = {'act', 'why', 'aftermath', 'authorOption', 'revealSource', 'sourceSpanIds', 'sourceSha256'}

    def leak_keys(value):
        if isinstance(value, dict):
            check(not (set(value) & forbidden_keys), name + ': private key leak')
            for v in value.values():
                leak_keys(v)
        elif isinstance(value, list):
            for v in value:
                leak_keys(v)

    leak_keys(semantic)
    for phrase in [reveal['act'], reveal['why'], reveal['aftermath'], 'missed the last bus', 'stopped inviting me', 'changed the subject', 'afraid of losing her help']:
        check(phrase not in publictext, name + ': reveal phrase leaked')
    doc = HERE.parents[3] / 'docs/v3/format-proof' / (semantic['title'].replace(' ', '_') + '.md')
    check(doc.exists(), name + ': human doc exists')
    if doc.exists():
        document = doc.read_text()
        for entity_id in scenes | options | observations | preparations | publicfacts:
            check(entity_id in document, name + ': human spec missing ' + entity_id)
    print(f'{name}: inspected {len(publicfacts)} facts, {len(scenes)} scenes, {len(options)} acts; private source/reveal separated')

check(len(list(HERE.glob('*.semantic.json'))) == 3, 'exactly three golden specs')
if errors:
    for error in errors:
        print('FAIL:', error)
    raise SystemExit(1)
print(f'PASS: {checks} offline assertions. Entailment, control behavior, visual truth and human payoff still require review/testing.')
