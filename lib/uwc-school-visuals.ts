/**
 * Per-UWC-school visual identity for the check-in confirmation card.
 *
 * IMPORTANT: Tailwind only generates the CSS for class names that appear
 * as complete literal strings somewhere in the source. That's why we
 * spell the whole "from-X to-Y" combination here — building it dynamically
 * from fragments would produce empty styles. If you add a school, use
 * real Tailwind colour classes.
 */
export type UwcSchoolVisual = {
  /** `from-X to-Y` Tailwind gradient classes. */
  gradient: string;
  icon: string;
  flag: string;
  country: string;
};

export const UWC_SCHOOL_VISUALS: Record<string, UwcSchoolVisual> = {
  "UWC Atlantic College": { gradient: "from-blue-700 to-blue-900", icon: "🏰", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", country: "Wales" },
  "UWC Red Cross Nordic": { gradient: "from-red-600 to-red-800", icon: "❄️", flag: "🇳🇴", country: "Norway" },
  "UWC South East Asia": { gradient: "from-emerald-600 to-emerald-800", icon: "🌴", flag: "🇸🇬", country: "Singapore" },
  "UWC Pearson": { gradient: "from-sky-600 to-sky-800", icon: "🌊", flag: "🇨🇦", country: "Canada" },
  "UWC USA": { gradient: "from-amber-600 to-amber-800", icon: "🏜️", flag: "🇺🇸", country: "USA" },
  "UWC Adriatic": { gradient: "from-cyan-600 to-cyan-800", icon: "⛰️", flag: "🇮🇹", country: "Italy" },
  "UWC Mahindra": { gradient: "from-orange-600 to-orange-800", icon: "🐅", flag: "🇮🇳", country: "India" },
  "UWC Costa Rica": { gradient: "from-green-600 to-green-800", icon: "🦜", flag: "🇨🇷", country: "Costa Rica" },
  "UWC Waterford Kamhlaba": { gradient: "from-stone-600 to-stone-800", icon: "🦁", flag: "🇸🇿", country: "eSwatini" },
  "UWC Maastricht": { gradient: "from-indigo-600 to-indigo-800", icon: "🎨", flag: "🇳🇱", country: "Netherlands" },
  "UWC Li Po Chun": { gradient: "from-rose-600 to-rose-800", icon: "🏮", flag: "🇭🇰", country: "Hong Kong" },
  "UWC Mostar": { gradient: "from-teal-600 to-teal-800", icon: "🌉", flag: "🇧🇦", country: "Bosnia and Herzegovina" },
  "UWC Robert Bosch College": { gradient: "from-zinc-600 to-zinc-800", icon: "⚙️", flag: "🇩🇪", country: "Germany" },
  "UWC Dilijan": { gradient: "from-violet-600 to-violet-800", icon: "🏔️", flag: "🇦🇲", country: "Armenia" },
  "UWC Changshu": { gradient: "from-red-700 to-red-900", icon: "🐉", flag: "🇨🇳", country: "China" },
  "UWC ISAK Japan": { gradient: "from-pink-600 to-pink-800", icon: "🌸", flag: "🇯🇵", country: "Japan" },
  "UWC Thailand": { gradient: "from-yellow-600 to-yellow-800", icon: "🐘", flag: "🇹🇭", country: "Thailand" },
  "UWC East Africa": { gradient: "from-lime-600 to-lime-800", icon: "🌍", flag: "🇹🇿", country: "Tanzania" },
};

export const DEFAULT_SCHOOL_VISUAL: UwcSchoolVisual = {
  gradient: "from-slate-700 to-slate-900",
  icon: "🎓",
  flag: "",
  country: "",
};

export function getSchoolVisual(canonical: string | null | undefined): UwcSchoolVisual {
  if (!canonical) return DEFAULT_SCHOOL_VISUAL;
  return UWC_SCHOOL_VISUALS[canonical] ?? DEFAULT_SCHOOL_VISUAL;
}
