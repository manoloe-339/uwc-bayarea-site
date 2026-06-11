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

/** Absolute "Jun 9" / "Jun 9, 2024" — concise, no relative weirdness. */
function fmtAbsDate(d: Date | string): string {
  const date = toDate(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function fmtFullTimestamp(d: Date | string): string {
  return toDate(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  const everUpdated = updatedDiffMs > 60_000;

  return (
    <li className="relative bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      {/* Star pinned to the top-right of the card, independent of the
          flex content below it. Inner content has pr-8 to leave room. */}
      <SaveStar
        alumniId={row.alumni_id}
        alumName={name}
        initial={{
          status: row.status,
          reason: row.reason,
          note: row.note,
        }}
        canSave={true}
        className="absolute top-1 right-1"
        onSavedChange={onSavedChange}
        onUnsave={onUnsave}
      />

      <div className="flex items-start gap-5 pr-10">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <Link
            href={`/directory/${row.alumni_id}`}
            className="block w-[110px] h-[110px] rounded-full overflow-hidden bg-[color:var(--ivory-2)] ring-[3px] ring-navy"
          >
            {row.alum_photo_url ? (
              <Image
                src={row.alum_photo_url}
                alt=""
                width={110}
                height={110}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)] text-2xl font-bold">
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
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-[28px] leading-none text-black"
                style={{ fontVariantEmoji: "emoji" }}
                aria-label={`From ${countryLabel}`}
              >
                {flag}
              </span>
              <span className="text-[11px] text-[color:var(--muted)] text-center max-w-[120px]">
                {countryLabel}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-[24px] sm:text-[26px] font-bold text-[color:var(--navy-ink)] leading-[1.1]">
            <Link
              href={`/directory/${row.alumni_id}`}
              title={name}
              className="hover:underline"
            >
              {name}
            </Link>
            {" "}
            {linkedin ? (
              <LinkedinIconLink
                href={linkedin}
                alumniId={row.alumni_id}
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] bg-[#0A66C2] text-white text-[11px] font-bold hover:brightness-110 leading-none align-middle"
              />
            ) : (
              <span
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] bg-[color:var(--ivory-2)] text-[color:var(--muted)] text-[11px] font-bold leading-none align-middle"
                title="No LinkedIn on file"
              >
                in
              </span>
            )}
          </h3>
          <div className="mt-2 space-y-1 text-[color:var(--navy-ink)]">
            {sub && (
              <div className="text-[15px] font-semibold leading-tight">
                {sub}
              </div>
            )}
            {cityDisplay && (
              <div className="text-sm text-[color:var(--muted)]">
                {cityDisplay}
              </div>
            )}
            {(row.alum_current_title || row.alum_current_company) && (
              <div className="flex items-center gap-3 pt-1.5">
                {row.alum_current_company && (
                  <CompanyLogo
                    storedLogoUrl={row.alum_current_company_logo_url}
                    website={row.alum_current_company_website}
                    linkedinUrl={row.alum_current_company_linkedin}
                    companyName={row.alum_current_company}
                    size={36}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {row.alum_current_title && (
                    <div
                      className="text-sm font-semibold line-clamp-1"
                      title={row.alum_current_title}
                    >
                      {row.alum_current_title}
                    </div>
                  )}
                  {row.alum_current_company && (
                    <div className="text-sm text-[color:var(--muted)] line-clamp-1">
                      {companyHref ? (
                        <a
                          href={companyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-[color:var(--navy-ink)]"
                        >
                          {row.alum_current_company}
                        </a>
                      ) : (
                        row.alum_current_company
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3">
            <SavedStatusSelect
              alumniId={row.alumni_id}
              initialStatus={row.status}
              reason={row.reason}
              note={row.note}
            />
          </div>

          <SavedReasonEditor
            alumniId={row.alumni_id}
            initialReason={row.reason}
            initialNote={row.note}
            status={row.status}
          />

          <div
            className="mt-3 text-[11px] text-[color:var(--muted)] text-right"
            title={`Saved ${fmtFullTimestamp(row.created_at)}\nLast updated ${fmtFullTimestamp(row.updated_at)}`}
          >
            Saved {fmtAbsDate(row.created_at)}
            {everUpdated && <> · Updated {fmtAbsDate(row.updated_at)}</>}
          </div>
        </div>
      </div>
    </li>
  );
}
