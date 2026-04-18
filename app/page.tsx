import DesktopFlyer from "@/components/DesktopFlyer";
import MobileFlyer from "@/components/MobileFlyer";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteHeader active="events" />
      <main className="bg-ivory">
        {/* Mobile: stacked single column */}
        <div className="md:hidden min-h-[calc(100vh-80px)]">
          <MobileFlyer />
        </div>

        {/* Tablet / desktop: the fixed-ratio flyer, centered with padding */}
        <div className="hidden md:flex min-h-[calc(100vh-80px)] items-center justify-center p-6 md:p-10">
          <DesktopFlyer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
