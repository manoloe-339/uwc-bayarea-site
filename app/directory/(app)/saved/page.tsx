import { redirect } from "next/navigation";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { listSavesForUser } from "@/lib/directory-saves";
import { getFlagMap, getUwcLogoMap } from "@/lib/directory-lookups";
import SavedList from "@/components/directory/SavedList";

export const dynamic = "force-dynamic";

export default async function SavedShortlistPage() {
  const session = await getCurrentDirectorySession();
  if (!session) redirect("/directory/login?next=%2Fdirectory%2Fsaved");
  if (session.kind !== "user") {
    return (
      <section className="max-w-[800px] mx-auto px-5 sm:px-7 py-10">
        <h1
          className="display text-white font-extrabold mb-2"
          style={{ fontSize: "clamp(28px, 5vw, 38px)" }}
        >
          Sign in with a personal account
        </h1>
        <p className="text-white/75 text-sm">
          The saved-shortlist feature requires a personal directory account.
          Ask the admin to invite you, or sign out and back in with your
          personal credentials.
        </p>
      </section>
    );
  }

  const [allSaves, uwcLogos, flags] = await Promise.all([
    listSavesForUser(session.user.id),
    getUwcLogoMap(),
    getFlagMap(),
  ]);

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 pt-3 pb-8 md:py-8">
      <div className="mb-6">
        <h1
          className="hidden md:block text-white font-extrabold leading-[1] tracking-[-0.02em]"
          style={{
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: "clamp(30px, 5.5vw, 38px)",
          }}
        >
          Your shortlist
        </h1>
        <p className="md:mt-[10px] text-[15px] text-white/75 max-w-[68ch]">
          Keep track of outreach and connections.
        </p>
      </div>
      <SavedList allSaves={allSaves} uwcLogos={uwcLogos} flags={flags} />
    </section>
  );
}
