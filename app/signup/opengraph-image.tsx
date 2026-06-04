import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "UWC Bay Area · Signup";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0265A8";

/** Resolve a path under /public from THIS file's location via
 * import.meta.url so Vercel's file tracer bundles the asset into the
 * serverless function. `process.cwd()` + "/public" works locally but
 * fails on Vercel — public assets aren't auto-included in function
 * bundles unless the trace can see them. */
function imgDataUrl(filename: string) {
  // app/signup/opengraph-image.tsx → ../../public/<filename>
  const url = new URL(`../../public/${filename}`, import.meta.url);
  const buf = readFileSync(url);
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
