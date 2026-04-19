import Papa from "papaparse";
import { normalizeCollege, isPearson } from "./uwc-colleges";
import { parseGradYear } from "./gradyear";
import { cityToRegion } from "./region";
import { normalizeNC } from "./nc-normalizer";

export type SfPubLibRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  affiliation: string | null;
  uwc_college: string | null;
  uwc_college_raw: string | null;
  grad_year: number | null;
  grad_year_raw: string | null;
  nc_raw: string | null;
  origin: string | null;   // derived from NC
  region: string | null;   // from a city column if present; usually null here
  company: string | null;
  attended_event: boolean;
  uwcx_list: boolean;
  flags: string[];
};

export type SfPubLibReport = {
  total: number;
  parsed: SfPubLibRow[];
  skipped: { rowIndex: number; reason: string }[];
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export function parseSfPubLibCsv(text: string): SfPubLibReport {
  const { data } = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
  if (data.length < 2) return { total: 0, parsed: [], skipped: [] };

  const header = data[0].map((h) => h.toLowerCase().trim());
  const ix = {
    attended: header.findIndex((h) => h === "attended"),
    uwcxList: header.findIndex((h) => h === "uwcx list"),
    remove: header.findIndex((h) => h === "remove"),
    first: header.findIndex((h) => h === "first name"),
    last: header.findIndex((h) => h === "last name"),
    email: header.findIndex((h) => h === "email"),
    affiliation: header.findIndex((h) => h.includes("affiliation")),
    college: header.findIndex((h) => h.includes("which uwc")),
    year: header.findIndex((h) => h === "year"),
    nc: header.findIndex((h) => h === "nc"),
    company: header.findIndex((h) => h === "company"),
  };

  const out: SfPubLibRow[] = [];
  const skipped: { rowIndex: number; reason: string }[] = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r.some((c) => String(c).trim())) continue;

    const removeFlag = (s(r[ix.remove]) || "").toLowerCase() === "x";
    if (removeFlag) {
      skipped.push({ rowIndex: i, reason: "marked Remove" });
      continue;
    }

    const email = s(r[ix.email]);
    if (!email) {
      skipped.push({ rowIndex: i, reason: "no email" });
      continue;
    }

    const flags: string[] = [];

    const uwcCollegeRaw = s(r[ix.college]);
    const uwcCollege = normalizeCollege(uwcCollegeRaw);
    if (uwcCollegeRaw && !uwcCollege) flags.push("unknown_college");

    const gradYearRaw = s(r[ix.year]);
    const gradYear = parseGradYear(gradYearRaw, { pearson: isPearson(uwcCollege) });
    if (gradYearRaw && gradYear == null) flags.push("unparsed_grad_year");

    const ncRaw = s(r[ix.nc]);
    const { country: origin, flag: ncFlag } = normalizeNC(ncRaw);
    if (ncFlag) flags.push(ncFlag);

    out.push({
      email: email.toLowerCase(),
      first_name: s(r[ix.first]),
      last_name: s(r[ix.last]),
      affiliation: s(r[ix.affiliation]),
      uwc_college: uwcCollege,
      uwc_college_raw: uwcCollegeRaw,
      grad_year: gradYear,
      grad_year_raw: gradYearRaw,
      nc_raw: ncRaw,
      origin,
      region: null,
      company: s(r[ix.company]),
      attended_event: (s(r[ix.attended]) || "").toLowerCase() === "x",
      uwcx_list: (s(r[ix.uwcxList]) || "").toLowerCase() === "x",
      flags,
    });
  }

  return { total: data.length - 1, parsed: out, skipped };
}
