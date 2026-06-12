"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractCountryCodes } from "@/lib/country-flag";
import type { FlagMap, UwcLogoMap } from "@/lib/directory-lookups";
import { linkedinHref } from "@/lib/linkedin-url";
import { displayName, titleCase } from "@/lib/text-format";
import {
  detectMovedFromBayArea,
  pickCurrentLocation,
} from "@/lib/location-moved";
import type { SaveReason, SaveStatus } from "@/lib/directory-saves-shared";
import { AlumGalleryCard, type AlumCardData } from "./AlumGalleryCard";
import SavedOutreachFooter from "./SavedOutreachFooter";
import SaveStar from "./SaveStar";

type PendingUndo = {
  alumniId: number;
  prev: { status: SaveStatus; reasons: SaveReason[]; note: string | null };
} | null;

interface RowData {
  id: number;
  alumni_id: number;
  status: SaveStatus;
  reasons: SaveReason[];
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  alum_first_name: string | null;
  alum_last_name: string | null;
  alum_uwc_college: string | null;
  alum_grad_year: number | null;
  alum_current_title: string | null;
  alum_current_company: string | null;
  alum_current_company_linkedin: string | null;
  alum_current_city: string | null;
  alum_photo_url: string | null;
  alum_linkedin_url: string | null;
  alum_origin: string | null;
  /** LinkedIn-served "current_location" + "location_full" come back as
   * separate optional columns for the moved-from-Bay-Area pill check.
   * Some installs of listSavesForUser don't select them; they're
   * optional here. */
  current_location?: string | null;
  location_full?: string | null;
}

interface Props {
  allSaves: RowData[];
  uwcLogos: UwcLogoMap;
  flags: FlagMap;
}

function rowToAlumCard(row: RowData): AlumCardData {
  const name = displayName(row.alum_first_name, row.alum_last_name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const liveLoc = pickCurrentLocation({
    current_location: row.current_location ?? null,
    location_full: row.location_full ?? null,
  });
  return {
    id: row.alumni_id,
    displayName: name,
    photoUrl: row.alum_photo_url,
    initials,
    uwcCanonical: row.alum_uwc_college,
    // Keep the "UWC " prefix on the card — matches /directory.
    campus: row.alum_uwc_college,
    gradYear: row.alum_grad_year,
    originIsos: extractCountryCodes(row.alum_origin),
    city: row.alum_current_city ? titleCase(row.alum_current_city) : null,
    moved: !!detectMovedFromBayArea(liveLoc),
    role: row.alum_current_title,
    company: row.alum_current_company,
    companyHref: linkedinHref(row.alum_current_company_linkedin),
    linkedinHref: linkedinHref(row.alum_linkedin_url),
  };
}

/**
 * Saved-shortlist grid. Each row renders the shared gallery card with
 * an outreach footer (status / reasons / note + saved date). Hidden
 * state + centralized undo toast survive optimistic unsaves.
 */
export default function SavedList({ allSaves, uwcLogos, flags }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<PendingUndo>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setVisible = (alumniId: number, saved: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (saved) next.delete(alumniId);
      else next.add(alumniId);
      return next;
    });
  };

  const flushPending = (entry: NonNullable<PendingUndo>) => {
    void fetch(`/api/directory/save?alumni_id=${entry.alumniId}`, {
      method: "DELETE",
    })
      .then(() => router.refresh())
      .catch(() => undefined);
  };

  const onUnsave = (
    alumniId: number,
    prev: { status: SaveStatus; reasons: SaveReason[]; note: string | null },
  ) => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      if (pending) flushPending(pending);
    }
    setPending({ alumniId, prev });
    undoTimer.current = setTimeout(() => {
      setPending((cur) => {
        if (cur && cur.alumniId === alumniId) {
          flushPending(cur);
          return null;
        }
        return cur;
      });
    }, 5000);
  };

  const onUndo = async () => {
    const entry = pending;
    if (!entry) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPending(null);
    setVisible(entry.alumniId, true);
    try {
      await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: entry.alumniId,
          status: entry.prev.status,
          reasons: entry.prev.reasons,
          note: entry.prev.note,
        }),
      });
      router.refresh();
    } catch {
      // best-effort
    }
  };

  const visibleSaves = allSaves.filter((s) => !hidden.has(s.alumni_id));

  if (visibleSaves.length === 0) {
    return (
      <>
        <p className="text-[17px] text-white/75 mt-3 mb-6">
          0 saved · personal to your account
        </p>
        <div className="bg-white/[.06] backdrop-blur-md border border-white/15 rounded-[18px] p-10 text-center text-white/70 text-sm">
          Nothing saved yet. Click the ★ on any profile to start.
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-[17px] text-white/75 mt-3 mb-7">
        {visibleSaves.length} saved · personal to your account
      </p>

      <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
        {visibleSaves.map((row) => {
          const alum = rowToAlumCard(row);
          return (
            <AlumGalleryCard
              key={row.id}
              alum={alum}
              uwcLogos={uwcLogos}
              flags={flags}
              backFrom="/directory/saved"
              photoHeight={220}
              star={
                <SaveStar
                  alumniId={row.alumni_id}
                  alumName={alum.displayName}
                  initial={{
                    status: row.status,
                    reasons: row.reasons,
                    note: row.note,
                  }}
                  canSave
                  onSavedChange={(saved) => setVisible(row.alumni_id, saved)}
                  onUnsave={(prev) => onUnsave(row.alumni_id, prev)}
                />
              }
              footer={
                <SavedOutreachFooter
                  alumniId={row.alumni_id}
                  initialStatus={row.status}
                  initialReasons={row.reasons}
                  initialNote={row.note}
                  createdAt={row.created_at}
                  updatedAt={row.updated_at}
                />
              }
            />
          );
        })}
      </div>

      {pending && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2 rounded-full shadow-lg text-sm whitespace-nowrap flex items-center gap-3"
        >
          Removed from your shortlist
          <button
            type="button"
            onClick={() => void onUndo()}
            className="font-bold uppercase tracking-[.18em] text-xs hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
