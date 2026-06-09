/**
 * Country name → flag emoji rendering.
 *
 * `origin` is free-text the alum entered or admins corrected, so it
 * ranges from "USA" to "I was born in India, lived in Singapore for 10
 * years and in Indonesia for 2 years…". We tokenize on common
 * separators, look each token up in a static name → ISO-2 map (with
 * common aliases), and return up to 3 flag emojis. Unmatched tokens
 * silently get no flag — the original text is still displayed.
 *
 * Flag emoji is the unicode regional-indicator pair: e.g. "US" →
 * 🇺🇸 (U+1F1FA U+1F1F8). All modern OSes render it natively.
 */

const NAME_TO_ISO2_RAW: Record<string, string> = {
  // Common variants kept lowercase. Add entries as new origins appear.
  "afghanistan": "AF",
  "albania": "AL",
  "algeria": "DZ",
  "argentina": "AR",
  "armenia": "AM",
  "australia": "AU",
  "austria": "AT",
  "azerbaijan": "AZ",
  "bangladesh": "BD",
  "barbados": "BB",
  "belarus": "BY",
  "belgium": "BE",
  "bermuda": "BM",
  "bhutan": "BT",
  "bolivia": "BO",
  "bosnia": "BA",
  "bosnia and herzegovina": "BA",
  "botswana": "BW",
  "brazil": "BR",
  "bulgaria": "BG",
  "burma": "MM",
  "myanmar": "MM",
  "cambodia": "KH",
  "cameroon": "CM",
  "canada": "CA",
  "cayman islands": "KY",
  "chile": "CL",
  "china": "CN",
  "colombia": "CO",
  "costa rica": "CR",
  "croatia": "HR",
  "cuba": "CU",
  "cyprus": "CY",
  "czechia": "CZ",
  "czech republic": "CZ",
  "denmark": "DK",
  "dominican republic": "DO",
  "ecuador": "EC",
  "egypt": "EG",
  "el salvador": "SV",
  "eritrea": "ER",
  "estonia": "EE",
  "eswatini": "SZ",
  "swaziland": "SZ",
  "ethiopia": "ET",
  "finland": "FI",
  "france": "FR",
  "french": "FR",
  "georgia": "GE",
  "germany": "DE",
  "german": "DE",
  "ghana": "GH",
  "greece": "GR",
  "guatemala": "GT",
  "haiti": "HT",
  "honduras": "HN",
  "hong kong": "HK",
  "hungary": "HU",
  "iceland": "IS",
  "india": "IN",
  "indian": "IN",
  "indonesia": "ID",
  "iran": "IR",
  "iraq": "IQ",
  "ireland": "IE",
  "irish": "IE",
  "israel": "IL",
  "italy": "IT",
  "it": "IT", // matches "Biella, IT" tokens; risky but rare
  "italian": "IT",
  "ivory coast": "CI",
  "côte d'ivoire": "CI",
  "cote d'ivoire": "CI",
  "jamaica": "JM",
  "japan": "JP",
  "japanese": "JP",
  "jordan": "JO",
  "kazakhstan": "KZ",
  "kenya": "KE",
  "korea": "KR", // ambiguous — defaults to South
  "south korea": "KR",
  "north korea": "KP",
  "kosovo": "XK",
  "kyrgyzstan": "KG",
  "laos": "LA",
  "latvia": "LV",
  "lebanon": "LB",
  "lesotho": "LS",
  "liberia": "LR",
  "libya": "LY",
  "lithuania": "LT",
  "luxembourg": "LU",
  "macedonia": "MK",
  "north macedonia": "MK",
  "madagascar": "MG",
  "malawi": "MW",
  "malaysia": "MY",
  "maldives": "MV",
  "mali": "ML",
  "malta": "MT",
  "mauritius": "MU",
  "mexico": "MX",
  "mexican": "MX",
  "moldova": "MD",
  "monaco": "MC",
  "mongolia": "MN",
  "montenegro": "ME",
  "morocco": "MA",
  "mozambique": "MZ",
  "namibia": "NA",
  "nepal": "NP",
  "netherlands": "NL",
  "the netherlands": "NL",
  "holland": "NL",
  "dutch": "NL",
  "new zealand": "NZ",
  "nicaragua": "NI",
  "niger": "NE",
  "niger republic": "NE",
  "nigeria": "NG",
  "norway": "NO",
  "norwegian": "NO",
  "oman": "OM",
  "pakistan": "PK",
  "palestine": "PS",
  "panama": "PA",
  "paraguay": "PY",
  "peru": "PE",
  "philippines": "PH",
  "poland": "PL",
  "polish": "PL",
  "portugal": "PT",
  "qatar": "QA",
  "romania": "RO",
  "russia": "RU",
  "russian": "RU",
  "rwanda": "RW",
  "saudi arabia": "SA",
  "senegal": "SN",
  "serbia": "RS",
  "sierra leone": "SL",
  "singapore": "SG",
  "sg": "SG",
  "slovakia": "SK",
  "slovenia": "SI",
  "south africa": "ZA",
  "south sudan": "SS",
  "spain": "ES",
  "spanish": "ES",
  "sri lanka": "LK",
  "sudan": "SD",
  "sweden": "SE",
  "swedish": "SE",
  "switzerland": "CH",
  "swiss": "CH",
  "syria": "SY",
  "taiwan": "TW",
  "tajikistan": "TJ",
  "tanzania": "TZ",
  "thailand": "TH",
  "thai": "TH",
  "togo": "TG",
  "tunisia": "TN",
  "turkey": "TR",
  "türkiye": "TR",
  "turkiye": "TR",
  "uganda": "UG",
  "ukraine": "UA",
  "uae": "AE",
  "united arab emirates": "AE",
  "dubai": "AE",
  "uk": "GB",
  "u.k.": "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  "britain": "GB",
  "england": "GB",
  "scotland": "GB",
  "wales": "GB",
  "northern ireland": "GB",
  "london": "GB",
  "usa": "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "us": "US",
  "u s a": "US",
  "united states": "US",
  "america": "US",
  "american": "US",
  // US states that show up in our data — fold them into US.
  "california": "US",
  "ca": "US",
  "massachusetts": "US",
  "ma": "US",
  "new mexico": "US",
  "new york": "US",
  "ny": "US",
  // Common cities that show up alone (only mapping ones unambiguously in DB).
  "tokyo": "JP",
  "shanghai": "CN",
  "montreal": "CA",
  "toronto": "CA",
  "vancouver": "CA",
  "san francisco": "US",
  "berkeley": "US",
  "biella": "IT",
  "hawaii": "US",
  "uruguay": "UY",
  "venezuela": "VE",
  "vietnam": "VN",
  "yemen": "YE",
  "zambia": "ZM",
  "zimbabwe": "ZW",
};

/** Normalize a token: trim, lowercase, collapse internal whitespace. */
function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Convert ISO-2 → 🇺🇸-style flag emoji. */
function flagEmoji(iso2: string): string {
  const A = 127397; // 0x1F1A5 — regional indicator A is 0x1F1E6 = 65 (A) + 127397
  const cps = iso2
    .toUpperCase()
    .split("")
    .map((c) => A + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

/**
 * Pull country tokens out of a messy origin string and return up to N
 * ISO-2 codes, in source order, no duplicates. Returns [] if nothing
 * recognized.
 */
export function extractCountryCodes(origin: string | null | undefined, max = 3): string[] {
  if (!origin) return [];
  const cleaned = origin
    // Drop parens
    .replace(/[()]/g, " ")
    // Drop common noise prefixes/suffixes that get attached
    .replace(/\?/g, " ");
  // Split on /, comma, ampersand, " and ", " - ", em/en dashes
  const rawTokens = cleaned.split(/\s*[\/,;&]\s*|\s+and\s+|\s+-\s+|\s+–\s+|\s+—\s+/i);
  const found: string[] = [];
  for (const t of rawTokens) {
    const key = norm(t);
    if (!key) continue;
    // Direct match
    let iso = NAME_TO_ISO2_RAW[key];
    if (!iso) {
      // Strip leading articles or common adjectives
      const stripped = key.replace(/^(the|in|now)\s+/, "");
      iso = NAME_TO_ISO2_RAW[stripped];
    }
    if (!iso) {
      // Last resort: scan for any known country name as a substring.
      // Walk longest-first to prefer "south korea" over "korea".
      const hit = LONGEST_FIRST_NAMES.find((n) => key.includes(n));
      if (hit) iso = NAME_TO_ISO2_RAW[hit];
    }
    if (iso && !found.includes(iso)) {
      found.push(iso);
      if (found.length >= max) break;
    }
  }
  return found;
}

const LONGEST_FIRST_NAMES = Object.keys(NAME_TO_ISO2_RAW).sort(
  (a, b) => b.length - a.length,
);

/**
 * Render origin string as a space-separated flag string. Returns "" if
 * no country could be identified.
 */
export function originFlagString(origin: string | null | undefined, max = 3): string {
  const isos = extractCountryCodes(origin, max);
  return isos.map(flagEmoji).join(" ");
}

/** Manual overrides where Intl.DisplayNames would return a long-form
 * we don't want (e.g. "United States" → "USA"), or where the demonym
 * doesn't map to a country code Intl recognizes. */
const ISO_DISPLAY_OVERRIDES: Record<string, string> = {
  US: "USA",
  GB: "UK",
  AE: "UAE",
  // Intl knows "Netherlands" already, but listed here for clarity:
  NL: "Netherlands",
};

let regionFormatter: Intl.DisplayNames | null = null;
function regionName(iso2: string): string {
  if (ISO_DISPLAY_OVERRIDES[iso2]) return ISO_DISPLAY_OVERRIDES[iso2];
  if (!regionFormatter) {
    try {
      regionFormatter = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return iso2;
    }
  }
  return regionFormatter.of(iso2) ?? iso2;
}

/** Country names (joined " / " when multiple), normalized from messy
 * origin strings. "Dutch" → "Netherlands"; "Brazil/France" → "Brazil /
 * France". Returns null if no country was recognized — caller should
 * fall back to the raw origin text. */
export function originCountryNames(
  origin: string | null | undefined,
  max = 3,
): string | null {
  const isos = extractCountryCodes(origin, max);
  if (isos.length === 0) return null;
  return isos.map(regionName).join(" / ");
}
