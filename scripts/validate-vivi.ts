import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { heroStories } from '../src/data/heroStories';
import { worldTemplates } from '../src/world/templates';
import { characters } from '../src/assets/characters/characters';
import { cameraPresets, shotTypes } from '../src/engine/cinematic/shotTypes';

assert.equal(heroStories.length, 12, 'twelve flagship stories');
assert.equal(Object.keys(worldTemplates).length, 10, 'ten world templates');
assert.equal(Object.keys(characters).length, 10, 'ten modular characters');
assert.equal(new Set(heroStories.map(story => story.id)).size, heroStories.length, 'unique story IDs');
for (const story of heroStories) {
  assert.ok(worldTemplates[story.world], `${story.id}: valid world`);
  assert.ok(story.hook.length < 140, `${story.id}: feed hook is scannable`);
  assert.ok(story.cueAtMs < story.pressureAtMs, `${story.id}: tension escalates after the first cue`);
  assert.ok(story.actions.length >= 3 && story.actions.length <= 5, `${story.id}: choice count`);
  assert.equal(new Set(story.actions.map(action => action.id)).size, story.actions.length, `${story.id}: unique actions`);
  for (const action of story.actions) {
    assert.ok(story.endings[action.id], `${story.id}: ending for ${action.id}`);
    assert.ok(action.x >= 0 && action.x <= 100 && action.y >= 0 && action.y <= 100, `${story.id}: in-frame action`);
  }
  assert.ok(story.modifiers.some(item => item.atMs <= story.cueAtMs), `${story.id}: cue modifier exists`);
  assert.ok(story.modifiers.every((item, i) => i === 0 || story.modifiers[i - 1].atMs <= item.atMs), `${story.id}: monotonic modifier timeline`);
  assert.ok(story.shots.every(cue => shotTypes.includes(cue.type) && cameraPresets[cue.camera]), `${story.id}: valid shot cues`);
  assert.ok(story.reality && story.crowdQuestion, `${story.id}: reveal and comparison`);
}
for (const id of ['the-message', '0317', 'the-presentation', 'last-walk']) {
  assert.ok(existsSync(new URL(`../src/assets/storyboards/${id}.svg`, import.meta.url)), `${id}: storyboard asset`);
}
for (const id of Object.keys(characters)) {
  assert.ok(existsSync(new URL(`../src/assets/characters/sheets/${id}.svg`, import.meta.url)), `${id}: character sheet`);
}
console.log('Vivi design contracts valid: 12 stories, 10 worlds, 10 character sheets, 4 storyboards.');
