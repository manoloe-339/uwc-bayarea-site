import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "UWC Bay Area · Alumni & Friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0265A8";

/** Resolve a path under /public from THIS file's location via
 * import.meta.url so Vercel's file tracer bundles the asset into the
 * serverless function. `process.cwd()` + "/public" works locally but
 * can silently fail on Vercel — public assets aren't auto-included in
 * function bundles unless the trace can see them. */
function imgDataUrl(filename: string) {
  // app/opengraph-image.tsx → ./public/<filename> via import.meta.url.
  const url = new URL(`../public/${filename}`, import.meta.url);
  const buf = readFileSync(url);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export default function OpenGraphImage() {
  const logo = imgDataUrl("uwc-bay-area-logo.png");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <img
          src={logo}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
