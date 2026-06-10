/**
 * Shared data loader for the directory login backdrop.
 *
 * Used by:
 *   - app/directory/login/page.tsx — initial server render
 *   - app/api/directory/login-pool/route.ts — periodic refresh from
 *     the client, so the backdrop stays alive without reloading
 *
 * Returns the shape that LoginBackdrop expects: a photoPool (for
 * Living Wall + Constellation) and a mixedPool (60/25/10/5 mix for
 * Mosaic), plus the urls list for the LoadingGate's preload.
 */

import { sql } from "@/lib/db";
import {
  buildFlagTiles,
  buildOrgTiles,
  buildPhotoTiles,
  buildTilePool,
  buildUwcPhotoTiles,
  buildUwcTiles,
  type LoginTile,
} from "@/components/login/faces-shared";

const MIXED_POOL_SIZE = 240;
const PHOTO_QUERY_SIZE = 1000;

/** Alumni whose LinkedIn profile picture is actually a school /
 * company logo (and so leak into the photo pool as fake-photo tiles
 * unless excluded). See app/directory/login/page.tsx for context. */
const EXCLUDE_FROM_LOGIN_PHOTOS = [99];

export interface LoginPools {
  photoPool: LoginTile[];
  mixedPool: LoginTile[];
}

export async function buildLoginData(): Promise<LoginPools> {
  const [photoRows, uwcAssetRows, orgAssetRows, flagAssetRows] = await Promise.all([
    sql`
      SELECT id, first_name, last_name, photo_url
      FROM alumni
      WHERE photo_url IS NOT NULL
        AND first_name IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
        AND moved_out IS NOT TRUE
        AND id != ALL(${EXCLUDE_FROM_LOGIN_PHOTOS}::int[])
        AND photo_url NOT IN (
          SELECT school_logo_url FROM alumni_education
            WHERE school_logo_url IS NOT NULL
          UNION
          SELECT current_company_logo_url FROM alumni
            WHERE current_company_logo_url IS NOT NULL
          UNION
          SELECT company_logo_url FROM alumni_career
            WHERE company_logo_url IS NOT NULL
        )
      ORDER BY RANDOM()
      LIMIT ${PHOTO_QUERY_SIZE}
    `,
    sql`SELECT canonical, logo_url, campus_url, other_url FROM uwc_assets`,
    sql`
      SELECT id, label, image_url FROM login_assets
      WHERE kind IN ('university_logo','company_logo')
      ORDER BY display_order ASC, id ASC
    `,
    sql`
      SELECT id, label, image_url FROM login_assets
      WHERE kind = 'flag'
      ORDER BY display_order ASC, id ASC
    `,
  ]);

  const alumniPhotos = buildPhotoTiles(
    photoRows as Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      photo_url: string | null;
    }>,
  );
  const uwcAssets = uwcAssetRows as Array<{
    canonical: string;
    logo_url: string | null;
    campus_url: string | null;
    other_url: string | null;
  }>;
  const uwcs = buildUwcTiles(uwcAssets);
  const photos = [...alumniPhotos, ...buildUwcPhotoTiles(uwcAssets)];
  const orgs = buildOrgTiles(
    orgAssetRows as Array<{ id: number; label: string; image_url: string }>,
  );
  const flags = buildFlagTiles(
    flagAssetRows as Array<{ id: number; label: string; image_url: string }>,
  );

  // Per-request fresh shuffle of the full photo list — see
  // page.tsx history for the variability rationale.
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }

  const mixedPool = buildTilePool({
    target: MIXED_POOL_SIZE,
    photos,
    uwcs,
    orgs,
    flags,
    seed: Math.floor(Math.random() * 0xffffffff),
  });
  const photoPool = photos;

  return { photoPool, mixedPool };
}
