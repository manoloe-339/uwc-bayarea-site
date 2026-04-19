// Graduation year parser.
// Input is free text ("2018", "2018 (PC43)", "Class of 2020", "PC43", "Year 43", "33").
// Output is a 4-digit year or null. For Pearson-style input (PC##, Year ##, or
// a bare 1-2 digit number when the college is Pearson), 4-digit year = 1975 + N
// since Pearson's first graduating class was 1975.

const PEARSON_EPOCH = 1975;

export function parseGradYear(
  raw: string | null | undefined,
  opts: { pearson?: boolean } = {}
): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const maxYear = new Date().getFullYear() + 6;

  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const y = Number(yearMatch[0]);
    if (y >= 1960 && y <= maxYear) return y;
  }

  // Apostrophe-adjacent 2-digit years: '91 → 1991, 05' → 2005, '18 → 2018.
  // Require no adjacent digits on the far side so "10'6" doesn't spuriously match.
  const apostropheMatch = s.match(/(?<!\d)(?:'(\d{2})|(\d{2})')(?!\d)/);
  if (apostropheMatch) {
    const n = Number(apostropheMatch[1] ?? apostropheMatch[2]);
    const y = n <= 29 ? 2000 + n : 1900 + n;
    if (y >= 1960 && y <= maxYear) return y;
  }

  const pcMatch = s.match(/\b(?:PC|Year)\s*(\d{1,2})\b/i);
  if (pcMatch) {
    const y = PEARSON_EPOCH + Number(pcMatch[1]);
    if (y >= PEARSON_EPOCH && y <= maxYear) return y;
  }

  // Pearson alumni sometimes write just "33" meaning Year 33.
  if (opts.pearson) {
    const bare = s.match(/^\s*(\d{1,2})\s*$/);
    if (bare) {
      const y = PEARSON_EPOCH + Number(bare[1]);
      if (y >= PEARSON_EPOCH && y <= maxYear) return y;
    }
  }

  return null;
}
