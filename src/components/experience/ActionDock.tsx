import React, { useEffect, useRef } from 'react';
import { Eye, ArrowRight, X, ListChecks, FastForward } from 'lucide-react';
import type { ExperienceV2 } from '../../engine/experience/types';
import type { ExperienceState } from '../../engine/experience/machine';
import type { Hotspot, Intent } from '../../engine/experience/hotspots';
import type { EnactmentScript } from '../../engine/experience/enactment';
import type { ResolutionMode } from '../../engine/experience/interaction';
import { ui } from '../../engine/experience/copy';

export type Modality = 'mouse' | 'touch' | 'keyboard';

interface ActionDockProps {
  lang: string;
  experience: ExperienceV2;
  state: ExperienceState;
  hotspot?: Hotspot;
  modality: Modality;
  script?: EnactmentScript | null;
  arrivalMode?: ResolutionMode | null;
  onLook: (id: string) => void;
  onPick: (id: string) => void;
  onCommit: (id: string) => void;
  onCancel: () => void;
  onCloseObservation: () => void;
  onOpenMenu: () => void;
  onSkip: () => void;
  /** Move keyboard focus into the dock when a hotspot was chosen with the keyboard. */
  focusOnOpen?: boolean;
}

/**
 * The one place the player reads what they can do and what they see.
 * It always names the concrete act, never a key the player is not using.
 */
export function ActionDock(props: ActionDockProps) {
  const { lang, experience, state, hotspot, modality, script } = props;
  const t = (k: Parameters<typeof ui>[1]) => ui(lang, k);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (props.focusOnOpen) firstButton.current?.focus();
  }, [props.focusOnOpen, hotspot?.key, state.pendingId, state.phase]);

  const pending = state.pendingId ? experience.commitments.find(c => c.id === state.pendingId) : undefined;
  const observation = state.observationId ? experience.observations.find(o => o.id === state.observationId) : undefined;

  const menuButton = (first?: boolean) => (
    <button ref={first ? firstButton : undefined} type="button" className="vivi-dock-menu" onClick={props.onOpenMenu}>
      <ListChecks size={16} /> {t('whatCanIDo')}
    </button>
  );

  let body: React.ReactNode;

  if (state.phase === 'orienting') {
    body = (
      <div className="vivi-dock-row">
        <p className="vivi-dock-quiet">{t('orienting')}</p>
        <button ref={firstButton} type="button" className="vivi-dock-ghost" onClick={props.onSkip}>
          {t('skipIntro')} <ArrowRight size={15} />
        </button>
      </div>
    );
  } else if (state.phase === 'enacting' && script) {
    body = (
      <div className="vivi-dock-deed" aria-live="polite">
        <span className="vivi-dock-eyebrow">{t('yourDeed')}</span>
        <p className="vivi-dock-deed-label">{script.caption}</p>
        {script.shows && <p className="vivi-dock-screen">«{script.shows}»</p>}
        {props.arrivalMode === 'text' && <p className="vivi-dock-quiet">{t('textFallback')}</p>}
        {script.note && <p className="vivi-dock-quiet">{script.note}</p>}
        <button ref={firstButton} type="button" className="vivi-dock-ghost" onClick={props.onSkip}>
          <FastForward size={15} /> {t('skip')}
        </button>
      </div>
    );
  } else if (state.phase === 'pausing' || state.phase === 'boundary' || state.phase === 'enacting') {
    body = script ? (
      <div className="vivi-dock-deed">
        <p className="vivi-dock-deed-label">{script.caption}</p>
        {script.note && <p className="vivi-dock-quiet">{script.note}</p>}
      </div>
    ) : null;
  } else if (state.phase === 'approaching') {
    body = (
      <div className="vivi-dock-row" aria-live="polite">
        <p className="vivi-dock-quiet">{t('approaching')}</p>
        <button ref={firstButton} type="button" className="vivi-dock-ghost" onClick={props.onCancel}>
          <X size={15} /> {t('cancel')}
        </button>
      </div>
    );
  } else if (state.phase === 'observing' && observation) {
    body = (
      <div className="vivi-dock-look" aria-live="polite">
        <span className="vivi-dock-eyebrow">
          <Eye size={13} /> {observation.label}
        </span>
        <p className="vivi-dock-seen">{observation.reveals}</p>
        <div className="vivi-dock-row">
          <p className="vivi-dock-quiet">
            {observation.sourced && <span className="vivi-dock-chip">{t('fromStory')}</span>} {t('observation')}
          </p>
          <span className="vivi-dock-actions">
            <button ref={firstButton} type="button" className="vivi-dock-ghost" onClick={props.onCloseObservation}>
              {t('close')}
            </button>
            {menuButton()}
          </span>
        </div>
      </div>
    );
  } else if (pending) {
    body = (
      <div className="vivi-dock-confirm" role="group" aria-label={t('decide')}>
        <span className="vivi-dock-eyebrow is-decision">{t('decisionBadge')}</span>
        <p className="vivi-dock-deed-label">{pending.label}</p>
        <p className="vivi-dock-quiet">{t('decideHint')}</p>
        <div className="vivi-dock-row">
          <button ref={firstButton} type="button" className="vivi-dock-commit" onClick={() => props.onCommit(pending.id)}>
            {t('doIt')} <ArrowRight size={16} />
          </button>
          <button type="button" className="vivi-dock-ghost" onClick={props.onCancel}>
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  } else if (hotspot) {
    const looks = hotspot.intents.filter(i => i.kind === 'look');
    const deeds = hotspot.intents.filter(i => i.kind === 'deed');
    const button = (intent: Intent, i: number) => (
      <button
        key={intent.id}
        ref={i === 0 ? firstButton : undefined}
        type="button"
        className={intent.kind === 'look' ? 'vivi-intent is-look' : 'vivi-intent is-deed'}
        onClick={() => (intent.kind === 'look' ? props.onLook(intent.id) : props.onPick(intent.id))}
      >
        {intent.kind === 'look' ? <Eye size={15} aria-hidden="true" /> : <span className="vivi-intent-badge">{t('decisionBadge')}</span>}
        <span>{intent.label}</span>
      </button>
    );
    body = (
      <div className="vivi-dock-intents">
        {[...looks, ...deeds].map(button)}
        <span className="vivi-dock-actions">
          <button type="button" className="vivi-dock-ghost" onClick={props.onCancel} aria-label={t('close')}>
            <X size={15} />
          </button>
          {menuButton()}
        </span>
      </div>
    );
  } else {
    body = (
      <div className="vivi-dock-context">
        {experience.moment && <p className="vivi-dock-moment">{experience.moment.text}</p>}
        {experience.whyHard && <p className="vivi-dock-hard">{experience.whyHard.text}</p>}
        <div className="vivi-dock-row">
          <p className="vivi-dock-quiet">{modality === 'touch' ? t('tapHint') : modality === 'keyboard' ? t('keyHint') : t('clickHint')}</p>
          {menuButton(true)}
        </div>
      </div>
    );
  }

  if (!body) return null;
  return (
    <div className={`vivi-dock is-${state.phase}`} data-phase={state.phase}>
      {body}
    </div>
  );
}
