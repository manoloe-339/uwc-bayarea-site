import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/events-db";
import { getApprovedPhotosOrdered } from "@/lib/event-photos/queries";

// nodejs runtime — next/og's ImageResponse works in either runtime.
// Edge would be a bit faster for cold starts, but the photos query
// pulls in dependencies (sharp, exif libs via node:crypto) that
// aren't edge-compatible. Node is fine for OG generation.
export const runtime = "nodejs";

// LinkedIn / Facebook / Twitter (summary_large_image) all expect
// 1200×630 (1.91:1) for the preview card. Generating the image at
// that exact size means no platform has to crop or rescale, which
// is what was destroying quality on LinkedIn previously.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "UWC Bay Area event photo";

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const event = await getEventBySlug(params.slug);

  // Fallback card when the event doesn't exist or has no photos —
  // matches the site's navy/ivory palette so we never serve a blank
  // image to a social scraper.
  const fallback = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0265A8",
        color: "#F4EFE3",
        fontFamily: "serif",
        textAlign: "center",
        padding: "0 80px",
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.85, letterSpacing: 4, marginBottom: 24 }}>
        UWC BAY AREA
      </div>
      <div style={{ fontSize: 64, lineHeight: 1.1, fontWeight: 600 }}>
        {event?.name ?? "Event photos"}
      </div>
    </div>
  );

  if (!event) {
    return new ImageResponse(fallback, { ...size });
  }

  const photos = await getApprovedPhotosOrdered(event.id);
  const top = photos[0];

  if (!top) {
    return new ImageResponse(fallback, { ...size });
  }

  // Render the top approved photo as a full-bleed 1200×630 image.
  // object-fit: cover handles centering + cropping to the OG aspect.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0B2545",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={top.blob_url}
          width={1200}
          height={630}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
