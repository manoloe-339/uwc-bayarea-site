"use client";

import { useEffect, useMemo, useState } from "react";
import { render } from "@react-email/render";
import AlumniNewsletter, {
  type AlumniNewsletterProps,
  type EventDetails,
  type Mode,
} from "@/emails/AlumniNewsletter";

type Preset =
  | "live-announcement"
  | "live-reminder"
  | "preset-announcement"
  | "preset-reminder"
  | "preset-update"
  | "blank";

type BaseProps = Pick<
  AlumniNewsletterProps,
  "logoUrl" | "physicalAddress" | "unsubscribeUrl" | "recipientFirstName"
>;

type Defaults = {
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

// ---- Hardcoded presets (stable while iterating on the template) ----

const HARDCODED_ANNOUNCEMENT: EventDetails = {
  title: "Hear the fascinating history of eSwatini",
  dateline: "Friday, May 1, 2026 · 6:30 – 8:30 PM",
  location: "530 Hampshire St #306",
  locationNote: "San Francisco · Mission District · look for the red awning",
  description:
    "Bhembe and Wabantu, Swazi alumni of UWC Waterford Kamhlaba, reflect on the tensions shaping life in eSwatini — and in all of us.",
  speakers: [
    { name: "Ntokozo Bhembe", title: "Waterford Kamhlaba · '07" },
    { name: "Wabantu Hlophe", title: "Waterford Kamhlaba · '10" },
    { name: "Gil Sander Joseph", title: "Haiti · UWC RBC '21 · Stanford" },
    { name: "Faith Abiodun", title: "Executive Director · UWC International" },
  ],
  cta: { label: "Get tickets · $10", url: "https://uwcbayarea.org" },
};

const HARDCODED_UPDATE = {
  headline: "Welcome to our new committee members",
  body:
    "We're excited to introduce four new UWC Bay Area committee members joining us this spring. They bring a range of UWC backgrounds — Atlantic '05, Pearson '12, USA '18, and Dilijan '21 — and a shared commitment to building a stronger alumni community here in the Bay.\n\nYou'll see their names attached to upcoming events and programs. Reach out if you'd like to connect.",
  imageUrl: undefined,
};

export default function PreviewClient({
  baseProps,
  liveEvent,
  whatsappDefaults,
  foodiesDefaults,
}: {
  baseProps: BaseProps;
  liveEvent: EventDetails;
  whatsappDefaults: Defaults & { ctaUrl: string };
  foodiesDefaults: Defaults;
}) {
  const [mode, setMode] = useState<Mode>("announcement");
  const [preset, setPreset] = useState<Preset>("live-announcement");
  const [showWhatsNext, setShowWhatsNext] = useState(true);
  const [showWhatsapp, setShowWhatsapp] = useState(true);
  const [showFoodies, setShowFoodies] = useState(true);
  const [deviceWidth, setDeviceWidth] = useState<600 | 375>(600);
  const [copyStatus, setCopyStatus] = useState<"" | "copied" | "error">("");

  // When preset changes, also pre-set the mode for convenience.
  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "live-announcement" || next === "preset-announcement") setMode("announcement");
    if (next === "live-reminder" || next === "preset-reminder") setMode("reminder");
    if (next === "preset-update") setMode("update");
  }

  const props = useMemo<AlumniNewsletterProps>(() => {
    const sample = resolvePreset(preset, liveEvent);
    return {
      ...baseProps,
      preheader: preheaderFor(mode, sample),
      mode,
      event: mode !== "update" ? sample.event : undefined,
      reminderTag: mode === "reminder" ? sample.reminderTag : undefined,
      update: mode === "update" ? sample.update : undefined,
      whatsNext: showWhatsNext
        ? {
            show: true,
            tag: "Foodies",
            title: "Afghan Foodies · May 15",
            dateline: "Saturday, May 15 · 7:00 PM · Bernal Heights",
            description:
              "A casual dinner hosted by Nadia and Sam. BYOB, bring a side if you can.",
            cta: { label: "Details", url: "https://uwcbayarea.org" },
          }
        : undefined,
      whatsapp: showWhatsapp
        ? {
            show: true,
            headline: whatsappDefaults.headline,
            body: whatsappDefaults.body,
            ctaLabel: whatsappDefaults.ctaLabel,
            ctaUrl: whatsappDefaults.ctaUrl,
          }
        : undefined,
      foodies: showFoodies
        ? {
            show: true,
            headline: foodiesDefaults.headline,
            body: foodiesDefaults.body,
            ctaLabel: foodiesDefaults.ctaLabel,
            ctaUrl: foodiesDefaults.ctaUrl,
          }
        : undefined,
    };
  }, [mode, preset, showWhatsNext, showWhatsapp, showFoodies, baseProps, liveEvent, whatsappDefaults, foodiesDefaults]);

  const [html, setHtml] = useState("<p>rendering…</p>");
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(render(<AlumniNewsletter {...props} />))
      .then((out) => {
        if (!cancelled) setHtml(typeof out === "string" ? out : "");
      })
      .catch((e) => {
        if (!cancelled) setHtml(`<pre style="padding:16px;color:#b91c1c">${(e as Error).message}</pre>`);
      });
    return () => {
      cancelled = true;
    };
  }, [props]);

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus(""), 1500);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus(""), 1500);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-200px)]">
      {/* Sidebar */}
      <aside className="lg:w-[320px] shrink-0">
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 sticky top-5 space-y-6">
          <div>
            <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">Sample data</h2>
            <select
              value={preset}
              onChange={(e) => applyPreset(e.target.value as Preset)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            >
              <option value="live-announcement">May 1 eSwatini · announcement (from lib/event.ts)</option>
              <option value="live-reminder">May 1 reminder (from lib/event.ts)</option>
              <option value="preset-announcement">May 1 eSwatini · announcement (hardcoded)</option>
              <option value="preset-reminder">May 1 reminder (hardcoded)</option>
              <option value="preset-update">Update: welcome new committee members</option>
              <option value="blank">Blank</option>
            </select>
            <p className="mt-1.5 text-[11px] text-[color:var(--muted)]">
              "Live" presets mirror <code>lib/event.ts</code>; switch to hardcoded to iterate on the template without moving the sample.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">Mode</h2>
            <div className="space-y-1.5 text-sm">
              {(["announcement", "reminder", "update"] as Mode[]).map((m) => (
                <label key={m} className="flex items-center gap-2 capitalize">
                  <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">Sections</h2>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showWhatsNext} onChange={(e) => setShowWhatsNext(e.target.checked)} />
                What's next
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showWhatsapp} onChange={(e) => setShowWhatsapp(e.target.checked)} />
                WhatsApp community
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showFoodies} onChange={(e) => setShowFoodies(e.target.checked)} />
                Foodies evergreen
              </label>
              <label className="flex items-center gap-2 text-[color:var(--muted)] italic">
                <input type="checkbox" disabled />
                Link tracking (Part 2)
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">Device width</h2>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDeviceWidth(600)}
                className={`flex-1 px-3 py-1.5 rounded border ${deviceWidth === 600 ? "border-navy bg-navy text-white" : "border-[color:var(--rule)] text-[color:var(--navy-ink)]"}`}
              >
                Desktop · 600
              </button>
              <button
                type="button"
                onClick={() => setDeviceWidth(375)}
                className={`flex-1 px-3 py-1.5 rounded border ${deviceWidth === 375 ? "border-navy bg-navy text-white" : "border-[color:var(--rule)] text-[color:var(--navy-ink)]"}`}
              >
                Mobile · 375
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Preview panel */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] tracking-[.22em] uppercase text-[color:var(--muted)]">
            Mode: <span className="text-navy font-semibold">{mode}</span> · {deviceWidth}px
          </div>
          <button
            type="button"
            onClick={copyHtml}
            className="text-sm text-navy hover:underline"
          >
            {copyStatus === "copied" ? "Copied ✓" : copyStatus === "error" ? "Copy failed" : "Copy HTML"}
          </button>
        </div>
        <div className="bg-ivory-2 border border-[color:var(--rule)] rounded-[10px] p-5 flex justify-center">
          <iframe
            title="email preview"
            srcDoc={html}
            style={{
              width: `${deviceWidth}px`,
              height: "900px",
              maxWidth: "100%",
              background: "#ffffff",
              border: "1px solid rgba(11,37,69,0.12)",
              borderRadius: "6px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function resolvePreset(
  preset: Preset,
  liveEvent: EventDetails,
): { event?: EventDetails; reminderTag?: string; update?: AlumniNewsletterProps["update"] } {
  switch (preset) {
    case "live-announcement":
      return { event: liveEvent };
    case "live-reminder":
      return { event: liveEvent, reminderTag: "This Friday!" };
    case "preset-announcement":
      return { event: HARDCODED_ANNOUNCEMENT };
    case "preset-reminder":
      return { event: HARDCODED_ANNOUNCEMENT, reminderTag: "This Saturday!" };
    case "preset-update":
      return { update: HARDCODED_UPDATE };
    case "blank":
      return {};
  }
}

function preheaderFor(mode: Mode, sample: { event?: EventDetails; update?: AlumniNewsletterProps["update"] }): string | undefined {
  if (mode === "announcement" && sample.event) return sample.event.description?.slice(0, 90);
  if (mode === "reminder" && sample.event) return `Reminder: ${sample.event.title}`;
  if (mode === "update" && sample.update) return sample.update.headline;
  return undefined;
}
