import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "Join UWC Bay Area WhatsApp";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0265A8";
// WhatsApp brand green for the headline accent so the OG card mirrors
// the green pill button on the homepage.
const WA_GREEN = "#25D366";

function imgDataUrl(filename: string) {
  // Resolve under /public via import.meta.url so Vercel's file tracer
  // bundles the asset. process.cwd() + /public fails on Vercel.
  const url = new URL(`../../public/${filename}`, import.meta.url);
  const buf = readFileSync(url);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export default function JoinWhatsAppOpenGraphImage() {
  const logo = imgDataUrl("uwc-bay-area-logo.png");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "30px",
        }}
      >
        <img
          src={logo}
          alt=""
          style={{
            width: "640px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: WA_GREEN,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
            }}
          >
            💬
          </div>
          <div
            style={{
              fontSize: "92px",
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "white",
            }}
          >
            Join WhatsApp
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
