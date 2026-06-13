"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  JoinWhatsAppModal,
  type InvitePrefill,
} from "@/app/preview-home/JoinWhatsAppModal";
import Link from "next/link";

interface Props {
  whatsappUrl: string | null;
  /** Server-verified prefill for ?invite=<token>. null when the
   *  param is missing / expired / tampered with — caller falls
   *  through to the standard "choose" entry. */
  invitePrefill: InvitePrefill | null;
}

/**
 * Page wrapper that holds the modal open and routes the lifecycle
 * events: dismiss returns to home, successful submission goes to the
 * dedicated thanks page.
 *
 * Query params:
 *   ?registered=1  — skip the gate questions; open on the email
 *                    entry form (user still types name).
 *   ?invite=<sig>  — trusted single-click; server-verified, modal
 *                    opens on "Send invite to <email>".
 */
export default function JoinWhatsAppPageClient({
  whatsappUrl,
  invitePrefill,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const initialView =
    sp.get("registered") === "1" ? "registered-form" : undefined;

  return (
    <div className="min-h-screen bg-[color:var(--ivory)] relative">
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
        invitePrefill={invitePrefill}
      />
    </div>
  );
}
