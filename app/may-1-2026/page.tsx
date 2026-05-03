import DesktopFlyer from "@/components/DesktopFlyer";
import MobileFlyer from "@/components/MobileFlyer";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PageviewBeacon from "@/components/analytics/PageviewBeacon";
import { getSeatsRemaining } from "@/lib/live";

export const revalidate = 30;

/** Archived May 1 2026 fireside flyer — was the homepage takeover for
 * the eSwatini + Faith fireside. Preserved here as a look-back page
 * after the homepage was swapped to the editorial design. */
export default async function May12026Page() {
  const seatsRemaining = await getSeatsRemaining();

  return (
    <>
      <PageviewBeacon path="/may-1-2026" />
      <SiteHeader active="events" />
      <main className="bg-ivory">
        <div className="md:hidden min-h-[calc(100vh-80px)]">
          <MobileFlyer seatsRemaining={seatsRemaining} />
        </div>
        <div className="hidden md:flex min-h-[calc(100vh-80px)] items-center justify-center p-6 md:p-10">
          <DesktopFlyer seatsRemaining={seatsRemaining} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
