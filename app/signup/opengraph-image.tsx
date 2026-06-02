import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "Join UWC Bay Area — Alumni, Parents & Friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0265A8";

function imgDataUrl(filename: string) {
  const buf = readFileSync(join(process.cwd(), "public", filename));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export default function SignupOpenGraphImage() {
  const logo = imgDataUrl("uwc-bay-area-logo.png");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "70px 90px",
          gap: "70px",
        }}
      >
        <img
          src={logo}
          alt=""
          style={{
            width: "330px",
            height: "330px",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.78)",
              marginBottom: "24px",
            }}
          >
            Join the community
          </div>
          <div
            style={{
              fontSize: "92px",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              color: "white",
              marginBottom: "30px",
            }}
          >
            UWC Bay Area
          </div>
          <div
            style={{
              fontSize: "34px",
              lineHeight: 1.25,
              color: "rgba(255,255,255,0.88)",
              maxWidth: "640px",
            }}
          >
            Alumni, parents &amp; friends —
            sign up at uwcbayarea.org/signup
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
