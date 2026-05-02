import Link from "next/link";
import { listEventsForHeroPicker } from "@/lib/hero-slides";
import { createHeroSlideAction } from "../../actions";
import SlideForm from "../../SlideForm";

export const dynamic = "force-dynamic";

export default async function NewSlidePage() {
  const events = await listEventsForHeroPicker();
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
        New hero slide
      </h1>
      <SlideForm
        events={events}
        action={createHeroSlideAction}
        submitLabel="Create slide"
        initial={{
          event_id: null,
          eyebrow: "",
          title: "",
          emphasis: "",
          byline: "",
          cta_label: "See more photos →",
          cta_href: "",
          image_url: "",
          sort_order: 0,
          enabled: true,
        }}
      />
    </div>
  );
}
