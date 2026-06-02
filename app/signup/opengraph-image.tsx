import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "UWC Bay Area · Signup";
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "30px",
        }}
      >
        {/* Logo file is wider than tall; pin width and let height
            flow so it renders at its natural ratio instead of
            being squished into a square. */}
        <img
          src={logo}
          alt=""
          style={{
            width: "640px",
          }}
        />
        <div
          style={{
            fontSize: "108px",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "white",
          }}
        >
          Signup
        </div>
      </div>
    ),
    { ...size }
  );
}
