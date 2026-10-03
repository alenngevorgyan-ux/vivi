import React, { useEffect, useRef } from 'react';
import { Eye, X } from 'lucide-react';
import type { ExperienceV2 } from '../../engine/experience/types';
import type { Hotspot } from '../../engine/experience/hotspots';
import { ui } from '../../engine/experience/copy';

interface IntentMenuProps {
  lang: string;
  experience: ExperienceV2;
  hotspots: Hotspot[];
  onLook: (id: string) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * "What can I do?" — every intent that exists in the room, and nothing that
 * does not. Looks and deeds are listed apart so the cost of each is plain.
 */
export function IntentMenu({ lang, experience, hotspots, onLook, onPick, onClose }: IntentMenuProps) {
  const t = (k: Parameters<typeof ui>[1]) => ui(lang, k);
  const ref = useRef<HTMLDivElement>(null);
  const available = new Set(hotspots.flatMap(h => h.intents.map(i => i.id)));
  const looks = experience.observations.filter(o => available.has(o.id));
  const deeds = experience.commitments.filter(c => available.has(c.id));

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-first]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="vivi-menu-backdrop" onClick={onClose}>
      <div ref={ref} className="vivi-menu" role="dialog" aria-modal="true" aria-label={t('whatCanIDo')} onClick={e => e.stopPropagation()}>
        <div className="vivi-menu-head">
          <h2>{t('whatCanIDo')}</h2>
          <button type="button" className="vivi-dock-ghost" onClick={onClose} aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        {experience.facts.length > 0 && (
          <section>
            <h3>{t('known')}</h3>
            <ul className="vivi-menu-facts">
              {experience.facts.map(f => (
                <li key={f.id}>{f.text}</li>
              ))}
            </ul>
          </section>
        )}

        {looks.length > 0 && (
          <section>
            <h3>{t('lookAround')}</h3>
            {looks.map((o, i) => (
              <button key={o.id} type="button" className="vivi-intent is-look" data-first={i === 0 ? '' : undefined} onClick={() => onLook(o.id)}>
                <Eye size={15} aria-hidden="true" /> <span>{o.label}</span>
              </button>
            ))}
          </section>
        )}

        <section>
          <h3>{t('decide')}</h3>
          <p className="vivi-dock-quiet">{t('decideHint')}</p>
          {deeds.map((c, i) => (
            <button key={c.id} type="button" className="vivi-intent is-deed" data-first={looks.length === 0 && i === 0 ? '' : undefined} onClick={() => onPick(c.id)}>
              <span className="vivi-intent-badge">{t('decisionBadge')}</span> <span>{c.label}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
