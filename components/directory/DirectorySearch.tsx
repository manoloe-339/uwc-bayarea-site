"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
    label: "UWC Grad Year",
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

/** Canonical render order for the inline active-filter chips on
 * mobile — Personal first (UWC, year, location, …), then Work. */
const ACTIVE_CHIP_ORDER = [
  ...PERSONAL_CHIPS.map((c) => c.id),
  ...WORK_CHIPS.map((c) => c.id),
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
  const [mobileOpen, setMobileOpen] = useState(false);
  // When the user opens the sheet by tapping a chip in the filter
  // bar, the sheet drills straight into that chip's detail pane.
  // Tapping the bare "Filters" button leaves this null so the sheet
  // opens at the list.
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  // Portal-safe mount check.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Lock body scroll while the bottom sheet is up.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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
    // `scroll: false` keeps the user's scroll position — the chip
    // bar lives at the top, and a chip click shouldn't jolt the page
    // back to the title every time.
    startTransition(() => router.push(url, { scroll: false }));
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
  const activeChipCount = [
    "college",
    "city",
    "origin",
    "university",
    "gradYear",
    "company",
    "industry",
    "companySizeBand",
    "expBand",
  ].reduce((n, id) => n + (chipActive(id) ? 1 : 0), 0);

  return (
    <div className="mb-[30px]">
      <SearchHero
        value={working.q}
        nl={working.nl}
        onQueryChange={(v) => setField("q", v, "debounced")}
        onNlChange={(v) => setField("nl", v)}
      />

      {/* Mobile (≤640px): Filters pill + inline removable active-filter
          chips + "Clear all". Tap a chip's body to open the sheet
          directly at that chip's detail pane; the × on the chip
          clears that one filter inline. */}
      <div className="mt-4 sm:hidden flex flex-wrap items-center gap-[9px]">
        <button
          type="button"
          onClick={() => {
            setMobileOpenAt(null);
            setMobileOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-[10px] text-[14px] font-bold text-white"
          style={{
            background: "rgba(255,255,255,.14)",
            border: "1px solid rgba(255,255,255,.28)",
          }}
        >
          <Icon name="sliders" size={17} />
          Filters
          {activeChipCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[19px] h-[19px] px-[5px] rounded-full bg-white text-navy text-[12px] font-extrabold leading-none">
              {activeChipCount}
            </span>
          )}
        </button>
        {ACTIVE_CHIP_ORDER.map((id) => {
          if (!chipActive(id)) return null;
          const cfg =
            PERSONAL_CHIPS.find((c) => c.id === id) ??
            WORK_CHIPS.find((c) => c.id === id);
          if (!cfg) return null;
          return (
            <span
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setMobileOpenAt(id);
                setMobileOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setMobileOpenAt(id);
                  setMobileOpen(true);
                }
              }}
              className="inline-flex items-center gap-[7px] rounded-full px-[7px] py-[8px] pl-[13px] bg-white text-[color:var(--navy-ink)] text-[14px] font-semibold cursor-pointer max-w-[60vw]"
            >
              <span className="text-navy inline-flex shrink-0">
                <Icon name={cfg.icon as IconName} size={15} />
              </span>
              <span className="truncate">{chipValue(id)}</span>
              <button
                type="button"
                aria-label={`Remove ${cfg.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (id === "gradYear") {
                    setField("gradFrom", "");
                    setField("gradTo", "");
                  } else {
                    setField(id as keyof Working, "" as never);
                  }
                }}
                className="inline-flex items-center justify-center w-[21px] h-[21px] rounded-full bg-[rgba(11,37,69,.08)] text-[color:var(--navy-ink)] shrink-0"
              >
                <Icon name="x" size={13} strokeWidth={2.2} />
              </button>
            </span>
          );
        })}
        {anyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-white/85 text-[14px] font-semibold underline underline-offset-[3px] px-1 py-2 whitespace-nowrap"
          >
            Clear all
          </button>
        )}
      </div>
      {/* Mobile-only N results readout. Skip when nothing's active. */}
      {anyFilter && (
        <div className="sm:hidden mt-[15px] text-[14.5px] text-white/80">
          <b className="text-white font-bold">{total}</b>{" "}
          {total === 1 ? "result" : "results"}
        </div>
      )}

      {/* Desktop chip row */}
      <div className="hidden sm:flex mt-4 flex-wrap items-center gap-[10px]">
        <div className="flex flex-wrap items-center gap-[10px]">
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

        <div className="w-px self-stretch min-h-[26px] bg-[color:rgba(255,255,255,.2)] mx-1" />

        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="inline-flex items-center gap-[7px] text-[11px] font-bold tracking-[.22em] uppercase text-white/65 px-[2px]">
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
              name={working.scope === "ever" ? "history" : "clock"}
              size={13}
            />
            {working.scope === "ever"
              ? "Matching anyone who ever held these roles"
              : "Matching current roles only"}
          </span>
        )}
      </div>

      {mounted && mobileOpen &&
        createPortal(
          <MobileFilterSheet
            onClose={() => setMobileOpen(false)}
            openAt={mobileOpenAt}
            working={working}
            setField={setField}
            chipValue={chipValue}
            suggest={suggest}
            total={total}
            grandTotal={grandTotal}
            anyFilter={anyFilter}
            onClearAll={clearAll}
          />,
          document.body,
        )}
    </div>
  );
}

function MobileFilterSheet({
  onClose,
  openAt,
  working,
  setField,
  chipValue,
  suggest,
  total,
  grandTotal,
  anyFilter,
  onClearAll,
}: {
  onClose: () => void;
  /** If set, the sheet opens directly into this chip's detail pane. */
  openAt: string | null;
  working: Working;
  setField: <K extends keyof Working>(
    key: K,
    v: Working[K],
    mode?: "now" | "debounced",
  ) => void;
  chipValue: (id: string) => string;
  suggest: DirectorySuggestData;
  total: number;
  grandTotal: number;
  anyFilter: boolean;
  onClearAll: () => void;
}) {
  // Drill-down inside a FIXED-height container — list pane and detail
  // pane both occupy the same vertical space and slide horizontally
  // (iOS push). The sheet itself never resizes when you drill in.
  const [activeId, setActiveId] = useState<string | null>(openAt);
  const activeCfg: ChipCfg | null = useMemo(() => {
    if (!activeId) return null;
    return (
      PERSONAL_CHIPS.find((c) => c.id === activeId) ??
      WORK_CHIPS.find((c) => c.id === activeId) ??
      null
    );
  }, [activeId]);
  // Remember the last-active config so the detail pane stays rendered
  // (and slides out cleanly) during the back transition.
  const lastCfgRef = useRef<ChipCfg | null>(null);
  if (activeCfg) lastCfgRef.current = activeCfg;
  const dcfg = activeCfg ?? lastCfgRef.current;

  // Track the iOS visual viewport so we can keep the sheet's footer
  // visible above the keyboard. `vh` is measured against the layout
  // viewport which doesn't shrink for the keyboard, so without this
  // the Apply / Clear all row falls behind the keyboard.
  const [kbOffset, setKbOffset] = useState(0);
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const sync = () => {
      const occluded = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setKbOffset(occluded);
      setVvHeight(vv.height);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const Row = ({ cfg }: { cfg: ChipCfg }) => {
    const value = chipValue(cfg.id);
    return (
      <button
        type="button"
        onClick={() => setActiveId(cfg.id)}
        className="w-full flex items-center gap-3 px-[18px] py-[15px] border-b border-[color:var(--rule)] text-left active:bg-[rgba(11,37,69,.035)]"
      >
        <span className="text-[color:var(--muted)] inline-flex shrink-0">
          <Icon name={cfg.icon as IconName} size={21} />
        </span>
        <span className="text-[16.5px] font-semibold text-[color:var(--navy-ink)] flex-1 min-w-0">
          {cfg.label}
        </span>
        {value ? (
          <span className="text-[15px] text-navy font-bold max-w-[55vw] truncate">
            {value}
          </span>
        ) : (
          <span className="text-[15px] text-[color:var(--muted-2)]">Any</span>
        )}
        <span className="-rotate-90 text-[color:rgba(11,37,69,.35)] shrink-0">
          <Icon name="chevron-down" size={19} strokeWidth={2} />
        </span>
      </button>
    );
  };

  const drilled = !!activeCfg;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close filters"
        className="absolute inset-0 bg-[rgba(8,20,38,.46)]"
      />
      <div
        className="absolute bg-white overflow-hidden flex flex-col"
        style={{
          // Inset on phone so the sheet floats as a card instead of
          // a full-bleed slab. Bottom shifts up by the iOS keyboard's
          // occluded height so the Apply / Clear all footer stays
          // above the keyboard instead of falling behind it. Height
          // clamps against the visible viewport so the top of the
          // sheet doesn't slide off-screen on short phones.
          left: 12,
          right: 12,
          bottom: kbOffset
            ? `${kbOffset + 12}px`
            : "calc(12px + env(safe-area-inset-bottom))",
          height:
            vvHeight != null
              ? `min(54vh, ${Math.max(280, vvHeight - 24)}px)`
              : "54vh",
          borderRadius: 22,
          animation: "msheet-in .32s cubic-bezier(.32,.72,0,1)",
          boxShadow:
            "0 -18px 50px -20px rgba(0,0,0,.45), 0 24px 60px -16px rgba(0,0,0,.35)",
        }}
      >
        <style jsx global>{`
          @keyframes msheet-in {
            from { transform: translateY(102%); }
            to   { transform: none; }
          }
        `}</style>

        {/* Grip */}
        <div className="w-[38px] h-[5px] rounded-full bg-[rgba(11,37,69,.18)] mx-auto mt-[9px] mb-[4px] shrink-0" />

        {/* Constant-height view that holds both panes — neither pane's
            content can change the sheet's outer dimensions. */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* List pane */}
          <div
            className={`absolute inset-0 flex flex-col min-h-0 bg-white transition-transform duration-[300ms] ease-[cubic-bezier(.4,0,.2,1)] ${
              drilled ? "-translate-x-[26%]" : "translate-x-0"
            }`}
          >
            <div className="flex items-center gap-1 px-[18px] py-[10px] pb-3 border-b border-[color:var(--rule)] shrink-0">
              <span className="text-[13px] font-extrabold tracking-[.18em] uppercase text-[color:var(--navy-ink)]">
                Filters
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto p-2 rounded-lg text-[color:var(--muted)] active:bg-[rgba(11,37,69,.06)]"
              >
                <Icon name="x" size={22} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {PERSONAL_CHIPS.map((c) => (
                <Row key={c.id} cfg={c} />
              ))}
              <div className="flex items-center gap-3 px-[18px] py-[11px] border-b border-[color:var(--rule)] bg-[rgba(11,37,69,.045)]">
                <span className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[.2em] uppercase text-[color:var(--muted)] flex-1">
                  <Icon name="briefcase" size={13} />
                  Work
                </span>
                <ScopeToggleLight
                  value={working.scope}
                  onChange={(v) => setField("scope", v)}
                />
              </div>
              {WORK_CHIPS.map((c) => (
                <Row key={c.id} cfg={c} />
              ))}
            </div>
          </div>

          {/* Detail pane */}
          <div
            className={`absolute inset-0 flex flex-col min-h-0 bg-white transition-transform duration-[300ms] ease-[cubic-bezier(.4,0,.2,1)] ${
              drilled ? "translate-x-0" : "translate-x-full"
            }`}
            style={{
              zIndex: 2,
              boxShadow: drilled
                ? "-12px 0 24px -16px rgba(11,37,69,.25)"
                : undefined,
            }}
          >
            <div className="flex items-center gap-1 px-[8px] py-[6px] pb-3 pl-[10px] border-b border-[color:var(--rule)] shrink-0">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                aria-label="Back to filter list"
                className="p-2 rounded-lg text-navy"
              >
                <span className="rotate-180 inline-flex">
                  <Icon name="arrow-left" size={22} strokeWidth={2} />
                </span>
              </button>
              <span className="text-[13px] font-extrabold tracking-[.18em] uppercase text-navy">
                {dcfg?.label ?? ""}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto p-2 rounded-lg text-[color:var(--muted)] active:bg-[rgba(11,37,69,.06)]"
              >
                <Icon name="x" size={22} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {dcfg && (
                <div className="px-[18px] py-[16px]">
                  <ChipBody
                    cfg={dcfg}
                    working={working}
                    setField={setField}
                    suggest={suggest}
                    onCommit={() => {
                      // Pop back to the list after a select/text
                      // commit so the user can browse other filters.
                      // Use a small delay so the value's "selected"
                      // state can flash before the slide-back.
                      setTimeout(() => setActiveId(null), 120);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer — shared across both panes, constant. The sheet
            itself already insets by env(safe-area-inset-bottom), so
            the footer just needs its visual padding. */}
        <div
          className="border-t border-[color:var(--rule)] px-[18px] flex items-center justify-between gap-3 shrink-0 bg-white"
          style={{ paddingTop: 12, paddingBottom: 14 }}
        >
          <button
            type="button"
            disabled={!anyFilter}
            onClick={onClearAll}
            className="text-[15.5px] font-semibold text-[color:var(--muted-2)] disabled:opacity-45 px-1 py-[10px]"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-[10px] bg-navy text-white rounded-[12px] px-[26px] py-[14px] text-[16px] font-bold active:scale-[.98] transition"
          >
            Apply
            <span className="text-white/80 font-semibold">
              ({anyFilter ? `${total}` : `${grandTotal}`})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Light-on-white variant of the scope toggle for inside the mobile
 * sheet. The standalone <ScopeToggle> uses white-on-blue. */
function ScopeToggleLight({
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
      className="inline-flex items-center gap-[2px] rounded-full p-[3px] bg-[rgba(11,37,69,.06)]"
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
            className={`inline-flex items-center gap-[6px] rounded-full px-[11px] py-[6px] text-[12px] font-semibold transition ${
              on
                ? "bg-white text-navy shadow-[0_1px_3px_rgba(11,37,69,.18)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--navy-ink)]"
            }`}
          >
            <Icon name={v === "ever" ? "history" : "clock"} size={12} />
            {v === "ever" ? "Ever" : "Current"}
          </button>
        );
      })}
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
  // Mobile gets a shorter placeholder so it fits without truncating
  // mid-word. We watch the viewport with matchMedia so the swap
  // tracks live orientation changes.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const placeholder = nl
    ? narrow
      ? "designers in san francisco"
      : "Ask anything — “designers in climate who left Google”"
    : narrow
      ? "Name, company, school…"
      : "Search by name, company, school, or country";
  return (
    <div
      className="relative flex items-center gap-[12px] sm:gap-[14px] rounded-[14px] px-[16px] sm:px-[18px] pr-[6px] sm:pr-2 transition-colors"
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
        <Icon
          name="search"
          size={narrow ? 18 : 22}
          strokeWidth={2}
        />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-[16px] sm:text-[19px] py-[10px] sm:py-[19px] placeholder:text-white/55"
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
        <span className="sm:hidden whitespace-nowrap">NL</span>
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
            <Icon name={v === "ever" ? "history" : "clock"} size={14} />
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
    <div className="opt-scroll flex flex-col gap-[2px] max-h-[264px] overflow-y-scroll -m-1 p-1 pr-2">
      <style jsx>{`
        /* Force a visible scrollbar even on macOS (where it auto-hides
         * until the user scrolls), so the list reads as scrollable on
         * first glance instead of looking truncated. */
        .opt-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(11, 37, 69, 0.32) transparent;
        }
        .opt-scroll::-webkit-scrollbar {
          width: 8px;
          display: block;
          -webkit-appearance: none;
        }
        .opt-scroll::-webkit-scrollbar-thumb {
          background: rgba(11, 37, 69, 0.32);
          border-radius: 4px;
        }
        .opt-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(11, 37, 69, 0.5);
        }
        .opt-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
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
