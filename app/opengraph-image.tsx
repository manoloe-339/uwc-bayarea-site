import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { event } from "@/lib/event";
import { getSeatsRemaining } from "@/lib/live";

export const runtime = "nodejs";
export const revalidate = 60;
export const alt = `${event.title} · ${event.city}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0265A8";
const NAVY_INK = "#0B2545";
const IVORY = "#F4EFE3";
const URGENCY = "#AD3E2D";

function imgDataUrl(filename: string) {
  const buf = readFileSync(join(process.cwd(), "public", filename));
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const mime = isPng ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const logo = imgDataUrl("uwc-logo-square.png");
  const bhembe = imgDataUrl("bhembe.jpg");
  const wabuntu = imgDataUrl("wabuntu.jpg");
  const gil = imgDataUrl("gil.jpg");
  const faith = imgDataUrl("faith.jpg");

  const seatsRemaining = await getSeatsRemaining();
  const [fireside1, fireside2] = event.fireside.speakers;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "sans-serif",
        }}
      >
        {/* LEFT (ivory) */}
        <div
          style={{
            flex: "1.7",
            background: IVORY,
            color: NAVY_INK,
            padding: "44px 52px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <img src={logo} width={54} height={54} alt="" style={{ borderRadius: "10px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ fontSize: 16, letterSpacing: "0.2em", fontWeight: 700, color: NAVY }}>
                UWC BAY AREA
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  fontWeight: 600,
                  color: NAVY_INK,
                  opacity: 0.7,
                }}
              >
                {`ALUMNI & FRIENDS · ${event.city}`}
              </div>
            </div>
          </div>

          {/* Urgency pill */}
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: URGENCY,
                color: "white",
                padding: "8px 20px",
                borderRadius: "999px",
                fontSize: 13,
                letterSpacing: "0.14em",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "999px", background: "white" }} />
              <span>{`SELLING QUICKLY · `}</span>
              <span style={{ fontStyle: "italic", fontWeight: 500, textTransform: "none", letterSpacing: "0.02em" }}>
                {`only ${seatsRemaining} seats remain`}
              </span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 54,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                color: NAVY_INK,
                fontFamily: "serif",
              }}
            >
              <span>{`${event.hero.title} `}</span>
              <span style={{ fontStyle: "italic", fontWeight: 600, color: NAVY }}>
                {event.hero.titleItalic}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 19,
                fontStyle: "italic",
                fontFamily: "serif",
                color: NAVY_INK,
                lineHeight: 1.35,
              }}
            >
              <span>Reflections from two Swazi alumni of</span>
              <span style={{ fontWeight: 600, color: NAVY, fontStyle: "italic", marginLeft: "8px" }}>
                UWC Waterford Kamhlaba.
              </span>
            </div>
          </div>

          {/* Speakers mini-row */}
          <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            <div style={{ fontSize: 18, fontStyle: "italic", fontFamily: "serif", color: NAVY_INK, opacity: 0.75 }}>
              with
            </div>
            {[
              { name: "NTOKOZO BHEMBE", role: "WATERFORD · '07", photo: bhembe },
              { name: "WABANTU HLOPHE", role: "WATERFORD · '10", photo: wabuntu },
            ].map((s) => (
              <div
                key={s.name}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
              >
                <img
                  src={s.photo}
                  width={56}
                  height={56}
                  alt=""
                  style={{
                    borderRadius: "999px",
                    border: `2px solid ${NAVY}`,
                    objectFit: "cover",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: NAVY }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 8, letterSpacing: "0.14em", color: NAVY_INK, opacity: 0.7 }}>
                    {s.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Date + venue row */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                background: NAVY,
                color: IVORY,
                padding: "11px 24px",
                borderRadius: "999px",
                fontSize: 13,
                letterSpacing: "0.22em",
                fontWeight: 700,
              }}
            >
              {`${event.dayOfWeek} · ${event.dateShort.toUpperCase()}`}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: NAVY_INK }}>
              {`${event.time}  ·  ${event.venue.split(" · ")[0]}`}
            </div>
          </div>
        </div>

        {/* RIGHT (navy) */}
        <div
          style={{
            flex: "1",
            background: NAVY,
            color: "white",
            padding: "44px 36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <div style={{ fontSize: 28, fontStyle: "italic", fontFamily: "serif", fontWeight: 600 }}>
            Fireside chat
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <FiresidePortrait photo={gil} speaker={fireside1} />
            <div style={{ display: "flex", fontSize: 36, fontStyle: "italic", fontFamily: "serif", color: "white", opacity: 0.9 }}>
              &
            </div>
            <FiresidePortrait photo={faith} speaker={fireside2} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "6px",
              fontSize: 13,
              letterSpacing: "0.22em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            <span>RESERVE YOUR SEAT ·</span>
            <span style={{ fontStyle: "italic", fontFamily: "serif", textTransform: "none", letterSpacing: "0.02em", fontWeight: 600 }}>
              {`${event.price} ${event.priceQualifier}`}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

function FiresidePortrait({
  photo,
  speaker,
}: {
  photo: string;
  speaker: { name: string; role: string; org: readonly string[] };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", maxWidth: "170px" }}>
      <img
        src={photo}
        width={110}
        height={110}
        alt=""
        style={{ borderRadius: "999px", border: "3px solid white", objectFit: "cover" }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "white", textAlign: "center" }}>{speaker.name}</div>
        <div style={{ fontSize: 11, color: "white", opacity: 0.8, textAlign: "center" }}>{speaker.role}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "white", textAlign: "center" }}>
          {speaker.org[speaker.org.length - 1]}
        </div>
      </div>
    </div>
  );
}
