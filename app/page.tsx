import DesktopFlyer from "@/components/DesktopFlyer";
import MobileFlyer from "@/components/MobileFlyer";

export default function Home() {
  return (
    <main className="min-h-screen bg-ivory">
      {/* Mobile: stacked single column */}
      <div className="md:hidden">
        <MobileFlyer />
      </div>

      {/* Tablet / desktop: the fixed-ratio flyer, centered with padding */}
      <div className="hidden md:flex min-h-screen items-center justify-center p-6 md:p-10">
        <DesktopFlyer />
      </div>
    </main>
  );
}
