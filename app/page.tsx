import DesktopFlyer from "@/components/DesktopFlyer";
import MobileFlyer from "@/components/MobileFlyer";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PageviewBeacon from "@/components/analytics/PageviewBeacon";
import { getSeatsRemaining } from "@/lib/live";

export const revalidate = 30;

export default async function Home() {
  const seatsRemaining = await getSeatsRemaining();

  return (
    <>
      <PageviewBeacon path="/" />
      <SiteHeader active="events" />
      <main className="bg-ivory">
        {/* Mobile: stacked single column */}
        <div className="md:hidden min-h-[calc(100vh-80px)]">
          <MobileFlyer seatsRemaining={seatsRemaining} />
        </div>

        {/* Tablet / desktop: the fixed-ratio flyer, centered with padding */}
        <div className="hidden md:flex min-h-[calc(100vh-80px)] items-center justify-center p-6 md:p-10">
          <DesktopFlyer seatsRemaining={seatsRemaining} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
