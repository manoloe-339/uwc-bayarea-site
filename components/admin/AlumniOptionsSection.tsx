"use client";

import { useState } from "react";

type Props = {
  hasPhoto: boolean;
  showPhotos: boolean;
  includeNonAlums: boolean;
  includeMovedOut: boolean;
  eventMode: boolean;
  rankByEngagement: boolean;
  rankByDiversity: boolean;
  rankByRecency: boolean;
  eventSize: number;
};

export function AlumniOptionsSection(p: Props) {
  const [eventMode, setEventMode] = useState(p.eventMode);
  return (
    <div className="sm:col-span-2 lg:col-span-4 border-t border-[color:var(--rule)] pt-4 mt-1">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">Options</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[color:var(--navy-ink)]">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hasPhoto" value="1" defaultChecked={p.hasPhoto} />
          Has photo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="showPhotos" value="1" defaultChecked={p.showPhotos} />
          Show photos in results
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="includeNonAlums" value="1" defaultChecked={p.includeNonAlums} />
          Include friends &amp; parents
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="includeMovedOut" value="1" defaultChecked={p.includeMovedOut} />
          Include alumni who moved out of the Bay Area
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="eventMode"
            value="1"
            checked={eventMode}
            onChange={(e) => setEventMode(e.target.checked)}
          />
          Event planning mode
          <span className="text-xs text-[color:var(--muted)]">— score &amp; rank for events</span>
        </label>
      </div>

      {eventMode && (
        <div className="mt-4 pt-3 border-t border-[color:var(--rule)]">
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">Event ranking</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[color:var(--navy-ink)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="rankByEngagement" value="1" defaultChecked={p.rankByEngagement} />
              Prioritize email engagement
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="rankByDiversity" value="1" defaultChecked={p.rankByDiversity} />
              Prioritize company diversity
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="rankByRecency" value="1" defaultChecked={p.rankByRecency} />
              Prioritize recent profile updates
            </label>
            <label className="flex items-center gap-2">
              <span>Event size</span>
              <input
                type="number"
                name="eventSize"
                min={1}
                max={100}
                defaultValue={p.eventSize}
                className="w-20 border border-[color:var(--rule)] rounded px-2 py-1 text-sm"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
