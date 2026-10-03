import { compileViviStory, type CompileStoryResult } from '../../engine/compiler/compileViviStory.ts';
import type { ExperienceSemanticProvider } from '../../engine/compiler/provider.ts';
import { EXPERIENCE_FIXTURES, fixtureForStory, type ExperienceFixture } from './index.ts';

/**
 * A semantic provider that answers from stored programs instead of a model.
 *
 * Used for the editorial fixtures and for QA (`SEMANTIC_PROVIDER=replay`), so
 * Create → Save → Play can be exercised end to end without spending on a live
 * model. A story it has no program for is an error, which the pipeline turns
 * into its ordinary deterministic fallback — exactly what happens when a real
 * provider fails.
 */
export function createReplayProvider(fixtures: ExperienceFixture[] = EXPERIENCE_FIXTURES): ExperienceSemanticProvider {
  return {
    id: 'replay:editorial-fixtures',
    async compileStory(request) {
      const fixture = fixtures === EXPERIENCE_FIXTURES ? fixtureForStory(request.story) : fixtures.find(f => f.source.replace(/\s+/g, ' ').trim() === request.story.replace(/\s+/g, ' ').trim());
      if (!fixture) throw new Error('replay: no stored program for this story');
      return { text: JSON.stringify(fixture.dsl), model: 'replay:editorial-fixtures' };
    },
  };
}

export const EDITORIAL_AUTHOR = 'Редакция Vivi · вымышленная история для QA';

/** Compile an editorial fixture through the production pipeline. */
export async function compileFixture(fixture: ExperienceFixture): Promise<CompileStoryResult> {
  const result = await compileViviStory(
    {
      story: fixture.source,
      storyBeforeDecision: fixture.source,
      actualOutcome: fixture.author?.act,
      authorWhy: fixture.author?.why,
      authorAfter: fixture.author?.after,
      author: EDITORIAL_AUTHOR,
    },
    { provider: createReplayProvider(), now: 0 }
  );
  const scenario = result.post.scenario;
  const authorAction = fixture.authorChoice !== undefined ? scenario.actions[fixture.authorChoice] : undefined;
  if (authorAction) scenario.authorChoiceId = authorAction.id;
  // Editorial fiction is labelled as such everywhere it is shown.
  if (scenario.authorTruth.status === 'author_supplied') scenario.authorTruth = { ...scenario.authorTruth, status: 'fictional_demo', sourceLabel: 'вымышленная редакционная история' };
  result.post.id = fixture.id;
  scenario.id = fixture.id;
  scenario.authorHandle = '@vivi_editorial';
  result.post.authorHandle = '@vivi_editorial';
  return result;
}
