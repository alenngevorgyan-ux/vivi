import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, RotateCcw, MessageCircle } from 'lucide-react';
import type { SealedReveal } from '../../engine/experience/playback';
import type { CommitmentSpec } from '../../engine/experience/types';
import type { ChoiceRecord } from '../../engine/experience/choiceStore';
import { ui } from '../../engine/experience/copy';

export interface RelatedStory {
  id: string;
  title: string;
  synopsis: string;
}

interface RevealViewProps {
  lang: string;
  chosen?: CommitmentSpec;
  commitments: CommitmentSpec[];
  sealed: SealedReveal;
  record?: ChoiceRecord;
  related?: RelatedStory | null;
  onSaveNote: (note: string) => void;
  onSimilar?: () => void;
  onOpenRelated?: (id: string) => void;
  onReplay: () => void;
  onExit: () => void;
}

/**
 * "You chose… — And I…". The author's words are shown exactly as written,
 * nothing is added where they said nothing, and the author's deed is never
 * marked as the right answer.
 */
export function RevealView(props: RevealViewProps) {
  const { lang, chosen, sealed, record } = props;
  const t = (k: Parameters<typeof ui>[1]) => ui(lang, k);
  const truth = sealed.truth;
  const [note, setNote] = useState(record?.note ?? '');
  const [saved, setSaved] = useState(false);
  const authorDeed = sealed.authorChoiceId ? props.commitments.find(c => c.id === sealed.authorChoiceId) : undefined;
  const sourceLabel =
    truth.status === 'fictional_demo' ? (truth.sourceLabel?.includes('редакц') ? t('editorial') : t('demo')) : truth.status === 'author_supplied' ? t('authorWords') : truth.sourceLabel;
  const firstChoice = record ? props.commitments.find(c => c.id === record.firstChoiceId) : undefined;

  return (
    <div className="vivi-reveal-page">
      <section className="vivi-reveal" aria-labelledby="vivi-reveal-title">
        {chosen && (
          <div className="vivi-reveal-you">
            <span className="vivi-reveal-eyebrow">{t('youChose')}</span>
            <p>{chosen.label}</p>
          </div>
        )}

        <div className="vivi-reveal-author">
          <span className="vivi-reveal-eyebrow" id="vivi-reveal-title">
            {t('andI')}
          </span>
          {truth.status === 'withheld' || !truth.text ? (
            <p className="vivi-reveal-withheld">{t('withheld')}</p>
          ) : (
            <>
              <p className="vivi-reveal-act">{truth.text}</p>
              {truth.why && (
                <div className="vivi-reveal-more">
                  <span>{t('why')}</span>
                  <p>{truth.why}</p>
                </div>
              )}
              {truth.after && (
                <div className="vivi-reveal-more">
                  <span>{t('after')}</span>
                  <p>{truth.after}</p>
                </div>
              )}
              {sourceLabel && <span className="vivi-reveal-source">{sourceLabel}</span>}
            </>
          )}
        </div>

        {authorDeed && chosen && (
          <p className="vivi-reveal-compare">
            {authorDeed.id === chosen.id ? t('sameAsAuthor') : `${t('authorTook')}: «${authorDeed.label}».`}
          </p>
        )}
        {truth.status !== 'withheld' && <p className="vivi-reveal-note">{t('notCorrect')}</p>}
      </section>

      <section className="vivi-finale">
        <div className="vivi-finale-block">
          <label htmlFor="vivi-why-note" className="vivi-finale-title">
            {t('myWhy')}
          </label>
          <textarea
            id="vivi-why-note"
            rows={3}
            maxLength={600}
            value={note}
            onChange={e => {
              setNote(e.target.value);
              setSaved(false);
            }}
          />
          <div className="vivi-finale-row">
            <small>{t('myWhyHint')}</small>
            <button
              type="button"
              className="vivi-dock-ghost"
              disabled={!note.trim()}
              onClick={() => {
                props.onSaveNote(note.trim());
                setSaved(true);
              }}
            >
              {saved ? t('saved') : t('save')}
            </button>
          </div>
        </div>

        {props.onSimilar && (
          <div className="vivi-finale-block is-cta">
            <p className="vivi-finale-title">{t('similar')}</p>
            <button type="button" className="vivi-dock-commit" onClick={props.onSimilar}>
              <MessageCircle size={16} /> {t('similar')} <ArrowRight size={16} />
            </button>
          </div>
        )}

        <div className="vivi-finale-block">
          <p className="vivi-finale-title">{t('related')}</p>
          {props.related ? (
            <button type="button" className="vivi-related" onClick={() => props.onOpenRelated?.(props.related!.id)}>
              <strong>{props.related.title}</strong>
              <span>{props.related.synopsis}</span>
              <ArrowUpRight size={16} />
            </button>
          ) : (
            <p className="vivi-dock-quiet">{t('noRelated')}</p>
          )}
        </div>

        <div className="vivi-finale-block is-quiet">
          {firstChoice && (
            <p>
              {t('yourFirst')}: «{firstChoice.label}»{record && record.replays.length > 0 ? ` · ${t('playAgainNote')}` : ''}
            </p>
          )}
          <p>{t('noStats')}</p>
        </div>

        <div className="vivi-finale-row">
          <button type="button" className="vivi-dock-ghost" onClick={props.onReplay}>
            <RotateCcw size={15} /> {t('replay')}
          </button>
          <button type="button" className="vivi-dock-ghost" onClick={props.onExit}>
            {t('feed')}
          </button>
        </div>
      </section>
    </div>
  );
}
