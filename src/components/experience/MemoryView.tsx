import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { CanonicalScenario } from '../../engine/runtime/RuntimeCompiler';
import type { ExperienceV2 } from '../../engine/experience/types';
import type { SealedReveal } from '../../engine/experience/playback';
import { SceneArt } from '../../assets/worlds/SceneArt';
import { splitSentences } from '../../engine/experience/boundary';
import { ui } from '../../engine/experience/copy';

interface MemoryViewProps {
  scenario: CanonicalScenario;
  experience: ExperienceV2;
  sealed: SealedReveal;
  /** The author's text before any decision, as they wrote it. */
  text: string;
  onSimilar?: () => void;
  onExit: () => void;
}

/**
 * Not every story is a game. An illustrated memory is the author's own words
 * over a still of the room; a text story is just the words. Nothing is made
 * playable that the story did not make a decision.
 */
export function MemoryView({ scenario, experience, sealed, text, onSimilar, onExit }: MemoryViewProps) {
  const lang = scenario.lang ?? 'ru';
  const t = (k: Parameters<typeof ui>[1]) => ui(lang, k);
  const illustrated = experience.format === 'illustrated_memory';
  const paragraphs = splitSentences(text).map(s => s.text);
  const truth = sealed.truth;

  return (
    <main className={`vivi-memory ${illustrated ? 'is-illustrated' : 'is-text'}`}>
      {illustrated && (
        <div className="vivi-memory-art" aria-hidden="true">
          <SceneArt world={scenario.world} active />
        </div>
      )}
      <article className="vivi-memory-copy">
        <span className="vivi-reveal-eyebrow">{illustrated ? t('memory') : t('textStory')} · {scenario.authorHandle}</span>
        <h1>{scenario.title}</h1>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {truth.status !== 'withheld' && truth.text && (
          <div className="vivi-reveal-more">
            <span>{t('thenWhat')}</span>
            <p>{truth.text}</p>
            {truth.after && <p>{truth.after}</p>}
          </div>
        )}
        <div className="vivi-finale-row">
          {onSimilar && (
            <button type="button" className="vivi-dock-commit" onClick={onSimilar}>
              {t('similar')} <ArrowRight size={16} />
            </button>
          )}
          <button type="button" className="vivi-dock-ghost" onClick={onExit}>
            {t('feed')}
          </button>
        </div>
      </article>
    </main>
  );
}
