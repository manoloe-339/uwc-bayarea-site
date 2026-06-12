/**
 * Photo-led "gallery" card — the same chrome used on /directory and
 * /directory/saved. Server-rendered. The photo and the name are
 * explicit `<Link>` regions pointing at the detail page; specific
 * inner anchors (campus, city, LinkedIn, company) navigate to their
 * own destinations. No stretched-link overlay → no event-bubbling
 * coordination needed.
 *
 * Layout (top to bottom):
 *  1. Square photo full-bleed (object-cover) or navy gradient initials
 *  2. Body: name (Fraunces 22, 2-line clamp); school line (UWC coin +
 *     campus link + year); origin line (flag coins + country names);
 *     location line (pin + city + "may have moved" pill).
 *  3. Footer: role / company stacked, LinkedIn tile right.
 *  4. (Optional) outreach slot for the shortlist card.
 *
 * The whole card click-targets the detail page via a stretched-link
 * overlay so inner anchors (campus, city, company filter links) work
 * naturally without nesting <a>s.
 */

import Link from "next/link";
import { Icon } from "./Icon";
import { FlagCoins, UwcCoin } from "./Coins";
import type { FlagMap, UwcLogoMap } from "@/lib/directory-lookups";

export interface AlumCardData {
  id: number;
  displayName: string;
  /** Already URL-formatted blob path. When null we render the initials
   * gradient fallback. */
  photoUrl: string | null;
  /** Face-detected focal point as percentages 0..100. Falls back to
   * a head-favouring default ("50 25") when null. */
  photoFocalX: number | null;
  photoFocalY: number | null;
  /** Pre-baked head-focused JPEG (tight crop, ~1.64:1 aspect).
   * Used in the 220 px wide band — the shortlist always, and the
   * directory on ≤560px (mobile). Falls back to photoUrl + focal
   * when null. */
  photoHeadshotUrl: string | null;
  initials: string;
  /** Canonical (with "UWC " prefix) — used for filter links. */
  uwcCanonical: string | null;
  /** Display version (campus only). */
  campus: string | null;
  gradYear: number | null;
  /** ISO-2 country codes extracted from alumni.origin. */
  originIsos: string[];
  /** City name as already title-cased for display. */
  city: string | null;
  /** When true, append the "may have moved" pill next to the city. */
  moved: boolean;
  role: string | null;
  company: string | null;
  /** Resolved external LinkedIn URL (already validated). */
  linkedinHref: string | null | undefined;
  /** Optional explicit company href; same nullability semantics. */
  companyHref: string | null | undefined;
}

interface Props {
  alum: AlumCardData;
  uwcLogos: UwcLogoMap;
  flags: FlagMap;
  /** Where ← Back should land. Passed through to the detail link's
   * `?from=` so filter context survives. */
  backFrom: string;
  /** Client save-star, rendered in the top-right photo overlay. */
  star: React.ReactNode;
  /** Optional outreach footer for the shortlist. */
  footer?: React.ReactNode;
  /** Pixel height of the photo band. Omit to use the responsive
   * default (220px on ≤560px, 230px above). Photo always crops
   * with object-cover + object-position: 50% 20% so faces land
   * cleanly inside the band — the source image's aspect never
   * drives the card's own height. */
  photoHeight?: number;
}

/**
 * Picks the right photo source(s) for the card's photo band.
 * - Shortlist (photoHeight set) → always the wide-band headshot.
 * - Directory + mobile (≤560px) → wide band → use headshot.
 * - Directory + desktop (≥561px) → square aspect → use full photo +
 *   focal-point object-position.
 *
 * The two-image desktop/mobile split renders both <img> tags and
 * relies on CSS media-query visibility classes to show only one.
 * `display: none` images don't fetch in modern Chromium/Safari, so
 * the cost is minimal.
 */
function PhotoLayer({
  alum,
  photoHeight,
}: {
  alum: AlumCardData;
  photoHeight?: number;
}) {
  const focalStyle = {
    objectPosition:
      alum.photoFocalX != null && alum.photoFocalY != null
        ? `${alum.photoFocalX}% ${alum.photoFocalY}%`
        : "50% 25%",
  };
  // Wide-band source: headshot when we have one, otherwise the
  // full photo with the focal-point fallback (still better than
  // nothing while the bake catches up).
  const wideSrc = alum.photoHeadshotUrl ?? alum.photoUrl!;
  const wideStyle = alum.photoHeadshotUrl ? undefined : focalStyle;

  if (photoHeight != null) {
    // Shortlist — always wide band.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={wideSrc}
        alt=""
        className="w-full h-full object-cover block"
        style={wideStyle}
        loading="lazy"
      />
    );
  }

  // Directory: mobile = wide band (headshot), desktop = square (full).
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wideSrc}
        alt=""
        className="w-full h-full object-cover block [@media(min-width:561px)]:hidden"
        style={wideStyle}
        loading="lazy"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={alum.photoUrl!}
        alt=""
        className="w-full h-full object-cover hidden [@media(min-width:561px)]:block"
        style={focalStyle}
        loading="lazy"
      />
    </>
  );
}

export function AlumGalleryCard({
  alum,
  uwcLogos,
  flags,
  backFrom,
  star,
  footer,
  photoHeight,
}: Props) {
  const detailHref = `/directory/${alum.id}?from=${encodeURIComponent(backFrom)}`;
  const campusHref = alum.uwcCanonical
    ? `/directory?college=${encodeURIComponent(alum.uwcCanonical)}`
    : null;
  const cityHref = alum.city
    ? `/directory?city=${encodeURIComponent(alum.city)}`
    : null;
  const yearHref =
    alum.gradYear != null
      ? `/directory?yearFrom=${alum.gradYear}&yearTo=${alum.gradYear}`
      : null;

  return (
    <article className="relative bg-white rounded-[18px] overflow-hidden flex flex-col shadow-[0_2px_0_rgba(2,28,56,.4),0_30px_56px_-30px_rgba(0,0,0,.6)] transition-transform transition-shadow duration-200 hover:-translate-y-[3px] hover:shadow-[0_2px_0_rgba(2,28,56,.4),0_40px_70px_-30px_rgba(0,0,0,.66)]">
      <div className="relative">
        {/* Photo is a fixed-height band — the alum photo's natural
            height never drives the card's height. Faces are cropped
            top-favoured via object-position: 50% 20%. */}
        <Link
          href={detailHref}
          aria-label={alum.displayName}
          className={
            photoHeight != null
              ? "block bg-[color:var(--ivory-2)] overflow-hidden"
              : // Mobile (≤560px): a strict 220px band so the card's
                // height isn't dictated by the source image. Desktop
                // (>560px): back to the 1:1 aspect — desktop cards
                // line up well as squares.
                "block bg-[color:var(--ivory-2)] overflow-hidden h-[220px] [@media(min-width:561px)]:h-auto [@media(min-width:561px)]:aspect-square"
          }
          style={photoHeight != null ? { height: `${photoHeight}px` } : undefined}
        >
          {alum.photoUrl ? (
            <PhotoLayer alum={alum} photoHeight={photoHeight} />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white"
              style={{
                background:
                  "radial-gradient(circle at 36% 28%, #3a86d0, #134a82 62%, #0b2545)",
                fontFamily: "Fraunces, Georgia, serif",
                fontWeight: 600,
                fontSize: "60px",
                letterSpacing: "0.02em",
              }}
            >
              {alum.initials}
            </div>
          )}
        </Link>
        {/* Star sits above the photo so it captures its own click. */}
        <div className="absolute top-3 right-3 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
          {star}
        </div>
      </div>

      <div className="p-[15px_20px_18px]">
        <h3
          className="font-bold leading-[1.12] line-clamp-2"
          style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22 }}
        >
          <Link
            href={detailHref}
            className="text-[color:var(--navy-ink)] hover:underline underline-offset-[3px]"
          >
            {alum.displayName}
          </Link>
        </h3>

        {(alum.campus || alum.gradYear != null || alum.originIsos.length > 0) && (
          <div className="flex items-center flex-wrap gap-2 mt-[9px] text-[15px]">
            {alum.uwcCanonical && (
              <UwcCoin
                logoUrl={uwcLogos[alum.uwcCanonical] ?? null}
                campusName={alum.campus ?? alum.uwcCanonical}
              />
            )}
            {alum.campus &&
              (campusHref ? (
                <Link
                  href={campusHref}
                  className="text-navy font-semibold whitespace-nowrap hover:underline underline-offset-[3px]"
                >
                  {alum.campus}
                </Link>
              ) : (
                <span className="text-navy font-semibold whitespace-nowrap">
                  {alum.campus}
                </span>
              ))}
            {alum.gradYear != null && (
              <span className="text-[color:var(--muted)] font-medium whitespace-nowrap">
                ·{" "}
                {yearHref ? (
                  <Link
                    href={yearHref}
                    className="hover:text-navy hover:underline underline-offset-[3px]"
                  >
                    {alum.gradYear}
                  </Link>
                ) : (
                  alum.gradYear
                )}
              </span>
            )}
            {alum.originIsos.length > 0 && (
              <FlagCoins
                isos={alum.originIsos}
                flags={flags}
                size={18}
                linkBuilder={(iso) => {
                  const name =
                    flags[iso.toLowerCase()]?.name ?? iso.toUpperCase();
                  return `/directory?origin=${encodeURIComponent(name)}`;
                }}
              />
            )}
          </div>
        )}

        {(alum.city || alum.moved) && (
          <div className="flex items-center flex-wrap gap-2 mt-[5px] text-[14px] text-[color:var(--muted)]">
            <Icon name="map-pin" size={15} />
            {alum.city &&
              (cityHref ? (
                <Link
                  href={cityHref}
                  className="hover:text-navy hover:underline underline-offset-[3px] whitespace-nowrap"
                >
                  {alum.city}
                </Link>
              ) : (
                <span className="whitespace-nowrap">{alum.city}</span>
              ))}
            {alum.moved && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[color:var(--muted-2)] border border-[color:var(--rule)] rounded-full px-2 py-[2px]">
                <Icon name="plane-takeoff" size={12} />
                may have moved
              </span>
            )}
          </div>
        )}

        {(alum.role || alum.company) && (
          <div className="flex items-center justify-between gap-3 mt-[13px] pt-[12px] border-t border-[color:var(--rule)]">
            <div className="flex flex-col gap-[1px] min-w-0">
              {alum.role && (
                <span
                  className="text-[12.5px] leading-[1.3] text-[color:var(--muted-2)] truncate"
                  title={alum.role}
                >
                  {alum.role}
                </span>
              )}
              {alum.company &&
                (alum.companyHref ? (
                  <a
                    href={alum.companyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy font-semibold text-[13px] leading-[1.3] truncate hover:underline underline-offset-[2px]"
                    title={alum.company}
                  >
                    {alum.company}
                  </a>
                ) : (
                  <span
                    className="text-navy font-semibold text-[13px] leading-[1.3] truncate"
                    title={alum.company}
                  >
                    {alum.company}
                  </span>
                ))}
            </div>
            {alum.linkedinHref ? (
              <a
                href={alum.linkedinHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile"
                className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-[6px] bg-[#0A66C2] text-white text-[13px] font-bold leading-none shrink-0 hover:brightness-110"
              >
                in
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-[6px] bg-[color:var(--ivory-2)] text-[color:var(--muted)] text-[13px] font-bold leading-none shrink-0"
                title="No LinkedIn on file"
              >
                in
              </span>
            )}
          </div>
        )}
      </div>

      {footer && <div className="relative z-10 mt-auto">{footer}</div>}
    </article>
  );
}
