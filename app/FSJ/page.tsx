import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "How to Host a UWC Bay Area Foodies Event",
  robots: { index: false, follow: false },
};

type View = "playbook" | "checklist";

export default async function FoodiesSanJosePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view: View = viewParam === "checklist" ? "checklist" : "playbook";

  return (
    <>
      <SiteHeader />
      <main className="bg-ivory">
        <article className="max-w-[680px] mx-auto px-5 sm:px-7 py-8 sm:py-14 text-[15px] sm:text-base">
          <h1 className="font-sans text-[26px] sm:text-4xl font-bold text-[color:var(--navy-ink)] mb-3 leading-tight">
            How to Host a UWC Bay Area Foodies Event
          </h1>

          <div className="flex items-center gap-1 border-b border-[color:var(--rule)] mb-6">
            <Link
              href="/FSJ"
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                view === "playbook"
                  ? "border-navy text-navy font-semibold"
                  : "border-transparent text-[color:var(--muted)] hover:text-navy"
              }`}
            >
              Playbook
            </Link>
            <Link
              href="/FSJ?view=checklist"
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                view === "checklist"
                  ? "border-navy text-navy font-semibold"
                  : "border-transparent text-[color:var(--muted)] hover:text-navy"
              }`}
            >
              Checklist
            </Link>
          </div>

          {view === "checklist" ? <Checklist /> : <Playbook />}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Playbook() {
  return (
    <>

          <Section title="What this is">
            <P>
              A UWC Bay Area Foodies event is an informal gathering of UWC alumni from
              any college, built around sharing a meal. It is inspired by the London
              Foodies group. The format is meant to be easy to organize so we can run
              more of these, more often, and especially outside San Francisco where
              alumni gatherings have been harder to pull off.
            </P>
            <P>
              A typical event is 5 to 12 people. Start small. Share a good meal, meet
              other UWC alumni in the South Bay.
            </P>
            <P>
              This playbook is in beta. We ran our first event in San Francisco,
              learned from it, and have another there on May 15. The San Jose event
              will be the first one outside SF. We are sharing what we have learned so
              far to help you run it well, and to keep improving the playbook. Feedback
              after your event is welcome.
            </P>
          </Section>

          <Section title="Pick the basics">
            <UL>
              <LI>
                <strong>Restaurant.</strong> Family-run, with a clear cuisine or theme.
                Avoid chains.
              </LI>
              <LI>
                <strong>Day and time.</strong> Friday or Saturday evenings, Saturday
                or Sunday brunch, or Sunday lunch. Be mindful of traffic. Encourage
                people to arrive a few minutes early so ordering does not start
                before everyone is there.
              </LI>
              <LI>
                <strong>Drinks policy.</strong> Default to drinks on your own tab (food
                split evenly, alcohol and premium drinks paid separately). Alternative:
                even split with a &ldquo;drink mindfully&rdquo; note so heavy drinkers
                chip in extra. Pick one and put it in the group description.
              </LI>
              <LI>
                <strong>Per-person cost.</strong> Aim for $30 to $45 per person before
                drinks. This keeps events accessible to recent grads and students. If
                the restaurant is likely to run higher, flag it in the announcement so
                people can decide.
              </LI>
              <LI>
                <strong>Dietary considerations.</strong> Before finalizing the menu,
                ask in the subgroup about dietary needs (vegetarian, vegan, halal,
                allergies). This matters especially for family-style ordering, where
                one person&rsquo;s restrictions shape what the whole table eats.
                Confirm the restaurant has solid options before locking it in.
              </LI>
              <LI>
                <strong>Side quest (optional, encouraged).</strong> Pair the meal with
                a museum visit, a neighborhood walk, or drinks afterward. Makes the
                trip worth it for alumni traveling in.
              </LI>
            </UL>
          </Section>

          <Section title="Coordinate with your lead organizer">
            <P>
              You have already connected with one of the Bay Area lead organizers. The
              goal from here is to keep it lightweight on both sides: you and your
              co-host handle the on-the-ground decisions, the organizer handles
              WhatsApp setup.
            </P>

            <H3>Step 1: Lock these down with your co-host</H3>
            <UL>
              <LI>
                Two hosts so you can share WhatsApp coverage in the days before the
                event.
              </LI>
              <LI>
                Theme or cuisine, date and start time, general area (e.g. downtown San
                Jose, Santana Row, Japantown). These are the announcement essentials.
              </LI>
              <LI>Restaurant. Ideally locked in, but can be finalized after the announcement.</LI>
              <LI>RSVP cutoff date.</LI>
              <LI>Ordering style. Individual orders with even split, or family-style.</LI>
              <LI>Drinks policy.</LI>
              <LI>
                Deposit. If the restaurant requires a reservation, a $15 Venmo deposit
                is standard. Decide whose Venmo handle receives it.
              </LI>
              <LI>Side quest, if any.</LI>
            </UL>

            <H3>Step 2: Submit the Foodies Host Form</H3>
            <P>
              Fill out the form (linked below) so the organizer has everything they
              need to set up the WhatsApp subgroup and post the announcement. The form
              has sensible defaults filled in (drinks policy, deposit amount, ordering
              style), and is a living document you can update as details firm up.
            </P>
            <P className="text-[color:var(--muted)] italic">
              [Link to form, coming soon]
            </P>

            <H3>Step 3: What the organizer sets up</H3>
            <UL>
              <LI>
                The WhatsApp subgroup on the Bay Area Community (e.g. &ldquo;San Jose
                Vietnamese Dinner, Sat May 17&rdquo;), with admin approval required for
                new members.
              </LI>
              <LI>Admin rights for you and your co-host.</LI>
              <LI>The group description populated with your details.</LI>
              <LI>
                The announcement post in three places: the General chat, the Foodies
                subgroup, and the relevant regional group (e.g. the Peninsula group
                for a South Bay event, the East Bay group for Berkeley / Oakland, etc.).
              </LI>
            </UL>
            <P>
              From there, the event is yours to run. Loop the organizer back in if
              something material changes (date, restaurant swap).
            </P>
          </Section>

          <Section title="How I can help drive attendance">
            <P>
              Beyond the WhatsApp announcement, I can give your event an extra push,
              especially useful for a first-in-region event like San Jose where the
              WhatsApp Community alone may not surface enough people. Two things I can
              do:
            </P>
            <UL>
              <LI>
                <strong>Targeted email.</strong> A short note with the link to the
                WhatsApp subgroup, sent to alumni in the area.
              </LI>
              <LI>
                <strong>Database outreach.</strong> I can pull alumni in the relevant
                region from the UWC Bay Area database and ping them directly, which
                tends to work well for the first event in a new region where personal
                nudges matter more than broadcast posts.
              </LI>
            </UL>
          </Section>

          <Section title="Announcement now, details later">
            <P>
              The announcement only needs theme, date and time, general area, and
              hosts. Everything else can be added to the group description as it firms
              up.
            </P>
            <P>
              If you&rsquo;d rather post the announcement yourself in any of the three
              places (General, Foodies, regional group) instead of having the
              organizer do it, that&rsquo;s fine — but use the standardized template
              below. Consistent copy across all three groups keeps Foodies events
              easy to recognize and easy for the community to manage.
            </P>
            <P>
              This might seem like a lot, but we&rsquo;re trying a new format that we
              hope other UWC city groups (London, Boston, etc.) will adopt — keeping
              the look consistent makes it easy for alumni who travel between cities
              to recognize a Foodies event the moment they see it. Thanks for your
              understanding.
            </P>
            <Template title="Sample announcement — San Jose, May 8 (adapt for your event):">
{`🍜 NEW: UWC Foodies — San Jose, May 8 (Friday)

Kicking off Foodies in the South Bay! Vietnamese dinner in Little Saigon, family-run spot, ~6:30 PM start.

📅 Friday May 8, 6:30 PM
📍 San Jose, Little Saigon area (exact restaurant locked in soon)
👋 Hosted by Lale (UWC Mostar) + Jaap (Waterford Kamhlaba)

~$30–35 pp before drinks. Family-style ordering — let us know in the subgroup if you have dietary needs and we'll work around it.

Want in? Join the subgroup → [WhatsApp invite link]
RSVP cutoff: Tuesday May 5.

Questions? DM either of us or drop them in the subgroup.`}
            </Template>
          </Section>

          <Section title="Hosts WhatsApp group">
            <P>
              We will set up a separate WhatsApp group for hosts and lead organizers.
              Use it for questions as you plan, to share what is working, and to flag
              anything the playbook should pick up. It is a low-traffic space, just for
              hosts.
            </P>
          </Section>

          <Section title="Short-notice events">
            <P>
              If your event is under two weeks out, a reservation (and therefore a
              deposit) may not be possible. That is fine, but expect more flaking.
              Compensate with frequent reminders and a day-before headcount
              confirmation with the restaurant.
            </P>
            <P>Whenever possible, aim for 2 to 3 weeks of runway.</P>
          </Section>

          <Section title="Reservations vs. show-up-and-figure-it-out">
            <P>
              The San Jose event may end up running on a more casual &ldquo;anyone who
              shows up, we figure it out&rdquo; basis if the timeline is too tight for
              a reservation. That is a valid mode for a first event, especially in a
              new region.
            </P>
            <P>
              For reference, the San Francisco events have gone the other direction.
              Headcount variability tends to be large, anywhere from 6 to 20 people
              depending on the date and theme, and family-run restaurants cannot easily
              absorb a group that suddenly doubles. Our May 15 event, for example, is
              at a family-style restaurant where a large unannounced group would be a
              real problem, so we opted for a reservation with a $15 Venmo deposit to
              lock in the count.
            </P>
            <P>
              The general guidance: if the restaurant can comfortably handle walk-ins
              of variable size, you can run looser. If it is small, family-run, or
              family-style in its ordering, default to a reservation and deposit.
            </P>
          </Section>

          <Section title="Why WhatsApp only">
            <P>
              All Foodies coordination happens on WhatsApp. Not Facebook, not email,
              not Partiful. It is where alumni already are and fast enough for day-of
              logistics.
            </P>
          </Section>

          <Section title="Why each event gets its own subgroup">
            <P>
              This is the single most important rule. Each event lives in a closed
              subgroup (admin approval required for new members), separate from the
              main Foodies chat and the regional group.
            </P>
            <P>
              You and your co-host will be admins on the subgroup along with the lead
              organizer, and approving join requests is one of your responsibilities.
            </P>
            <P>
              The reason: the day-of an event easily generates 50+ messages about
              parking, late arrivals, where to meet inside a mall, etc. If that traffic
              lands in the main Foodies chat or the regional group, it overwhelms
              everyone who is not attending and trains people to mute the group, which
              then means they miss the next announcement. Keeping logistics in a
              dedicated subgroup protects the main channels from noise and keeps them
              useful.
            </P>
            <P>
              Subgroups are archived once the event wraps. People who want to join
              future events join the next subgroup, not the old one.
            </P>
          </Section>

          <Section title="Be mindful of late joiners">
            <P>
              People trickle into the subgroup over days or weeks, often in bursts
              after announcements or reminders. New members do not see messages posted
              before they joined.
            </P>
            <Screenshot
              src="/fsj/late-joiners-example.png"
              alt="Itinerary post followed by a stream of new members joining via group link"
              w={1320}
              h={932}
              caption="The itinerary went out at 2:42 PM. Anyone who joined after that doesn't see it."
            />
            <P>A few ways to work around this:</P>
            <UL>
              <LI>
                <strong>Wait for critical mass before posting key info.</strong> If you
                drop ordering details or the deposit handle too early, the people who
                join next week will never see it.
              </LI>
              <LI>
                <strong>Use the group description as the durable source of truth.</strong>{" "}
                Everyone sees it, regardless of when they joined. Repost key details
                there as they firm up.
                <Screenshot
                  src="/fsj/group-description-example.png"
                  alt="WhatsApp group description showing welcome message, deposit, RSVP deadline, ordering style"
                  w={962}
                  h={630}
                  caption="Sample group description: deposit, RSVP deadline, ordering style, where to ask questions."
                />
                <Template title="Sample group description — San Jose, May 8:">
{`San Jose Vietnamese Dinner · Friday May 8

Join us for the first UWC Bay Area Foodies meetup in the South Bay! 🍜 Details on the restaurant, time, and menu will be shared here as we confirm them.

🎫 $15 deposit via Venmo to confirm your spot — @Lale-Sample
📅 RSVP deadline: Tuesday May 5
🥢 Ordering style: family-style (we'll order together for the table)
🥬 Dietary needs: drop a note here so we pick a place that works for everyone

Questions? Ask here or in the main Foodies group.`}
                </Template>
              </LI>
              <LI>
                <strong>Polls work well, but you may need to run them more than once</strong>{" "}
                as new waves of members arrive.
                <Screenshot
                  src="/fsj/poll-example.png"
                  alt="Resent WhatsApp poll asking which parts of the Foodies trek attendees will join"
                  w={1264}
                  h={904}
                  caption="Resending the side-quest poll once new members had joined."
                />
              </LI>
              <LI>
                <strong>Telegraph upcoming activity.</strong> A new joiner who lands in
                a quiet group has no idea whether anything is happening. Counteract
                this with a recurring message that signals what is coming next, for
                example: &ldquo;Heads up: poll going out 4 days before the event to
                confirm vegetarian counts and whether you&rsquo;re joining the side
                quest or just the restaurant. If you&rsquo;ve just joined, hang tight,
                more info on the way.&rdquo; Repeating this anchor message every few
                days keeps late joiners oriented and prevents them from assuming the
                group has gone dormant.
              </LI>
            </UL>
          </Section>

          <Section title="Host responsibilities">
            <P>
              <strong>Before:</strong> approve join requests, track RSVPs and deposits,
              confirm the reservation a week out, keep the group description updated.
            </P>
            <P>
              <strong>Day before and day of:</strong> send a reminder with address,
              time, and parking notes. Be active on WhatsApp, expect lots of
              last-minute logistics messages.
            </P>
            <Screenshot
              src="/fsj/day-of-logistics-example.png"
              alt="Day-of WhatsApp chat: late arrivals, where to meet inside the mall, what the host is wearing, and last-minute drop-outs"
              w={1126}
              h={1020}
              caption="Day-of logistics chatter: where to meet, what to wear, who can or can't make it. Plan to be on the chat."
            />
            <P>
              Set the payment expectation upfront: one person puts the card down,
              everyone Venmos before leaving the table. Food split evenly, drinks per
              your policy.
            </P>
            <Screenshot
              src="/fsj/day-of-example.png"
              alt="Day-of WhatsApp message: itinerary recap, who's joining each stop, table-size note, and Venmo policy clarification"
              w={1166}
              h={976}
              caption="Day-of post: re-state the itinerary, who's joining each stop, and any logistics changes (table split, payment expectations)."
            />
            <P>
              <strong>During:</strong> take a photo of the food when it arrives (before
              anyone digs in) and a few of people mingling. Photos are required.
            </P>

            <p className="text-[color:var(--muted)] text-sm mt-4 mb-2">
              Examples: mingling at the event, side quest, and food arrival.
            </p>
            <div className="grid grid-cols-3 gap-2 max-w-[440px]">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="relative aspect-square rounded overflow-hidden bg-[color:var(--ivory-deep,#f4f1ea)]"
                >
                  <Image
                    src={`/fsj/photo-${n}.jpg`}
                    alt={`Foodies sample photo ${n}`}
                    fill
                    sizes="(max-width: 640px) 33vw, 150px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="After the event">
            <P>
              The lead organizer will share two links with you to post in the subgroup:
            </P>
            <UL>
              <LI>One for attendees to upload photos and give feedback.</LI>
              <LI>One for hosts to give feedback.</LI>
            </UL>
            <P>Photos go on the event page on the UWC Bay Area website.</P>
          </Section>
    </>
  );
}

function Checklist() {
  return (
    <>
      <p className="text-[color:var(--muted)] text-sm mb-6 leading-[1.65]">
        A condensed working checklist of the playbook. For the full reasoning
        behind each item, switch to the Playbook tab.
      </p>

      <ChecklistSection title="Set-up (before submitting the form)">
        <Item>Find a co-host.</Item>
        <Item>Pick theme or cuisine, date and time, and general area.</Item>
        <Item>Pick a restaurant — family-run, $30–45/pp, dietary-friendly.</Item>
        <Item>Decide ordering style: individual orders with even split, or family-style.</Item>
        <Item>Decide drinks policy: own tab, or even split with a &ldquo;drink mindfully&rdquo; note.</Item>
        <Item>Decide the RSVP cutoff date.</Item>
        <Item>If a reservation is needed: agree on a $15 Venmo deposit and whose handle receives it.</Item>
        <Item>Plan a side quest (optional).</Item>
      </ChecklistSection>

      <ChecklistSection title="Submit">
        <Item>Fill out the Foodies Host Form so the organizer can set things up.</Item>
      </ChecklistSection>

      <ChecklistSection title="Wait for the organizer">
        <Item>Confirm the WhatsApp subgroup has been created.</Item>
        <Item>Confirm you and your co-host have admin rights.</Item>
        <Item>Confirm the group description is populated with your details.</Item>
      </ChecklistSection>

      <ChecklistSection title="Before the event">
        <Item>Approve join requests as they come in.</Item>
        <Item>Track RSVPs and deposits.</Item>
        <Item>Run a dietary poll about 4 days before; rerun if late joiners arrive.</Item>
        <Item>Confirm the reservation with the restaurant about a week out.</Item>
        <Item>Update the group description as details firm up.</Item>
        <Item>Send a day-before reminder: address, time, parking notes.</Item>
      </ChecklistSection>

      <ChecklistSection title="Day of">
        <Item>Be active on WhatsApp for last-minute logistics.</Item>
        <Item>Set the payment expectation upfront: one card, everyone Venmos before leaving the table.</Item>
        <Item>Take a photo of the food when it arrives, before anyone digs in.</Item>
        <Item>Take a few photos of people mingling.</Item>
      </ChecklistSection>

      <ChecklistSection title="After the event">
        <Item>Post the attendee photo + feedback link in the subgroup.</Item>
        <Item>Post the host feedback link in the subgroup.</Item>
      </ChecklistSection>
    </>
  );
}

function ChecklistSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first-of-type:mt-2">
      <h2 className="font-sans text-base sm:text-lg font-bold text-[color:var(--navy-ink)] mb-3 leading-tight uppercase tracking-[.08em]">
        {title}
      </h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[color:var(--navy-ink)] leading-[1.55]">
      <span
        aria-hidden
        className="mt-[5px] w-[14px] h-[14px] border border-[color:var(--navy-ink)] rounded-sm shrink-0"
      />
      <span>{children}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 sm:mt-10 first-of-type:mt-7">
      <h2 className="font-sans text-xl sm:text-2xl font-bold text-[color:var(--navy-ink)] mb-3 leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[17px] sm:text-lg font-bold text-[color:var(--navy-ink)] mt-5 mb-2">
      {children}
    </h3>
  );
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[color:var(--navy-ink)] leading-[1.65] mb-4 ${className ?? ""}`}>
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 sm:pl-6 space-y-2 mb-4 text-[color:var(--navy-ink)] leading-[1.65]">{children}</ul>;
}

function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function Template({ title, children }: { title: string; children: string }) {
  return (
    <figure className="my-3">
      <figcaption className="text-xs text-[color:var(--muted)] mb-1.5 italic">
        {title}
      </figcaption>
      <pre className="bg-white border border-[color:var(--rule)] rounded-[10px] p-3 sm:p-4 text-[13px] leading-[1.55] whitespace-pre-wrap break-words font-sans text-[color:var(--navy-ink)]">
        {children}
      </pre>
    </figure>
  );
}

function Screenshot({
  src,
  alt,
  w,
  h,
  caption,
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
  caption?: string;
}) {
  return (
    <figure className="my-3 max-w-[440px]">
      <Image
        src={src}
        alt={alt}
        width={w}
        height={h}
        className="w-full h-auto rounded border border-[color:var(--rule)]"
      />
      {caption && (
        <figcaption className="text-xs text-[color:var(--muted)] mt-1.5 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
