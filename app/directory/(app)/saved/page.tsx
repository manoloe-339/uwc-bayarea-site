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
        <h1 className="font-sans text-2xl font-bold text-[color:var(--navy-ink)] mb-2">
          Sign in with a personal account
        </h1>
        <p className="text-[color:var(--muted)] text-sm">
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
      <h1 className="font-sans text-[28px] sm:text-[34px] font-bold text-[color:var(--navy-ink)] tracking-[-0.01em]">
        Your shortlist
      </h1>
      <SavedList allSaves={allSaves} />
    </section>
  );
}
