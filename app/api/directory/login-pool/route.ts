import { buildLoginData } from "@/lib/login-data";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Returns a fresh randomized backdrop pool for /directory/login.
 *
 * The login page polls this every 30 s (while the small "Log in"
 * pill is visible) and swaps the new pool into the running
 * Constellation / Mosaic / Living Wall without unmounting them. No
 * page reload, no LoadingGate freeze.
 */
export async function GET(): Promise<Response> {
  const data = await buildLoginData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Vary: "*",
    },
  });
}
