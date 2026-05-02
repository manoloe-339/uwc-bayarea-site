import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHeroSlideById,
  listEventsForHeroPicker,
  parseExtraImageSettings,
} from "@/lib/hero-slides";
import { getApprovedPhotosOrdered } from "@/lib/event-photos/queries";
import { updateHeroSlideAction } from "../../../actions";
import SlideForm from "../../../SlideForm";

export const dynamic = "force-dynamic";

export default async function EditSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slideId = Number(id);
  if (!Number.isFinite(slideId) || slideId <= 0) notFound();
  const [slide, events] = await Promise.all([
    getHeroSlideById(slideId),
    listEventsForHeroPicker(),
  ]);
  if (!slide) notFound();
  const update = updateHeroSlideAction.bind(null, slideId);

  // For the focal-point preview + extra-image calibration: pre-fetch the
  // linked event's gallery photos in display order. Same source as the
  // public hero's auto-fallback. Lets the admin see what the carousel
  // will render and tune each image individually.
  const galleryPhotos = slide.event_id
    ? (await getApprovedPhotosOrdered(slide.event_id)).map((p) => ({
        id: p.id,
        url: p.blob_url,
      }))
    : [];

  // The "primary" photo on position 0 is the slide's image_url override
  // when set, else the first gallery photo.
  const primaryImageUrl = slide.image_url ?? galleryPhotos[0]?.url ?? null;
  const defaultImagePreviewUrl = primaryImageUrl;

  // Photos available for positions 1..N — exclude the primary so we
  // don't show the same photo twice.
  const extraGallery = galleryPhotos.filter((p) => p.url !== primaryImageUrl);

  const extras = parseExtraImageSettings(slide.extra_image_settings);

  return (
    <div className="max-w-[760px]">
      <div className="mb-4 text-sm">
        <Link
          href="/admin/tools/homepage-settings"
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← Homepage settings
        </Link>
      </div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-6">
        Edit hero slide
      </h1>
      <SlideForm
        events={events}
        action={update}
        submitLabel="Save changes"
        defaultImagePreviewUrl={defaultImagePreviewUrl}
        extraGalleryPhotos={extraGallery}
        initial={{
          event_id: slide.event_id,
          eyebrow: slide.eyebrow ?? "",
          title: slide.title,
          emphasis: slide.emphasis ?? "",
          byline: slide.byline ?? "",
          cta_label: slide.cta_label ?? "",
          cta_href: slide.cta_href ?? "",
          image_url: slide.image_url ?? "",
          focal_point: slide.focal_point,
          zoom: typeof slide.zoom === "number" ? slide.zoom : Number(slide.zoom ?? 1),
          extra_image_settings: extras,
          sort_order: slide.sort_order,
          enabled: slide.enabled,
        }}
      />
    </div>
  );
}
