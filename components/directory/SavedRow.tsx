"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { linkedinHref } from "@/lib/linkedin-url";
import SaveStar from "./SaveStar";
import SavedStatusSelect from "./SavedStatusSelect";
import SavedReasonEditor from "./SavedReasonEditor";
import type { SaveReason, SaveStatus } from "@/lib/directory-saves-shared";

interface RowData {
  id: number;
  alumni_id: number;
  status: SaveStatus;
  reason: SaveReason | null;
  note: string | null;
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
}

/** Client-side row for /directory/saved. Owns its own visibility so
 * clicking the SaveStar to unsave can collapse the row immediately
 * (with the 5-second UNDO toast restoring it on click). */
export default function SavedRow({ row }: { row: RowData }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const name =
    [row.alum_first_name, row.alum_last_name].filter(Boolean).join(" ") ||
    "(no name)";
  const sub = [row.alum_uwc_college, row.alum_grad_year]
    .filter(Boolean)
    .join(" · ");
  const linkedin = linkedinHref(row.alum_linkedin_url);
  const companyHref = linkedinHref(row.alum_current_company_linkedin);

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="flex items-start gap-3">
        <Link
          href={`/directory/${row.alumni_id}`}
          className="block shrink-0 w-[56px] h-[56px] rounded-full overflow-hidden bg-[color:var(--ivory-2)]"
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
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile"
                  title="LinkedIn Profile"
                  className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] text-white text-[9px] font-bold hover:brightness-110 leading-none"
                >
                  in
                </a>
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
                onSavedChange={(saved) => setVisible(saved)}
              />
            </div>
          </div>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">
            {sub}
            {row.alum_current_city && (
              <span>
                {sub ? " · " : ""}
                {row.alum_current_city}
              </span>
            )}
          </div>
          {(row.alum_current_title || row.alum_current_company) && (
            <div className="text-xs text-[color:var(--navy-ink)] mt-1">
              {row.alum_current_title}
              {row.alum_current_title && row.alum_current_company && " at "}
              {row.alum_current_company &&
                (companyHref ? (
                  <a
                    href={companyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {row.alum_current_company}
                  </a>
                ) : (
                  <span className="font-medium">
                    {row.alum_current_company}
                  </span>
                ))}
            </div>
          )}
          <SavedReasonEditor
            alumniId={row.alumni_id}
            initialReason={row.reason}
            initialNote={row.note}
            status={row.status}
          />
        </div>
      </div>
    </li>
  );
}
