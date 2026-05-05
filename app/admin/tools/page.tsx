import Link from "next/link";
import { countPendingVisitingRequests } from "@/lib/visiting-requests";
import { countPendingRegisteredWhatsappRequests } from "@/lib/whatsapp-requests";

export const dynamic = "force-dynamic";

export default async function ToolsIndex() {
  const [pendingVisiting, pendingRegistered] = await Promise.all([
    countPendingVisitingRequests(),
    countPendingRegisteredWhatsappRequests(),
  ]);
  return (
    <div className="max-w-[900px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Admin tools</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Data-quality, enrichment, and bulk-import tools.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/admin/tools/discover"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Discover alumni</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Find Bay Area UWC alumni not yet in the DB</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Runs 18 LinkedIn-targeted searches via Serper + Exa, dedupes against
            existing alumni, surfaces new candidates. Scrape and add the ones
            you want.
          </p>
        </Link>
        <Link
          href="/admin/enrichment"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">LinkedIn enrichment</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Backfill profiles via Apify + Claude</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Triggers, review queue, failed jobs, manual overrides. The whole
            enrichment pipeline lives here.
          </p>
        </Link>
        <Link
          href="/admin/import"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Import</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Bulk-import alumni from CSV / external sources</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Paste or upload data, preview matches against existing rows, commit
            in one go.
          </p>
        </Link>
        <Link
          href="/admin/tools/classify"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Company classifier</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Tech / startup / public / subsidiary labels</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            One Claude call per unique company. Writes richer labels than LinkedIn&rsquo;s
            industry tag so filters like &ldquo;non-tech&rdquo; and &ldquo;real startup&rdquo; actually work.
          </p>
        </Link>
        <Link
          href="/admin/tools/duplicates"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Find duplicates</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Alumni rows sharing a LinkedIn URL or name</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Groups confirmed-dupe rows side-by-side with email, submit date,
            enrichment counts, and per-row Delete / swap-email actions. Safe
            to re-run any time new data comes in.
          </p>
        </Link>
        <Link
          href="/admin/tools/gender"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Gender classifier</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Male / female / they / unknown</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Uses first name + origin country + LinkedIn pronouns to classify
            each alumnus. Admin overrides on the detail page are preserved
            and never auto-overwritten.
          </p>
        </Link>
        <Link
          href="/admin/tools/photo-gallery-settings"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Photo galleries</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Public /photos page layout & slideshow</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Thumbnails per gallery row, marquee on/off, intro band on/off, and
            seconds-per-slide for the Present-mode slideshow.
          </p>
        </Link>
        <Link
          href="/admin/tools/signup-email"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Signup email</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Confirmation email sent on /signup</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Edit the subject line and message body of the welcome email new
            signups receive. Supports markdown links so you can point them at
            specific pages or events. Includes a live preview and a
            &ldquo;Send test&rdquo; button.
          </p>
        </Link>
        <Link
          href="/admin/tools/homepage-settings"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Homepage</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Hero carousel slides on the homepage</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Curate the editorial hero at the top of the new homepage. Each
            slide picks an event, sets headline copy, and uses the event&rsquo;s
            first photo as the background. With no slides, the hero falls back
            to the most recent past events with photos.
          </p>
        </Link>
        <Link
          href="/admin/help-out"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Help Out signups</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Volunteer interest from /help-out</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Triage submissions from the public Help Out form. Each shows
            whether the person matched your alumni directory, which areas
            they want to help with, and any free-text note. Mark contacted
            once you&rsquo;ve followed up.
          </p>
        </Link>
        <Link
          href="/admin/tools/whatsapp"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
              WhatsApp admin
            </div>
            {pendingVisiting + pendingRegistered > 0 && (
              <span className="text-[10px] tracking-[.18em] uppercase font-bold text-amber-700">
                {pendingVisiting + pendingRegistered} pending
              </span>
            )}
          </div>
          <div className="font-semibold text-[color:var(--navy-ink)]">
            Visiting requests, registered-alum requests, and the invite
            email template
          </div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Three tabs: Bay Area visitors who&rsquo;ve asked to join,
            registered alumni who&rsquo;ve clicked &ldquo;send me the
            link&rdquo; on the homepage modal (with one-click send), and
            the editable WhatsApp invite email itself.
          </p>
        </Link>
        <Link
          href="/admin/events/archive/photos"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Archive photos</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Past-website photos for the /photos marquee</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Drop in any historical photos (not tied to a specific event), approve
            them, and tag the ones you want as marquee. They flow to the top of
            /photos automatically and don&rsquo;t show up as their own gallery row.
          </p>
        </Link>
      </div>
    </div>
  );
}
