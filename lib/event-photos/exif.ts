import exifr from "exifr";

/**
 * Best-effort EXIF capture-date extraction. Tries DateTimeOriginal first
 * (when the photo was taken), falls back to CreateDate / DateTime. Returns
 * null on any error or when no relevant tag is present (screenshots,
 * sanitized images, formats without EXIF).
 */
export async function extractTakenAt(buffer: Buffer): Promise<Date | null> {
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
    if (!d) return null;
    // exifr returns Date instances for these fields. Validate.
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    // Sanity: drop anything before 1990 or far in the future (broken EXIF).
    const year = d.getUTCFullYear();
    if (year < 1990 || year > new Date().getUTCFullYear() + 1) return null;
    return d;
  } catch {
    return null;
  }
}
