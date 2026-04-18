import { event } from "@/lib/event";

export default function TicketCTA() {
  return (
    <a
      href={event.ticketUrl}
      target="_blank"
      rel="noreferrer"
      className="block w-full text-center rounded-full py-4 px-6 font-bold tracking-[.12em] uppercase text-[14px] text-white shadow-lg hover:brightness-110 active:scale-[.98] transition"
      style={{ background: "var(--navy)" }}
    >
      Get Tickets · {event.price}
      <span className="ml-2" aria-hidden>→</span>
    </a>
  );
}
