import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const path = "/Users/manoloespinosa/Downloads/UWCx Responses - UWC interested alums in SF.csv";
const text = readFileSync(path, "utf8");
const { data } = Papa.parse(text.trim(), { skipEmptyLines: "greedy" });

const header = data[0];
console.log("Columns:", header);
console.log("Total rows:", data.length - 1);

const rows = data.slice(1).filter((r) => r.some((c) => String(c).trim()));
console.log("Non-empty rows:", rows.length);

const emailIdx = header.findIndex((h) => h.toLowerCase() === "email");
const firstIdx = header.findIndex((h) => h.toLowerCase() === "first name");
const lastIdx = header.findIndex((h) => h.toLowerCase() === "last name");
const affilIdx = header.findIndex((h) => h.toLowerCase().includes("affiliation"));
const removeIdx = header.findIndex((h) => h.toLowerCase() === "remove");
const attendedIdx = header.findIndex((h) => h.toLowerCase() === "attended");
const uwcxListIdx = header.findIndex((h) => h.toLowerCase() === "uwcx list");
const yearIdx = header.findIndex((h) => h.toLowerCase() === "year");
const ncIdx = header.findIndex((h) => h.toLowerCase() === "nc");
const companyIdx = header.findIndex((h) => h.toLowerCase() === "company");
const collegeIdx = header.findIndex((h) => h.toLowerCase().includes("which uwc"));

const newRows = rows.map((r) => ({
  email: (r[emailIdx] || "").toLowerCase().trim(),
  first: (r[firstIdx] || "").trim(),
  last: (r[lastIdx] || "").trim(),
  affiliation: (r[affilIdx] || "").trim(),
  remove: (r[removeIdx] || "").trim().toLowerCase() === "x",
  attended: (r[attendedIdx] || "").trim().toLowerCase() === "x",
  uwcxList: (r[uwcxListIdx] || "").trim().toLowerCase() === "x",
  year: (r[yearIdx] || "").trim(),
  nc: (r[ncIdx] || "").trim(),
  company: (r[companyIdx] || "").trim(),
  college: (r[collegeIdx] || "").trim(),
}));

const withEmail = newRows.filter((r) => r.email);
const withoutEmail = newRows.filter((r) => !r.email);
const markedRemove = newRows.filter((r) => r.remove);
const markedOnUwcxList = newRows.filter((r) => r.uwcxList);
const markedAttended = newRows.filter((r) => r.attended);
const friends = newRows.filter((r) => r.affiliation.toLowerCase().includes("friend"));

console.log("\nRow counts:");
console.log(`  With email:          ${withEmail.length}`);
console.log(`  Without email:       ${withoutEmail.length}`);
console.log(`  Remove = x:          ${markedRemove.length}`);
console.log(`  Already on UWCx:     ${markedOnUwcxList.length}`);
console.log(`  Attended = x:        ${markedAttended.length}`);
console.log(`  "Friend" affiliation: ${friends.length}`);

const emails = withEmail.map((r) => r.email);
const existing = await sql.query(
  `SELECT email FROM alumni WHERE email = ANY($1)`,
  [emails]
);
const existingSet = new Set(existing.map((r) => r.email));
const overlapping = withEmail.filter((r) => existingSet.has(r.email));
const brandNew = withEmail.filter((r) => !existingSet.has(r.email));
console.log(`\nEmail overlap with existing DB:`);
console.log(`  Already in DB: ${overlapping.length}`);
console.log(`  Brand new:     ${brandNew.length}`);

// Potential duplicates by name (among brand-new by email)
const byNameDB = await sql.query(
  `SELECT email, lower(first_name) AS f, lower(last_name) AS l, uwc_college, grad_year
   FROM alumni WHERE first_name IS NOT NULL AND last_name IS NOT NULL`
);
const nameKey = (f, l) => `${(f || "").toLowerCase()}|${(l || "").toLowerCase()}`;
const dbByName = new Map();
for (const r of byNameDB) dbByName.set(nameKey(r.f, r.l), r);

const possibleDupes = [];
for (const r of brandNew) {
  const hit = dbByName.get(nameKey(r.first, r.last));
  if (hit) possibleDupes.push({ newEmail: r.email, existingEmail: hit.email, first: r.first, last: r.last });
}
console.log(`\nPossible duplicates by name (different emails): ${possibleDupes.length}`);
for (const d of possibleDupes.slice(0, 15)) {
  console.log(`  ${d.first} ${d.last}: new=${d.newEmail}  existing=${d.existingEmail}`);
}

// Distinct NC values
const ncVals = [...new Set(newRows.map((r) => r.nc).filter(Boolean))];
console.log(`\nDistinct NC values (${ncVals.length}):`);
console.log("  " + ncVals.join(" | "));

// Distinct affiliation values
const affilVals = [...new Set(newRows.map((r) => r.affiliation).filter(Boolean))];
console.log(`\nDistinct affiliation values:`, affilVals);

// Years
const years = newRows.map((r) => r.year).filter(Boolean);
console.log(`\nYear samples:`, years.slice(0, 10));

// Companies
const companies = newRows.map((r) => r.company).filter(Boolean);
console.log(`\nCompany values present on ${companies.length} rows. Samples:`, companies.slice(0, 10));
