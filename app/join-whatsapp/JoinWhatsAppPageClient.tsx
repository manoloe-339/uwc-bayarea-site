"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { JoinWhatsAppModal } from "@/app/preview-home/JoinWhatsAppModal";
import Link from "next/link";

interface Props {
  whatsappUrl: string | null;
}

/**
 * Page wrapper that holds the modal open and routes the lifecycle
 * events: dismiss returns to home, successful submission goes to the
 * dedicated thanks page (so the URL reflects the new state and the
 * user can refresh / share without resubmitting).
 *
 * Query params:
 *   ?registered=1  — skip the "Bay Area or visiting" gate AND the
 *                    "are you already registered" question; open
 *                    straight on the email-entry form. Used in the
 *                    signup-confirmation email so people who just
 *                    registered land on a single-step form.
 */
export default function JoinWhatsAppPageClient({ whatsappUrl }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const initialView =
    sp.get("registered") === "1" ? "registered-form" : undefined;

  return (
    <div className="min-h-screen bg-[color:var(--ivory)] relative">
      {/* Light page chrome behind the modal — keeps the link feeling
          like part of the site rather than a bare popup, and gives
          users a way back home if they change their mind without
          touching the modal X. */}
      <div className="absolute top-5 left-5 z-10">
        <Link
          href="/"
          className="text-xs tracking-[.22em] uppercase font-bold text-navy hover:underline"
        >
          ← uwcbayarea.org
        </Link>
      </div>

      <JoinWhatsAppModal
        whatsappUrl={whatsappUrl}
        controlledOpen={true}
        controlledOnClose={() => router.push("/")}
        onSent={() => router.push("/join-whatsapp/thanks")}
        initialView={initialView}
      />
    </div>
  );
}
