import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "How to Host a UWC Bay Area Foodies Event",
  robots: { index: false, follow: false },
};

export default function FoodiesSanJosePage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-ivory">
        <article className="max-w-[680px] mx-auto px-5 sm:px-7 py-8 sm:py-14 text-[15px] sm:text-base">
          <h1 className="font-sans text-[26px] sm:text-4xl font-bold text-[color:var(--navy-ink)] mb-2 leading-tight">
            How to Host a UWC Bay Area Foodies Event
          </h1>

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
                <strong>Day and time.</strong> Friday or Saturday evenings, or Sunday
                lunch. Be mindful of traffic. Encourage people to arrive a few minutes
                early so ordering does not start before everyone is there.
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
              <LI>The announcement post in the General and Foodies chats.</LI>
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
              before they joined. A few ways to work around this:
            </P>
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
              </LI>
              <LI>
                <strong>Polls work well, but you may need to run them more than once</strong>{" "}
                as new waves of members arrive.
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
              last-minute logistics messages. Set the payment expectation upfront: one
              person puts the card down, everyone Venmos before leaving the table. Food
              split evenly, drinks per your policy.
            </P>
            <P>
              <strong>During:</strong> take a photo of the food when it arrives (before
              anyone digs in) and a few of people mingling. Photos are required.
            </P>
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
        </article>
      </main>
      <SiteFooter />
    </>
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
