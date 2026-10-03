/**
 * c_hallway — the break. Only the hero is here; Mira and the director stay in the meeting room (Gold F08) and
 * are drawn only as the same bodies seen through the open door, never as hallway proxies. The summary insert
 * shows “My name” as labelled editorial text (Gold §O), never a personal name or figure.
 */

import React from 'react';

export const hallwayDescription = () => 'The hallway during the break. The meeting-room door is open; Mira and the director are still inside.';

export function SummaryInsert({ summarySrc, readable }: { summarySrc?: string; readable: string }) {
  return (
    <figure className="v3p-insert" data-testid="insert-obs_summary">
      <div className="v3p-insert-paper">
        {summarySrc && <img src={summarySrc} alt="" />}
        <span className="v3p-insert-name" data-testid="insert-my-name">
          My name <small>(editorial representation)</small>
        </span>
      </div>
      <figcaption>{readable}</figcaption>
    </figure>
  );
}
