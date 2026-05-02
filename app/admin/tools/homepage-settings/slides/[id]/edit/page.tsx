import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHeroSlideById,
  listEventsForHeroPicker,
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

  // For the focal-point preview: if no image_url override, fall back to
  // the linked event's first approved photo (same logic the public hero
  // uses). Lets the admin see the actual photo they're calibrating.
  let defaultImagePreviewUrl: string | null = null;
  if (!slide.image_url && slide.event_id) {
    const photos = await getApprovedPhotosOrdered(slide.event_id);
    defaultImagePreviewUrl = photos[0]?.blob_url ?? null;
  }

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
          sort_order: slide.sort_order,
          enabled: slide.enabled,
        }}
      />
    </div>
  );
}
