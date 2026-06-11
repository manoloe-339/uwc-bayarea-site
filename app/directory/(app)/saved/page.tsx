import { redirect } from "next/navigation";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { listSavesForUser } from "@/lib/directory-saves";
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

  const allSaves = await listSavesForUser(session.user.id);

  return (
    <section className="max-w-[900px] mx-auto px-5 sm:px-7 py-8">
      <h1
        className="display text-white font-extrabold leading-[1.02] tracking-[-0.02em]"
        style={{ fontSize: "clamp(34px, 6vw, 54px)" }}
      >
        Your shortlist
      </h1>
      <SavedList allSaves={allSaves} />
    </section>
  );
}
