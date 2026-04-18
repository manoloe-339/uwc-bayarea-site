import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { event } from "@/lib/event";

export const runtime = "nodejs";
export const alt = `${event.title} · ${event.city}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = readFileSync(join(process.cwd(), "public", "uwc-logo-square.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F4EFE3",
          color: "#0b2545",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <img src={logoSrc} width={140} height={140} alt="UWC" style={{ borderRadius: "20px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: 28, letterSpacing: "0.2em", fontWeight: 700, color: "#0b2545" }}>
                UWC BAY AREA
              </div>
              <div style={{ fontSize: 22, letterSpacing: "0.14em", color: "#0b2545", opacity: 0.7 }}>
                {`ALUMNI & FRIENDS · ${event.city}`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                gap: "18px",
              }}
            >
              <span>{event.hero.title}</span>
              <span style={{ fontStyle: "italic", fontWeight: 600 }}>{event.hero.titleItalic}</span>
            </div>
            <div style={{ fontSize: 32, color: "#0b2545", opacity: 0.85, lineHeight: 1.4 }}>
              {`Fireside with ${event.fireside.speakers.map((s) => s.name).join(" & ")}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ background: "#0b2545", color: "#F4EFE3", padding: "12px 22px", borderRadius: "999px" }}>
              {event.dayOfWeek} · {event.dateShort.toUpperCase()}
            </span>
            <span style={{ opacity: 0.8 }}>{event.time}</span>
            <span style={{ opacity: 0.6 }}>·</span>
            <span style={{ opacity: 0.8 }}>{event.venue}</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
