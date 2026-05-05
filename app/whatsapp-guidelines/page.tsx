import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "WhatsApp Group Guidelines · UWC Bay Area",
  description:
    "Community guidelines for the UWC Bay Area WhatsApp group — how to keep it kind, on-topic, and useful for everyone.",
};

type Guideline = { lead: string; body: string };

const GUIDELINES: Guideline[] = [
  {
    lead: "Be Kind and Respectful",
    body: "Treat everyone with respect. No hate speech, discrimination, or personal attacks. Assume good intentions.",
  },
  {
    lead: "No Spam or Self-Promotion",
    body: "Please avoid using this group to promote personal projects, events, or businesses unless they're directly relevant to the UWC community and shared thoughtfully.",
  },
  {
    lead: "Keep Political Debate to the News Chat",
    body: "For in-depth political discussions or current events, use the separate News & Politics chat.",
  },
  {
    lead: "Stay On Topic",
    body: "Share updates, questions, or events relevant to the UWC Bay Area community. Think connection, support, and local opportunities. If you think there's opportunity to create a chat to better cover a topic, please reach out to us!",
  },
  {
    lead: "Event Invites Are Welcome — With Context",
    body: "Feel free to share local gatherings or community events! A bit of context (who's organizing, why it's relevant) is appreciated.",
  },
  {
    lead: "Use Threads When Possible",
    body: "To keep conversations tidy, reply directly to messages and avoid overwhelming the main chat.",
  },
  {
    lead: "Respect Privacy",
    body: "Don't share screenshots or personal info (including phone numbers) from the group outside it without permission.",
  },
  {
    lead: "Contact Admins with Questions or Concerns",
    body: "We're here to help! Reach out if you're unsure about something or need support.",
  },
];

export default function WhatsappGuidelinesPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-ivory min-h-screen">
        <section className="px-7 pt-16 pb-20">
          <div className="max-w-[720px] mx-auto">
            <div
              className="font-bold uppercase mb-4"
              style={{
                fontSize: 11,
                letterSpacing: ".32em",
                color: "var(--navy)",
              }}
            >
              Community guidelines
            </div>
            <h1
              className="font-display font-bold text-[color:var(--navy-ink)] m-0"
              style={{
                fontSize: "clamp(34px, 6vw, 60px)",
                lineHeight: 1.06,
                letterSpacing: "-.02em",
                textWrap: "balance",
              }}
            >
              🌉 UWC Bay Area WhatsApp Group{" "}
              <em
                className="text-navy font-semibold"
                style={{ fontStyle: "italic" }}
              >
                Guidelines
              </em>
            </h1>

            <p
              className="font-sans"
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--navy-ink)",
                marginTop: 28,
              }}
            >
              Welcome! This space is for connecting, sharing, and supporting
              fellow UWCers in the Bay Area. To keep it positive and useful for
              everyone, please follow these simple guidelines:
            </p>

            <ul
              className="font-sans"
              style={{
                listStyle: "none",
                padding: 0,
                margin: "32px 0 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {GUIDELINES.map((g) => (
                <li
                  key={g.lead}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: "var(--navy-ink)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      color: "var(--navy)",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    ◆
                  </span>
                  <span>
                    <strong style={{ fontWeight: 700 }}>{g.lead}:</strong>{" "}
                    {g.body}
                  </span>
                </li>
              ))}
            </ul>

            <p
              className="font-sans"
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--navy-ink)",
                marginTop: 36,
              }}
            >
              Thanks for helping make this group a welcoming and valuable space
              for everyone! 🌎🌍🌏
            </p>

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--rule)",
                margin: "32px 0",
              }}
            />

            <p
              className="font-sans"
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--muted)",
                margin: 0,
              }}
            >
              Access to this WhatsApp is limited to UWC alumni and community
              members living in the Bay Area (and registered) or alumni passing
              through. More info at{" "}
              <a
                href="https://www.uwcbayarea.org/"
                style={{
                  color: "var(--navy)",
                  textDecoration: "underline",
                }}
              >
                uwcbayarea.org
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
