import Papa from "papaparse";
import { normalizeCollege, isPearson } from "./uwc-colleges";
import { parseGradYear } from "./gradyear";
import { cityToRegion } from "./region";

export type ImportRow = {
  submitted_at: Date | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string | null;
  origin: string | null;
  uwc_college: string | null;
  uwc_college_raw: string | null;
  grad_year: number | null;
  grad_year_raw: string | null;
  current_city: string | null;
  region: string | null;
  help_tags: string | null;
  national_committee: string | null;
  about: string | null;
  questions: string | null;
  studying: string | null;
  working: string | null;
  flags: string[];
};

export type ImportReport = {
  total: number;
  rowsWithEmail: number;
  parsedRows: ImportRow[];
  skipped: { rowIndex: number; reason: string }[];
};

const HEADER_MAP: Record<string, keyof ImportRow | "email_alt"> = {
  timestamp: "submitted_at",
  "first name": "first_name",
  "last name": "last_name",
  "where do you identify from": "origin",
  "which uwc": "uwc_college_raw",
  "graduation year": "grad_year_raw",
  "current location": "current_city",
  "email address (we will send": "email",
  "email address": "email_alt",
  "mobile number": "mobile",
  "how would you like to help": "help_tags",
  "national committee": "national_committee",
  "something about you": "about",
  "any questions": "questions",
  "are you studying": "studying",
  "are you working": "working",
};

function matchHeader(raw: string): keyof ImportRow | "email_alt" | null {
  const k = raw.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [needle, field] of Object.entries(HEADER_MAP)) {
    if (k.startsWith(needle)) return field;
  }
  return null;
}

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export function parseCsv(text: string): ImportReport {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length === 0) {
    return { total: 0, rowsWithEmail: 0, parsedRows: [], skipped: [] };
  }

  const headers = rows[0].map(matchHeader);
  const out: ImportRow[] = [];
  const skipped: { rowIndex: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rec: Partial<ImportRow> & { email_alt?: string | null } = {};
    for (let c = 0; c < headers.length; c++) {
      const field = headers[c];
      if (!field) continue;
      const val = s(row[c]);
      if (field === "submitted_at") {
        rec.submitted_at = val ? new Date(val) : null;
      } else if (field === "email_alt") {
        rec.email_alt = val;
      } else {
        // @ts-expect-error assigning dynamic field
        rec[field] = val;
      }
    }

    const email = rec.email || rec.email_alt || null;
    if (!email) {
      skipped.push({ rowIndex: i, reason: "no email" });
      continue;
    }

    const flags: string[] = [];
    const uwcCollege = normalizeCollege(rec.uwc_college_raw ?? null);
    if (rec.uwc_college_raw && !uwcCollege) flags.push("unknown_college");

    const gradYear = parseGradYear(rec.grad_year_raw ?? null, {
      pearson: isPearson(uwcCollege),
    });
    if (rec.grad_year_raw && gradYear == null) flags.push("unparsed_grad_year");

    out.push({
      submitted_at: rec.submitted_at ?? null,
      first_name: rec.first_name ?? null,
      last_name: rec.last_name ?? null,
      email: email.toLowerCase(),
      mobile: rec.mobile ?? null,
      origin: rec.origin ?? null,
      uwc_college: uwcCollege,
      uwc_college_raw: rec.uwc_college_raw ?? null,
      grad_year: gradYear,
      grad_year_raw: rec.grad_year_raw ?? null,
      current_city: rec.current_city ?? null,
      region: cityToRegion(rec.current_city ?? null),
      help_tags: rec.help_tags ?? null,
      national_committee: rec.national_committee ?? null,
      about: rec.about ?? null,
      questions: rec.questions ?? null,
      studying: rec.studying ?? null,
      working: rec.working ?? null,
      flags,
    });
  }

  return {
    total: rows.length - 1,
    rowsWithEmail: out.length,
    parsedRows: out,
    skipped,
  };
}
