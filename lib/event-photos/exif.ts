import exifr from "exifr";

function isValidDate(d: Date | null): d is Date {
  if (!d || isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  // Sanity: drop anything before 1990 or far in the future (broken EXIF / bogus filename match).
  if (year < 1990 || year > new Date().getUTCFullYear() + 1) return false;
  return true;
}

/**
 * Try to read DateTimeOriginal / CreateDate / DateTime from EXIF.
 * Returns null when there's no relevant tag (screenshots, WhatsApp-stripped
 * images, formats without EXIF) or on any parser error.
 */
async function extractFromExif(buffer: Buffer): Promise<Date | null> {
  try {
    const exif = (await exifr.parse(buffer, [
      "DateTimeOriginal",
      "CreateDate",
      "DateTime",
    ])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date; DateTime?: Date }
      | undefined;
    if (!exif) return null;
    const d = exif.DateTimeOriginal ?? exif.CreateDate ?? exif.DateTime;
    if (!(d instanceof Date)) return null;
    return isValidDate(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Try to recover a capture date from common filename patterns when EXIF
 * has been stripped (WhatsApp, macOS screenshots, Android camera apps,
 * date-prefixed filenames). Returns null when no pattern matches.
 *
 * Patterns covered:
 *   WhatsApp Image YYYY-MM-DD at HH.MM.SS.jpeg
 *   Screenshot YYYY-MM-DD at HH.MM.SS [AM|PM].png  (macOS)
 *   IMG_YYYYMMDD_HHMMSS.jpg                         (Android)
 *   IMG-YYYYMMDD-WAxxxx.jpg                         (WhatsApp Android)
 *   PXL_YYYYMMDD_HHMMSS*.jpg                        (Pixel)
 *   YYYY-MM-DD anything.{ext}                       (Plain leading date)
 *   YYYYMMDD anything                               (Compact leading date)
 */
export function extractDateFromFilename(filename: string | null | undefined): Date | null {
  if (!filename) return null;

  // YYYY-MM-DD with optional time HH.MM.SS or HH:MM:SS or HHMMSS
  const dashed = filename.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[\s_T]+(?:at\s+)?(\d{2})[.:](\d{2})(?:[.:](\d{2}))?)?/
  );
  if (dashed) {
    const [, y, m, d, hh, mm, ss] = dashed;
    const date = new Date(
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        hh ? Number(hh) : 12,
        mm ? Number(mm) : 0,
        ss ? Number(ss) : 0
      )
    );
    if (isValidDate(date)) return date;
  }

  // YYYYMMDD with optional _HHMMSS (compact form: PXL_, IMG_, IMG-)
  const compact = filename.match(/(\d{4})(\d{2})(\d{2})(?:[_-](\d{2})(\d{2})(\d{2}))?/);
  if (compact) {
    const [, y, m, d, hh, mm, ss] = compact;
    const yearNum = Number(y);
    // Avoid matching things like a 4-digit number followed by random digits;
    // only accept if year is plausible.
    if (yearNum >= 1990 && yearNum <= new Date().getUTCFullYear() + 1) {
      const date = new Date(
        Date.UTC(
          yearNum,
          Number(m) - 1,
          Number(d),
          hh ? Number(hh) : 12,
          mm ? Number(mm) : 0,
          ss ? Number(ss) : 0
        )
      );
      if (isValidDate(date) && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
        return date;
      }
    }
  }

  return null;
}

/**
 * Best-effort capture-date extraction. EXIF first, then filename patterns
 * as a fallback (WhatsApp / screenshots / etc. where metadata was stripped).
 */
export async function extractTakenAt(
  buffer: Buffer,
  filename?: string | null
): Promise<Date | null> {
  const fromExif = await extractFromExif(buffer);
  if (fromExif) return fromExif;
  return extractDateFromFilename(filename ?? null);
}
