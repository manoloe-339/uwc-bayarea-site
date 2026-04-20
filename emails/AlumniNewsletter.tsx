/**
 * UWC Bay Area alumni newsletter — React Email component.
 *
 * Every recipient gets an individually-addressed copy (no BCC). Callers in
 * Part 2 iterate over recipients and render once per send, substituting
 * `recipientFirstName` and `unsubscribeUrl` per message.
 *
 * -----------------------------------------------------------------------
 * Editing this file
 * -----------------------------------------------------------------------
 * - Brand color: `COLORS.brand` (top of file). Pass WCAG AA on white — if
 *   you change it, re-check contrast on the CTA buttons.
 * - Spacing rhythm: `SPACING.s{N}` constants. Stay on the scale.
 * - Section tints: `COLORS.tint*` — keep them soft; emails inherit the
 *   rendering client's background, not your page chrome.
 * - All CSS is inline via style attributes. Tailwind/classes do not work
 *   in email; don't be tempted to add them.
 */

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Design tokens — keep these at the top so future edits are trivial.
// ---------------------------------------------------------------------------

const COLORS = {
  brand: "#0265A8",         // UWC navy (matches public site); WCAG AA on white
  brandDeep: "#01488A",     // pressed/hover variant
  ink: "#111111",           // primary body text
  inkMuted: "#5a6477",      // secondary text
  bg: "#fafafa",            // off-white page — survives dark-mode inversion
  surface: "#ffffff",       // card surface
  rule: "rgba(17,17,17,0.10)",
  tintWhatsapp: "#f0fdf4",  // soft green tint
  tintFoodies: "#fef9f3",   // warm tint
  footerBg: "#111111",
  footerInk: "#ffffff",
  footerMuted: "#9ca0ab",
  footerFinePrint: "#4d525e", // tiny, legible address text — subtle but readable
} as const;

const SPACING = {
  s8: "8px",
  s16: "16px",
  s24: "24px",
  s32: "32px",
  s48: "48px",
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const MAX_WIDTH = "600px";

// ---------------------------------------------------------------------------
// Type interface — callers pass exactly these props per recipient.
// ---------------------------------------------------------------------------

export type Mode = "announcement" | "reminder" | "update";

export interface Speaker {
  name: string;
  title?: string;
  photoUrl?: string;
}

export interface CTA {
  label: string;
  url: string;
}

export interface EventDetails {
  imageUrl?: string;
  imageAlt?: string;
  title: string;
  heroHeadline?: string;  // short deck/standfirst shown in announcement hero
  dateline?: string;
  location?: string;
  locationNote?: string;
  description?: string;
  speakers?: Speaker[];
  cta?: CTA;
}

export interface AlumniNewsletterProps {
  preheader?: string;
  logoUrl?: string;
  physicalAddress?: string;
  recipientFirstName?: string;
  mode: Mode;

  event?: EventDetails;
  announcementKicker?: string;   // hero label for announcement mode (default "Save the date")
  reminderTag?: string;

  update?: {
    headline: string;
    body: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    cta?: CTA;
  };

  whatsNext?: {
    show: boolean;
    tag?: string;
    title: string;
    dateline?: string;
    description?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    cta?: CTA;
  };

  whatsapp?: {
    show: boolean;
    headline?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    ctaLabel?: string;
    ctaUrl: string;
  };

  foodies?: {
    show: boolean;
    headline?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };

  unsubscribeUrl: string;
}

// ---------------------------------------------------------------------------
// Shared style fragments
// ---------------------------------------------------------------------------

const bodyStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: COLORS.bg,
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "16px",
  lineHeight: 1.55,
};

const containerStyle: CSSProperties = {
  maxWidth: MAX_WIDTH,
  margin: "0 auto",
  padding: 0,
  backgroundColor: COLORS.bg,
};

const cardStyle: CSSProperties = {
  backgroundColor: COLORS.surface,
  padding: `${SPACING.s32} ${SPACING.s24}`,
};

const h1Style: CSSProperties = {
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "30px",
  lineHeight: 1.15,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: `0 0 ${SPACING.s16} 0`,
};

const h2Style: CSSProperties = {
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "22px",
  lineHeight: 1.25,
  fontWeight: 700,
  margin: `0 0 ${SPACING.s8} 0`,
};

const h3Style: CSSProperties = {
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "18px",
  lineHeight: 1.3,
  fontWeight: 700,
  margin: `0 0 ${SPACING.s8} 0`,
};

// Magazine-deck/standfirst style — slightly smaller than the event title that
// appears in the card below, medium weight, tightened leading.
const heroDeckStyle: CSSProperties = {
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "19px",
  lineHeight: 1.35,
  fontWeight: 500,
  margin: `${SPACING.s8} 0 0 0`,
};

const bodyTextStyle: CSSProperties = {
  color: COLORS.ink,
  fontFamily: FONT_STACK,
  fontSize: "16px",
  lineHeight: 1.55,
  margin: `0 0 ${SPACING.s16} 0`,
};

const metaStyle: CSSProperties = {
  color: COLORS.inkMuted,
  fontFamily: FONT_STACK,
  fontSize: "14px",
  lineHeight: 1.4,
  margin: `0 0 ${SPACING.s8} 0`,
};

const tagStyle: CSSProperties = {
  color: COLORS.brand,
  fontFamily: FONT_STACK,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  margin: `0 0 ${SPACING.s8} 0`,
};

const captionStyle: CSSProperties = {
  color: COLORS.inkMuted,
  fontFamily: FONT_STACK,
  fontSize: "12px",
  fontStyle: "italic",
  margin: `${SPACING.s8} 0 0 0`,
};

const buttonStyle: CSSProperties = {
  backgroundColor: COLORS.brand,
  color: "#ffffff",
  fontFamily: FONT_STACK,
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: "6px",
  padding: "12px 24px",
  display: "inline-block",
};

const outlineButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: "transparent",
  color: COLORS.brand,
  border: `1px solid ${COLORS.brand}`,
};

const textLinkStyle: CSSProperties = {
  color: COLORS.brand,
  textDecoration: "underline",
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function warn(msg: string): void {
  if (typeof console !== "undefined" && console.warn) console.warn(`[AlumniNewsletter] ${msg}`);
}

function img(src: string, alt: string | undefined, maxHeight?: number): JSX.Element {
  if (!alt && alt !== "") warn(`image without alt text: ${src}`);
  return (
    <Img
      src={src}
      alt={alt ?? ""}
      width="552"
      style={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        height: "auto",
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        borderRadius: "8px",
        objectFit: maxHeight ? "cover" : undefined,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AlumniNewsletter(props: AlumniNewsletterProps): JSX.Element {
  const {
    preheader,
    logoUrl,
    physicalAddress,
    recipientFirstName,
    mode,
    event,
    announcementKicker,
    reminderTag,
    update,
    whatsNext,
    whatsapp,
    foodies,
    unsubscribeUrl,
  } = props;

  if (!unsubscribeUrl) warn("unsubscribeUrl missing — footer cannot render the opt-out link");

  return (
    <Html lang="en">
      <Head>
        {/* Defend against email clients' aggressive dark-mode auto-inversion. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <HeaderBlock logoUrl={logoUrl} />
          <div style={cardStyle}>
            {renderHero({ mode, event, announcementKicker, reminderTag, update, recipientFirstName })}
            {renderMain({ mode, event, update, recipientFirstName })}
          </div>

          {whatsNext?.show ? <WhatsNextBlock {...whatsNext} /> : null}
          {whatsapp?.show ? <WhatsappBlock {...whatsapp} /> : null}
          {foodies?.show ? <FoodiesBlock {...foodies} /> : null}

          <FooterBlock
            physicalAddress={physicalAddress}
            unsubscribeUrl={unsubscribeUrl}
          />
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function HeaderBlock({ logoUrl }: { logoUrl?: string }): JSX.Element {
  return (
    <Section
      style={{
        backgroundColor: COLORS.surface,
        padding: `${SPACING.s24} ${SPACING.s24} 0 ${SPACING.s24}`,
      }}
    >
      {logoUrl ? (
        <Img
          src={logoUrl}
          alt="UWC Bay Area"
          height="40"
          style={{ height: "40px", width: "auto", display: "block" }}
        />
      ) : (
        <Text
          style={{
            color: COLORS.brand,
            fontFamily: FONT_STACK,
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          UWC Bay Area
        </Text>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function renderHero(args: {
  mode: Mode;
  event?: EventDetails;
  announcementKicker?: string;
  reminderTag?: string;
  update?: AlumniNewsletterProps["update"];
  recipientFirstName?: string;
}): JSX.Element | null {
  const { mode, event, announcementKicker, reminderTag, update, recipientFirstName } = args;

  // Announcement mode: kicker + greeting + magazine-style deck. NO event title —
  // that lives in the event card below.
  if (mode === "announcement") {
    if (!event) {
      warn("announcement mode requires an `event` prop");
      return null;
    }
    const kicker = announcementKicker ?? "Save the date";
    return (
      <Section style={{ marginBottom: SPACING.s24 }}>
        <Text style={tagStyle}>{kicker}</Text>
        {recipientFirstName ? (
          <Text
            style={{ ...bodyTextStyle, margin: `0 0 ${SPACING.s8} 0` }}
          >
            Hi {recipientFirstName},
          </Text>
        ) : null}
        {event.heroHeadline ? (
          <Text style={heroDeckStyle}>{event.heroHeadline}</Text>
        ) : null}
      </Section>
    );
  }

  // Reminder mode: urgency tag + reminderTag as the h1 (NO event title here — card below skips title).
  // No greeting; reminders are short and urgent.
  if (mode === "reminder") {
    if (!event) {
      warn("reminder mode requires an `event` prop");
      return null;
    }
    if (!reminderTag) warn("reminder mode without reminderTag — falling back to 'Coming up'");
    return (
      <Section style={{ marginBottom: SPACING.s24 }}>
        <Text style={{ ...tagStyle, color: COLORS.brandDeep }}>Reminder</Text>
        <Heading as="h1" style={{ ...h1Style, fontSize: "28px" }}>
          {reminderTag ?? "Coming up"}
        </Heading>
      </Section>
    );
  }

  // Update mode: kicker → greeting → headline. Body + image + CTA follow in the main block.
  if (mode === "update") {
    if (!update) {
      warn("update mode requires an `update` prop");
      return null;
    }
    return (
      <Section style={{ marginBottom: SPACING.s24 }}>
        <Text style={tagStyle}>Community news</Text>
        {recipientFirstName ? (
          <Text style={{ ...bodyTextStyle, margin: `0 0 ${SPACING.s8} 0` }}>
            Hi {recipientFirstName},
          </Text>
        ) : null}
        <Heading as="h1" style={h1Style}>
          {update.headline}
        </Heading>
      </Section>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function renderMain(args: {
  mode: Mode;
  event?: EventDetails;
  update?: AlumniNewsletterProps["update"];
  recipientFirstName?: string;
}): JSX.Element | null {
  const { mode, event, update } = args;
  if (mode === "announcement" && event) return <EventCard event={event} condensed={false} />;
  if (mode === "reminder" && event) return <EventCard event={event} condensed />;
  if (mode === "update" && update) return <UpdateBody update={update} />;
  return null;
}

function EventCard({ event, condensed }: { event: EventDetails; condensed: boolean }): JSX.Element {
  return (
    <Section style={{ marginBottom: SPACING.s16, textAlign: "left" }}>
      {event.imageUrl ? (
        <div style={{ marginBottom: SPACING.s16 }}>{img(event.imageUrl, event.imageAlt)}</div>
      ) : null}

      {/* Reminder mode skips the title — the reminderTag in the hero already implies the event. */}
      {!condensed ? (
        <Heading as="h2" style={h2Style}>
          {event.title}
        </Heading>
      ) : null}
      {event.dateline ? <Text style={metaStyle}>{event.dateline}</Text> : null}
      {event.location ? (
        <Text style={metaStyle}>
          {event.location}
          {event.locationNote ? ` · ${event.locationNote}` : ""}
        </Text>
      ) : null}

      {event.description ? (
        <Text style={{ ...bodyTextStyle, textAlign: "left" }}>{event.description}</Text>
      ) : null}

      {!condensed && event.speakers && event.speakers.length > 0 ? (
        <Section style={{ marginTop: SPACING.s16, marginBottom: SPACING.s16 }}>
          {event.speakers.map((s, i) => (
            <Row key={`${s.name}-${i}`} style={{ marginBottom: SPACING.s8 }}>
              <Column style={{ width: "52px", verticalAlign: "middle", textAlign: "left" }}>
                {s.photoUrl ? (
                  <Img
                    src={s.photoUrl}
                    alt={s.name}
                    width="40"
                    height="40"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                ) : null}
              </Column>
              <Column style={{ verticalAlign: "middle", textAlign: "left" }}>
                <Text
                  style={{
                    ...bodyTextStyle,
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  {s.name}
                </Text>
                {s.title ? (
                  <Text
                    style={{ ...metaStyle, margin: 0, fontSize: "12px", textAlign: "left" }}
                  >
                    {s.title}
                  </Text>
                ) : null}
              </Column>
            </Row>
          ))}
        </Section>
      ) : null}

      {event.cta ? (
        <div style={{ marginTop: SPACING.s16 }}>
          <Button href={event.cta.url} style={buttonStyle}>
            {event.cta.label}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

function UpdateBody({ update }: { update: NonNullable<AlumniNewsletterProps["update"]> }): JSX.Element {
  return (
    <Section style={{ marginBottom: SPACING.s16, textAlign: "left" }}>
      {update.imageUrl ? (
        <div style={{ marginBottom: SPACING.s16 }}>
          {img(update.imageUrl, update.imageAlt)}
          {update.imageCaption ? <Text style={captionStyle}>{update.imageCaption}</Text> : null}
        </div>
      ) : null}
      {update.body.split(/\n\n+/).map((para, i) => (
        <Text key={i} style={{ ...bodyTextStyle, textAlign: "left" }}>
          {para}
        </Text>
      ))}
      {update.cta ? (
        <div style={{ marginTop: SPACING.s8 }}>
          <Link href={update.cta.url} style={textLinkStyle}>
            {update.cta.label}
          </Link>
        </div>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// What's next
// ---------------------------------------------------------------------------

function WhatsNextBlock(p: NonNullable<AlumniNewsletterProps["whatsNext"]>): JSX.Element | null {
  if (!p.title) {
    warn("whatsNext.show=true but title missing — skipping");
    return null;
  }
  return (
    <Section
      style={{
        backgroundColor: COLORS.surface,
        padding: `${SPACING.s24}`,
        borderTop: `1px solid ${COLORS.rule}`,
      }}
    >
      {p.tag ? <Text style={tagStyle}>{p.tag}</Text> : null}
      <Heading as="h3" style={h3Style}>
        {p.title}
      </Heading>
      {p.imageUrl ? (
        <div style={{ marginTop: SPACING.s8, marginBottom: SPACING.s8 }}>
          {img(p.imageUrl, p.imageAlt, 300)}
          {p.imageCaption ? <Text style={captionStyle}>{p.imageCaption}</Text> : null}
        </div>
      ) : null}
      {p.dateline ? <Text style={metaStyle}>{p.dateline}</Text> : null}
      {p.description ? <Text style={bodyTextStyle}>{p.description}</Text> : null}
      {p.cta ? (
        <Link href={p.cta.url} style={textLinkStyle}>
          {p.cta.label} →
        </Link>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

function WhatsappBlock(p: NonNullable<AlumniNewsletterProps["whatsapp"]>): JSX.Element | null {
  if (!p.ctaUrl) {
    warn("whatsapp.show=true but ctaUrl missing — skipping");
    return null;
  }
  return (
    <Section
      style={{
        backgroundColor: COLORS.tintWhatsapp,
        padding: SPACING.s24,
        borderTop: `1px solid ${COLORS.rule}`,
      }}
    >
      <Heading as="h3" style={h3Style}>
        {p.headline ?? "Join the WhatsApp community"}
      </Heading>
      {p.imageUrl ? (
        <div style={{ marginTop: SPACING.s8, marginBottom: SPACING.s16, maxWidth: "400px" }}>
          {img(p.imageUrl, p.imageAlt, 200)}
          {p.imageCaption ? <Text style={captionStyle}>{p.imageCaption}</Text> : null}
        </div>
      ) : null}
      {p.body ? <Text style={{ ...bodyTextStyle, textAlign: "left" }}>{p.body}</Text> : null}
      <Button href={p.ctaUrl} style={outlineButtonStyle}>
        {p.ctaLabel ?? "Join WhatsApp"}
      </Button>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Foodies evergreen
// ---------------------------------------------------------------------------

function FoodiesBlock(p: NonNullable<AlumniNewsletterProps["foodies"]>): JSX.Element {
  return (
    <Section
      style={{
        backgroundColor: COLORS.tintFoodies,
        padding: SPACING.s24,
        borderTop: `1px solid ${COLORS.rule}`,
      }}
    >
      {p.imageUrl ? (
        <div style={{ marginBottom: SPACING.s16 }}>
          {img(p.imageUrl, p.imageAlt, 250)}
          {p.imageCaption ? <Text style={captionStyle}>{p.imageCaption}</Text> : null}
        </div>
      ) : null}
      <Heading as="h3" style={h3Style}>
        {p.headline ?? "UWC Foodies"}
      </Heading>
      {p.body ? (
        <Text style={{ ...bodyTextStyle, textAlign: "left" }}>{p.body}</Text>
      ) : null}
      {p.ctaUrl ? (
        <Link href={p.ctaUrl} style={textLinkStyle}>
          {p.ctaLabel ?? "Learn more"} →
        </Link>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function FooterBlock({
  physicalAddress,
  unsubscribeUrl,
}: {
  physicalAddress?: string;
  unsubscribeUrl: string;
}): JSX.Element {
  return (
    <Section
      style={{
        backgroundColor: COLORS.footerBg,
        color: COLORS.footerInk,
        padding: `${SPACING.s32} ${SPACING.s24}`,
      }}
    >
      <Text
        style={{
          color: COLORS.footerInk,
          fontFamily: FONT_STACK,
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "0.03em",
          margin: `0 0 ${SPACING.s8} 0`,
        }}
      >
        <Link href="https://uwcbayarea.org" style={{ color: COLORS.footerInk, textDecoration: "none" }}>
          UWC Bay Area
        </Link>
      </Text>
      <Text
        style={{
          color: COLORS.footerMuted,
          fontFamily: FONT_STACK,
          fontSize: "12px",
          margin: `0 0 ${SPACING.s16} 0`,
        }}
      >
        A UWC Initiative
      </Text>
      <Hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: `0 0 ${SPACING.s16} 0` }} />
      <Text
        style={{
          color: COLORS.footerMuted,
          fontFamily: FONT_STACK,
          fontSize: "13px",
          lineHeight: 1.5,
          margin: `0 0 ${SPACING.s8} 0`,
        }}
      >
        You're receiving this because you're part of the UWC Bay Area alumni community.
        {" "}
        <Link href={unsubscribeUrl} style={{ color: COLORS.footerInk, textDecoration: "underline" }}>
          Unsubscribe
        </Link>
        .
      </Text>
      {physicalAddress ? (
        <Text
          style={{
            color: COLORS.footerFinePrint,
            fontFamily: FONT_STACK,
            fontSize: "10px",
            lineHeight: 1.4,
            margin: `${SPACING.s16} 0 0 0`,
          }}
        >
          {physicalAddress}
        </Text>
      ) : null}
    </Section>
  );
}
