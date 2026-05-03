"use client";

import { useState } from "react";
import { JoinWhatsAppModal } from "./JoinWhatsAppModal";

interface Props {
  /** Restaurant / meal name shown as the card heading. */
  name: string;
  /** Optional inline emoji rendered after the name (e.g. 🍝). */
  emoji: string | null;
  /** Bigger styling for the featured (hero) Foodies card. */
  featured: boolean;
  /** Optional WhatsApp join URL — passed to the modal in case the user
   * is already registered and just wants the direct link. */
  whatsappUrl: string | null;
}

/** Renders the Foodies card title as a click-to-open WhatsApp modal.
 * Reuses the same JoinWhatsAppModal flow as the homepage WhatsApp band
 * (Bay Area / Just visiting paths), with a Foodies-specific intro
 * making it clear that meals are coordinated on WhatsApp. */
export function FoodiesCardTitle({ name, emoji, featured, whatsappUrl }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block text-left font-serif font-semibold leading-[1.08] tracking-[-0.005em] text-[color:var(--navy-ink)] m-0 cursor-pointer underline underline-offset-[6px] decoration-[2px] decoration-navy/50 hover:decoration-navy ${
          featured ? "text-[30px] sm:text-[38px]" : "text-[22px] sm:text-[24px]"
        }`}
      >
        {name}
        {emoji && <span className="ml-2 align-middle">{emoji}</span>}
      </button>
      <JoinWhatsAppModal
        whatsappUrl={whatsappUrl}
        controlledOpen={open}
        controlledOnClose={() => setOpen(false)}
        chooseTitle={
          <>
            Coordinated on <em className="italic">WhatsApp</em>
          </>
        }
        chooseBody={`Foodies meals — including ${name} — are coordinated through our SF Bay Area WhatsApp community. Join to RSVP, ask the hosts a question, and get the details.`}
      />
    </>
  );
}
