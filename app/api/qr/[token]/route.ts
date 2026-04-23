import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { verifyQRToken } from "@/lib/qr-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves a signed ticket QR as a PNG. Public URL so email clients can
 * render it via <img src="…"> without relying on inline data URIs (which
 * Gmail sometimes strips).
 *
 * No auth layer: the token itself IS the secret. Anyone who has a valid
 * token can already check in, so there's no additional privacy to protect
 * by gating the image behind a cookie.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const v = verifyQRToken(token);
  if (!v.valid) {
    return new Response("Invalid QR token", { status: 400 });
  }

  const png = await QRCode.toBuffer(token, {
    width: 600,
    margin: 2,
    color: { dark: "#0A2540", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
    type: "png",
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Safe to cache for 24h — the token is stable for the life of the
      // attendee row. If admin regenerates, the old URL simply 400s.
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "Content-Disposition": `inline; filename="ticket-${v.attendeeId}.png"`,
    },
  });
}
