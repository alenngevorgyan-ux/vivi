/**
 * c_desk — the historical desk frame. The display title is the one approved live DOM title (“Mira’s forecast”,
 * Gold F03); the summary stays the hero's. No figures, quarter, draft, surname, storage or time of day: the
 * insert shows only the title on Design's neutral display texture and Gold's readable equivalent.
 */

import React from 'react';

export const deskDescription = (displayTitle: string) => `Your desk. The desk display shows a slide deck titled “${displayTitle}”.`;

export function DeskTitleInsert({ displayTitle, textureSrc, readable }: { displayTitle: string; textureSrc?: string; readable: string }) {
  return (
    <figure className="v3p-insert" data-testid="insert-obs_title">
      <div className="v3p-insert-display">
        {textureSrc && <img src={textureSrc} alt="" />}
        <span className="v3p-insert-title" data-testid="insert-display-title">
          {displayTitle}
        </span>
      </div>
      <figcaption>{readable}</figcaption>
    </figure>
  );
}
