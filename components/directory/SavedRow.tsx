"use client";

import Link from "next/link";
import Image from "next/image";
import { linkedinHref } from "@/lib/linkedin-url";
import { originFlagString, originCountryNames } from "@/lib/country-flag";
import { displayName, titleCase } from "@/lib/text-format";
import LinkedinIconLink from "./LinkedinIconLink";
import SaveStar from "./SaveStar";
import SavedStatusSelect from "./SavedStatusSelect";
import SavedReasonEditor from "./SavedReasonEditor";
import { CompanyLogo } from "./CompanyLogo";
import type { SaveReason, SaveStatus } from "@/lib/directory-saves-shared";

interface RowData {
  id: number;
  alumni_id: number;
  status: SaveStatus;
  reason: SaveReason | null;
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
  alum_current_company_website: string | null;
  alum_current_company_logo_url: string | null;
  alum_current_city: string | null;
  alum_photo_url: string | null;
  alum_linkedin_url: string | null;
  alum_origin: string | null;
}

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** "5d ago" / "2h ago" / "Just now" while within a week. Older →
 * absolute "Jun 2" / "Jun 2024". */
function fmtRel(d: Date | string): string {
  const date = toDate(d);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function fmtAbs(d: Date | string): string {
  return toDate(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Client-side row for /directory/saved. Visibility + undo are owned
 * by the parent SavedList (so the chip-bar counts stay in sync and
 * the undo toast survives the row unmount). */
export default function SavedRow({
  row,
  onSavedChange,
  onUnsave,
}: {
  row: RowData;
  onSavedChange?: (saved: boolean) => void;
  onUnsave?: (prev: {
    status: SaveStatus;
    reason: SaveReason | null;
    note: string | null;
  }) => void;
}) {
  const name = displayName(row.alum_first_name, row.alum_last_name);
  const sub = [row.alum_uwc_college, row.alum_grad_year]
    .filter(Boolean)
    .join(" · ");
  const cityDisplay = row.alum_current_city
    ? titleCase(row.alum_current_city)
    : null;
  const linkedin = linkedinHref(row.alum_linkedin_url);
  const companyHref = linkedinHref(row.alum_current_company_linkedin);
  const flag = row.alum_origin ? originFlagString(row.alum_origin) : "";
  const countryLabel = row.alum_origin
    ? originCountryNames(row.alum_origin) ?? row.alum_origin
    : "";

  const updatedDiffMs =
    toDate(row.updated_at).getTime() - toDate(row.created_at).getTime();
  // Treat updates within 60s of creation as "no real update yet".
  const everUpdated = updatedDiffMs > 60_000;

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex flex-col items-center gap-1">
          <Link
            href={`/directory/${row.alumni_id}`}
            className="block w-[56px] h-[56px] rounded-full overflow-hidden bg-[color:var(--ivory-2)]"
          >
            {row.alum_photo_url ? (
              <Image
                src={row.alum_photo_url}
                alt=""
                width={56}
                height={56}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)] text-xs">
                {name
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
          </Link>
          {flag && (
            <span
              className="text-[18px] leading-none text-black"
              style={{ fontVariantEmoji: "emoji" }}
              title={countryLabel}
              aria-label={`From ${countryLabel}`}
            >
              {flag}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/directory/${row.alumni_id}`}
                className="font-semibold text-[color:var(--navy-ink)] hover:underline"
              >
                {name}
              </Link>
              {linkedin ? (
                <LinkedinIconLink
                  href={linkedin}
                  alumniId={row.alumni_id}
                  className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] text-white text-[9px] font-bold hover:brightness-110 leading-none"
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[color:var(--ivory-2)] text-[color:var(--muted)] text-[9px] font-bold leading-none"
                  title="No LinkedIn on file"
                >
                  in
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SavedStatusSelect
                alumniId={row.alumni_id}
                initialStatus={row.status}
                reason={row.reason}
                note={row.note}
              />
              <SaveStar
                alumniId={row.alumni_id}
                alumName={name}
                initial={{
                  status: row.status,
                  reason: row.reason,
                  note: row.note,
                }}
                canSave={true}
                onSavedChange={onSavedChange}
                onUnsave={onUnsave}
              />
            </div>
          </div>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">
            {sub}
            {cityDisplay && (
              <span>
                {sub ? " · " : ""}
                {cityDisplay}
              </span>
            )}
          </div>
          {(row.alum_current_title || row.alum_current_company) && (
            <div className="mt-1 text-xs text-[color:var(--navy-ink)]">
              {row.alum_current_title && (
                <div className="line-clamp-1" title={row.alum_current_title}>
                  {row.alum_current_title}
                </div>
              )}
              {row.alum_current_company && (
                <div className="flex items-center gap-2 mt-0.5">
                  <CompanyLogo
                    storedLogoUrl={row.alum_current_company_logo_url}
                    website={row.alum_current_company_website}
                    linkedinUrl={row.alum_current_company_linkedin}
                    companyName={row.alum_current_company}
                    size={18}
                  />
                  {companyHref ? (
                    <a
                      href={companyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline line-clamp-1"
                    >
                      {row.alum_current_company}
                    </a>
                  ) : (
                    <span className="font-medium line-clamp-1">
                      {row.alum_current_company}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <SavedReasonEditor
            alumniId={row.alumni_id}
            initialReason={row.reason}
            initialNote={row.note}
            status={row.status}
          />
          <div
            className="mt-2 text-[11px] text-[color:var(--muted)] text-right"
            title={`Saved ${fmtAbs(row.created_at)}\nLast updated ${fmtAbs(row.updated_at)}`}
          >
            {everUpdated ? (
              <>
                Saved {fmtRel(row.created_at)} · Updated {fmtRel(row.updated_at)}
              </>
            ) : (
              <>Saved {fmtRel(row.created_at)}</>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
