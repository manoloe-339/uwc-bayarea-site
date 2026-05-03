import DesktopFlyer from "@/components/DesktopFlyer";
import MobileFlyer from "@/components/MobileFlyer";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PageviewBeacon from "@/components/analytics/PageviewBeacon";
import { getSeatsRemaining } from "@/lib/live";
import { MissedEventOverlay } from "./MissedEventOverlay";

export const revalidate = 30;

const MAY_1_GALLERY_HREF = "/events/may-1-2026-dinner/photos";

/** Archived May 1 2026 fireside flyer — was the homepage takeover for
 * the eSwatini + Faith fireside. Preserved here as a look-back page
 * after the homepage was swapped to the editorial design. The
 * MissedEventOverlay sits on top to tell late visitors the event
 * has wrapped (with CTAs to the gallery and the signup). */
export default async function May12026Page() {
  const seatsRemaining = await getSeatsRemaining();

  return (
    <>
      <PageviewBeacon path="/may-1-2026" />
      <SiteHeader active="events" />
      <main className="bg-ivory relative">
        <div className="md:hidden min-h-[calc(100vh-80px)]">
          <MobileFlyer seatsRemaining={seatsRemaining} />
        </div>
        <div className="hidden md:flex min-h-[calc(100vh-80px)] items-center justify-center p-6 md:p-10">
          <DesktopFlyer seatsRemaining={seatsRemaining} />
        </div>
        <MissedEventOverlay galleryHref={MAY_1_GALLERY_HREF} />
      </main>
      <SiteFooter />
    </>
  );
}
