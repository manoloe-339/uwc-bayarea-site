"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  DirectoryFilters,
  DirectoryWorkScope,
  DirectoryCompanySizeBand,
  DirectoryExpBand,
} from "@/lib/directory-query";
import type { DirectorySuggestData } from "@/lib/directory-suggest";
import { COLLEGES } from "@/lib/uwc-colleges";
import { Icon, type IconName } from "./Icon";

/** Shape of all the textual filter values the chips edit. Number-typed
 * fields (gradFrom, gradTo) are still held as strings in the working
 * copy so the popover's `<input>` can stay clean and the value can be
 * incremental ("20" before they type "2020"). */
type Working = {
  q: string;
  college: string;
  city: string;
  origin: string;
  university: string;
  company: string;
  industry: string;
  companySizeBand: string;
  expBand: string;
  gradFrom: string;
  gradTo: string;
  nl: boolean;
  scope: DirectoryWorkScope;
};

interface Props {
  filters: DirectoryFilters;
  /** True when the URL had `nl=1`. */
  initialNl: boolean;
  /** Currently filtered count (the `N of M` in the status line). */
  total: number;
  /** Total alumni in the directory (the `M`). */
  grandTotal: number;
  suggest: DirectorySuggestData;
}

/** Currency for the popovers. Personal = match literally. Work =
 * scoped by the Current/Ever toggle. The id lines up with the
 * DirectoryFilters field name (or a hand-fixed alias for grad year). */
const PERSONAL_CHIPS = [
  { id: "college", icon: "globe", label: "UWC", type: "select" } as const,
  {
    id: "gradYear",
    icon: "calendar",
    label: "UWC grad year",
    type: "range",
  } as const,
  {
    id: "city",
    icon: "map-pin",
    label: "Location",
    type: "text",
    placeholder: "City or region",
    sugKey: "cities",
  } as const,
  {
    id: "origin",
    icon: "users",
    label: "Origin",
    type: "text",
    placeholder: "Country of origin",
    sugKey: "countries",
  } as const,
  {
    id: "university",
    icon: "graduation-cap",
    label: "University",
    type: "text",
    placeholder: "e.g. Stanford",
    sugKey: "universities",
  } as const,
];

const WORK_CHIPS = [
  {
    id: "company",
    icon: "building",
    label: "Company",
    type: "text",
    placeholder: "e.g. Stripe",
    sugKey: "companies",
  } as const,
  {
    id: "industry",
    icon: "briefcase",
    label: "Industry",
    type: "select-industry",
  } as const,
  {
    id: "companySizeBand",
    icon: "users",
    label: "Company size",
    type: "select-size",
  } as const,
  {
    id: "expBand",
    icon: "clock",
    label: "Seniority",
    type: "select-exp",
  } as const,
];

const SIZE_OPTS: Array<{ value: DirectoryCompanySizeBand; label: string }> = [
  { value: "startup", label: "Startup (1–50)" },
  { value: "small", label: "Small (51–500)" },
  { value: "mid", label: "Mid (501–5K)" },
  { value: "large", label: "Large (5K–50K)" },
  { value: "enterprise", label: "Enterprise (50K+)" },
];

const EXP_OPTS: Array<{ value: DirectoryExpBand; label: string }> = [
  { value: "0-3", label: "0–3 yrs (early)" },
  { value: "3-7", label: "3–7 yrs" },
  { value: "7-15", label: "7–15 yrs" },
  { value: "15+", label: "15+ yrs (senior)" },
];

function gradLabel(from: string, to: string): string {
  if (from && to) return `${from}–${to}`;
  if (from) return `${from}+`;
  if (to) return `–${to}`;
  return "";
}

export default function DirectorySearch({
  filters,
  initialNl,
  total,
  grandTotal,
  suggest,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const initial: Working = useMemo(
    () => ({
      q: filters.q ?? "",
      college: filters.college ?? "",
      city: filters.city ?? "",
      origin: filters.origin ?? "",
      university: filters.university ?? "",
      company: filters.company ?? "",
      industry: filters.industry ?? "",
      companySizeBand: filters.companySizeBand ?? "",
      expBand: filters.expBand ?? "",
      gradFrom: filters.yearFrom != null ? String(filters.yearFrom) : "",
      gradTo: filters.yearTo != null ? String(filters.yearTo) : "",
      nl: initialNl,
      scope: filters.scope === "ever" ? "ever" : "current",
    }),
    [filters, initialNl],
  );

  const [working, setWorking] = useState<Working>(initial);
  const [open, setOpen] = useState<string | null>(null);

  // Keep the working copy in sync if the URL changes from elsewhere
  // (e.g. clicking a filter link in a card).
  useEffect(() => {
    setWorking(initial);
  }, [initial]);

  const pushUrl = (next: Working) => {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.college) params.set("college", next.college);
    if (next.city.trim()) params.set("city", next.city.trim());
    if (next.origin.trim()) params.set("origin", next.origin.trim());
    if (next.university.trim())
      params.set("university", next.university.trim());
    if (next.company.trim()) params.set("company", next.company.trim());
    if (next.industry) params.set("industry", next.industry);
    if (next.companySizeBand)
      params.set("companySizeBand", next.companySizeBand);
    if (next.expBand) params.set("expBand", next.expBand);
    if (next.gradFrom.trim()) params.set("yearFrom", next.gradFrom.trim());
    if (next.gradTo.trim()) params.set("yearTo", next.gradTo.trim());
    if (next.nl) params.set("nl", "1");
    if (next.scope === "ever") params.set("scope", "ever");
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.push(url));
  };

  // Debounce URL pushes for text inputs so we don't fire on every
  // keystroke; chip selects / clears / scope toggle commit immediately.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyDebounced = (next: Working) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushUrl(next), 280);
  };
  const applyNow = (next: Working) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushUrl(next);
  };

  const setField = <K extends keyof Working>(
    key: K,
    val: Working[K],
    mode: "now" | "debounced" = "now",
  ) => {
    setWorking((prev) => {
      const next = { ...prev, [key]: val };
      if (mode === "now") applyNow(next);
      else applyDebounced(next);
      return next;
    });
  };

  const clearAll = () => {
    const next: Working = {
      q: "",
      college: "",
      city: "",
      origin: "",
      university: "",
      company: "",
      industry: "",
      companySizeBand: "",
      expBand: "",
      gradFrom: "",
      gradTo: "",
      nl: false,
      scope: "current",
    };
    setWorking(next);
    applyNow(next);
  };

  const anyFilter =
    !!working.q ||
    !!working.college ||
    !!working.city ||
    !!working.origin ||
    !!working.university ||
    !!working.company ||
    !!working.industry ||
    !!working.companySizeBand ||
    !!working.expBand ||
    !!working.gradFrom ||
    !!working.gradTo;

  const workActive =
    !!working.company ||
    !!working.industry ||
    !!working.companySizeBand ||
    !!working.expBand;

  // Chip value resolver for display.
  const chipValue = (id: string): string => {
    switch (id) {
      case "college":
        return COLLEGES.find((c) => c.canonical === working.college)?.short ??
          working.college;
      case "city":
        return working.city;
      case "origin":
        return working.origin;
      case "university":
        return working.university;
      case "company":
        return working.company;
      case "industry":
        return working.industry;
      case "companySizeBand":
        return (
          SIZE_OPTS.find((o) => o.value === working.companySizeBand)?.label ??
          ""
        );
      case "expBand":
        return (
          EXP_OPTS.find((o) => o.value === working.expBand)?.label ?? ""
        );
      case "gradYear":
        return gradLabel(working.gradFrom, working.gradTo);
      default:
        return "";
    }
  };
  const chipActive = (id: string): boolean => !!chipValue(id);

  return (
    <div className="mb-[30px]">
      <SearchHero
        value={working.q}
        nl={working.nl}
        onQueryChange={(v) => setField("q", v, "debounced")}
        onNlChange={(v) => setField("nl", v)}
      />

      <div className="filterbar2 mt-4 flex flex-wrap items-center gap-[10px] sm:flex-wrap sm:overflow-visible overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-wrap items-center gap-[10px] sm:flex-wrap flex-nowrap">
          {PERSONAL_CHIPS.map((c) => (
            <FilterChip
              key={c.id}
              cfg={c}
              value={chipValue(c.id)}
              active={chipActive(c.id)}
              open={open === c.id}
              setOpen={(v) => setOpen(v ? c.id : null)}
              working={working}
              setField={setField}
              suggest={suggest}
            />
          ))}
        </div>

        <div className="hidden sm:block w-px self-stretch min-h-[26px] bg-[color:rgba(255,255,255,.2)] mx-1" />

        <div className="flex flex-wrap items-center gap-[10px] sm:flex-wrap flex-nowrap">
          <span className="hidden sm:inline-flex items-center gap-[7px] text-[11px] font-bold tracking-[.22em] uppercase text-white/65 px-[2px]">
            <Icon name="briefcase" size={13} />
            Work
          </span>
          <ScopeToggle
            value={working.scope}
            onChange={(v) => setField("scope", v)}
          />
          {WORK_CHIPS.map((c) => (
            <FilterChip
              key={c.id}
              cfg={c}
              value={chipValue(c.id)}
              active={chipActive(c.id)}
              open={open === c.id}
              setOpen={(v) => setOpen(v ? c.id : null)}
              working={working}
              setField={setField}
              suggest={suggest}
            />
          ))}
        </div>
      </div>

      <div className="mt-[18px] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-[14px] flex-wrap">
          <span className="text-[15px] text-white/75">
            {anyFilter ? (
              <>
                <b className="text-white">{total}</b> of {grandTotal} alumni
              </>
            ) : (
              <>
                <b className="text-white">{grandTotal}</b> alumni
              </>
            )}
          </span>
          {anyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[15px] text-white/75 hover:text-white"
            >
              Clear all
            </button>
          )}
        </div>
        {workActive && (
          <span className="inline-flex items-center gap-[7px] text-[13px] text-white/65">
            <Icon
              name={working.scope === "ever" ? "globe" : "clock"}
              size={13}
            />
            {working.scope === "ever"
              ? "Matching anyone who ever held these roles"
              : "Matching current roles only"}
          </span>
        )}
      </div>
    </div>
  );
}

function SearchHero({
  value,
  nl,
  onQueryChange,
  onNlChange,
}: {
  value: string;
  nl: boolean;
  onQueryChange: (v: string) => void;
  onNlChange: (v: boolean) => void;
}) {
  return (
    <div
      className="relative flex items-center gap-[14px] rounded-[14px] px-[18px] pr-2 transition-colors"
      style={{
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.2)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.12), 0 26px 54px -30px rgba(0,0,0,.6)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
      }}
    >
      <span className="text-white shrink-0 inline-flex">
        <Icon name="search" size={22} strokeWidth={2} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={
          nl
            ? "Ask anything — “designers in climate who left Google”"
            : "Search by name, company, school, or country"
        }
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-[17px] sm:text-[19px] py-[19px] placeholder:text-white/55"
      />
      <button
        type="button"
        onClick={() => onNlChange(!nl)}
        aria-pressed={nl}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full px-[14px] py-[9px] text-[13px] font-semibold transition ${
          nl
            ? "bg-white text-navy border border-white"
            : "bg-white/[.08] text-white/85 border border-white/30 hover:border-white/60 hover:text-white"
        }`}
      >
        <span
          className="w-[7px] h-[7px] rounded-full bg-current"
          style={{ opacity: nl ? 1 : 0.45 }}
        />
        <span className="hidden sm:inline whitespace-nowrap">
          Natural language
        </span>
      </button>
    </div>
  );
}

function ScopeToggle({
  value,
  onChange,
}: {
  value: DirectoryWorkScope;
  onChange: (v: DirectoryWorkScope) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Match work against"
      className="inline-flex items-center gap-[2px] rounded-full p-[3px] bg-white/10"
    >
      {(["current", "ever"] as DirectoryWorkScope[]).map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(v)}
            className={`inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[13px] font-semibold transition ${
              on
                ? "bg-white text-navy shadow-[0_1px_3px_rgba(11,37,69,.18)]"
                : "text-white/75 hover:text-white"
            }`}
          >
            <Icon name={v === "ever" ? "globe" : "clock"} size={14} />
            {v === "ever" ? "Ever" : "Current"}
          </button>
        );
      })}
    </div>
  );
}

type ChipCfg =
  | (typeof PERSONAL_CHIPS)[number]
  | (typeof WORK_CHIPS)[number];

function FilterChip({
  cfg,
  value,
  active,
  open,
  setOpen,
  working,
  setField,
  suggest,
}: {
  cfg: ChipCfg;
  value: string;
  active: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  working: Working;
  setField: <K extends keyof Working>(
    key: K,
    v: Working[K],
    mode?: "now" | "debounced",
  ) => void;
  suggest: DirectorySuggestData;
}) {
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cfg.id === "gradYear") {
      setField("gradFrom", "");
      setField("gradTo", "");
    } else {
      setField(cfg.id as keyof Working, "" as never);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-[14px] py-[9px] text-[14px] font-semibold transition ${
          active
            ? "bg-white border border-white text-navy pr-2"
            : "bg-white/[.08] border border-white/25 text-white hover:border-white/50"
        }`}
        style={
          active
            ? undefined
            : {
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }
        }
      >
        <span
          className={`inline-flex ${
            active ? "text-navy" : "text-white/75"
          }`}
        >
          <Icon name={cfg.icon as IconName} size={15} />
        </span>
        <span>{active ? value : cfg.label}</span>
        {active ? (
          <span
            role="button"
            aria-label={`Clear ${cfg.label}`}
            onClick={clear}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full ml-[2px] text-navy/55 hover:bg-navy/10 hover:text-navy"
          >
            <Icon name="x" size={13} strokeWidth={2.2} />
          </span>
        ) : (
          <span
            className={`inline-flex transition-transform ${
              open ? "rotate-180" : ""
            } text-white/60`}
          >
            <Icon name="chevron-down" size={14} strokeWidth={2.2} />
          </span>
        )}
      </button>

      {open && (
        <Popover onClose={() => setOpen(false)} label={cfg.label}>
          <ChipBody
            cfg={cfg}
            working={working}
            setField={setField}
            suggest={suggest}
            onCommit={() => setOpen(false)}
          />
        </Popover>
      )}
    </div>
  );
}

function ChipBody({
  cfg,
  working,
  setField,
  suggest,
  onCommit,
}: {
  cfg: ChipCfg;
  working: Working;
  setField: <K extends keyof Working>(
    key: K,
    v: Working[K],
    mode?: "now" | "debounced",
  ) => void;
  suggest: DirectorySuggestData;
  onCommit: () => void;
}) {
  if (cfg.type === "select") {
    // Hard-coded for "college" today; the only select-type personal chip.
    return (
      <OptionList
        options={COLLEGES.map((c) => ({
          value: c.canonical,
          label: c.short,
        }))}
        selected={working.college}
        onSelect={(v) => {
          setField("college", v === working.college ? "" : v);
          onCommit();
        }}
      />
    );
  }
  if (cfg.type === "select-industry") {
    return (
      <OptionList
        options={suggest.industries.map((i) => ({
          value: i.value,
          label: `${i.value} (${i.count})`,
        }))}
        selected={working.industry}
        onSelect={(v) => {
          setField("industry", v === working.industry ? "" : v);
          onCommit();
        }}
      />
    );
  }
  if (cfg.type === "select-size") {
    return (
      <OptionList
        options={SIZE_OPTS.map((o) => ({ value: o.value, label: o.label }))}
        selected={working.companySizeBand}
        onSelect={(v) => {
          setField(
            "companySizeBand",
            v === working.companySizeBand ? "" : v,
          );
          onCommit();
        }}
      />
    );
  }
  if (cfg.type === "select-exp") {
    return (
      <OptionList
        options={EXP_OPTS.map((o) => ({ value: o.value, label: o.label }))}
        selected={working.expBand}
        onSelect={(v) => {
          setField("expBand", v === working.expBand ? "" : v);
          onCommit();
        }}
      />
    );
  }
  if (cfg.type === "range") {
    return (
      <div>
        <div className="flex items-center gap-[10px]">
          <input
            type="text"
            inputMode="numeric"
            placeholder="From"
            value={working.gradFrom}
            onChange={(e) =>
              setField("gradFrom", e.target.value.replace(/\D/g, ""), "debounced")
            }
            className="fp-popover-input"
          />
          <span className="text-[color:var(--muted-2)]">–</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="To"
            value={working.gradTo}
            onChange={(e) =>
              setField("gradTo", e.target.value.replace(/\D/g, ""), "debounced")
            }
            className="fp-popover-input"
          />
        </div>
        <style jsx>{`
          .fp-popover-input {
            width: 100%;
            background: #fff;
            border: 1px solid var(--rule);
            border-radius: 10px;
            padding: 11px 13px;
            font-size: 15px;
            color: var(--navy-ink);
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .fp-popover-input:focus {
            outline: none;
            border-color: var(--navy);
            box-shadow: 0 0 0 3px rgba(2, 101, 168, 0.12);
          }
        `}</style>
      </div>
    );
  }
  // type === "text"
  const sugKey = (cfg as { sugKey?: keyof DirectorySuggestData }).sugKey;
  const fieldId = cfg.id as keyof Working;
  const placeholder =
    (cfg as { placeholder?: string }).placeholder ?? "";
  const raw = (working[fieldId] ?? "") as string;
  // Suggestion source — already-curated top values from server.
  const allSugs: string[] = (() => {
    if (!sugKey) return [];
    const s = suggest[sugKey];
    if (Array.isArray(s)) {
      return (s as Array<unknown>).map((x) =>
        typeof x === "string" ? x : (x as { value: string }).value,
      );
    }
    return [];
  })();
  // Filter suggestions live by what the user has typed.
  const sugs = raw.trim()
    ? allSugs.filter((s) => s.toLowerCase().includes(raw.toLowerCase()))
    : allSugs;
  return (
    <div>
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={raw}
        onChange={(e) => setField(fieldId, e.target.value as never, "debounced")}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
        }}
        className="fp-popover-input"
      />
      {sugs.length > 0 && (
        <div className="flex flex-wrap gap-[7px] mt-[12px]">
          {sugs.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setField(fieldId, s as never);
                onCommit();
              }}
              className="border border-[color:var(--rule)] bg-white rounded-full px-3 py-[6px] text-[13px] text-[color:var(--navy-ink)] hover:border-navy hover:text-navy"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <style jsx>{`
        .fp-popover-input {
          width: 100%;
          background: #fff;
          border: 1px solid var(--rule);
          border-radius: 10px;
          padding: 11px 13px;
          font-size: 15px;
          color: var(--navy-ink);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .fp-popover-input:focus {
          outline: none;
          border-color: var(--navy);
          box-shadow: 0 0 0 3px rgba(2, 101, 168, 0.12);
        }
      `}</style>
    </div>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[2px] max-h-[264px] overflow-auto -m-1 p-1">
      {options.map((o) => {
        const sel = o.value === selected;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={`flex items-center justify-between gap-[10px] w-full text-left rounded-[9px] px-3 py-[10px] text-[15px] transition ${
              sel
                ? "bg-[rgba(2,101,168,.09)] text-navy font-semibold"
                : "text-[color:var(--navy-ink)] hover:bg-[rgba(11,37,69,.05)]"
            }`}
          >
            <span>{o.label}</span>
            {sel && (
              <span className="text-navy inline-flex">
                <Icon name="check" size={16} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Popover({
  onClose,
  children,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  // Lock body scroll on mobile while the bottom-sheet is open so the
  // page underneath doesn't slide.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-[rgba(8,20,38,0)] sm:bg-transparent [@media(max-width:640px)]:bg-[rgba(8,20,38,.42)]"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute z-[60] mt-[10px] left-0 top-full w-[300px] bg-white text-[color:var(--navy-ink)] border border-[color:rgba(11,37,69,.12)] rounded-[14px] shadow-[0_22px_54px_-16px_rgba(11,37,69,.42)] p-4 [@media(max-width:640px)]:fixed [@media(max-width:640px)]:left-0 [@media(max-width:640px)]:right-0 [@media(max-width:640px)]:bottom-0 [@media(max-width:640px)]:top-auto [@media(max-width:640px)]:w-auto [@media(max-width:640px)]:rounded-b-none [@media(max-width:640px)]:rounded-t-[20px] [@media(max-width:640px)]:pb-[calc(22px+env(safe-area-inset-bottom))]"
        style={{ animation: "fpop-in .14s ease" }}
      >
        <div className="[@media(min-width:641px)]:hidden block w-10 h-[4px] rounded-full bg-[color:rgba(11,37,69,.2)] mx-auto mt-[6px] mb-[14px]" />
        <div className="text-[11px] font-bold tracking-[.2em] uppercase text-[color:var(--muted-2)] mb-3">
          {label}
        </div>
        {children}
        <style jsx global>{`
          @keyframes fpop-in {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: none; }
          }
        `}</style>
      </div>
    </>
  );
}
