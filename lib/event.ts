// Single source of truth for event content across the public site AND email
// campaigns. Today we have one event; the file is structured as an array so
// we can add upcoming events without touching call sites. To add an event,
// append to `events` and set `featured: true` on whichever one should drive
// the homepage/OG image/etc. Only one event should be marked `featured`.

type FiresideSpeaker = {
  name: string;
  role: string;
  org: readonly string[];
  photo: string;
  photoPosition?: string;
  linkedin?: string;
};

const _event = {
  id: "may-1-eswatini",
  label: "May 1 · eSwatini fireside",
  featured: true,
  newsletterHeroHeadline: "Our next event: eSwatini's story",
  newsletterImageUrl: "https://uwcbayarea.org/waterford-bg.jpg",
  newsletterImageAlt: "UWC Waterford Kamhlaba campus",
  title: "UWC Bay Area · May 1",
  dateShort: "May 1",
  dayOfWeek: "FRIDAY",
  timeLabel: "EVENING",
  time: "6:30 - 8:30pm",
  timeISOStart: "2026-05-01T18:30:00-07:00",
  timeISOEnd: "2026-05-01T20:30:00-07:00",
  city: "SAN FRANCISCO",
  venue: "530 Hampshire St · #306",
  venueNeighborhood: "San Francisco · Mission District",
  venueMapUrl: "https://maps.google.com/?q=530+Hampshire+St+%23306+San+Francisco+CA",
  venueEmbedUrl:
    "https://www.google.com/maps?q=530+Hampshire+St+%23306+San+Francisco+CA&output=embed",
  audienceTag: "ALUMNI & FRIENDS FROM ALL COLLEGES INVITED",
  hero: {
    title: "Hear the fascinating history of",
    titleItalic: "eSwatini",
    body:
      "Bhembe and Wabantu, Swazi alumni of UWC Waterford Kamhlaba, reflect on the tensions shaping life in eSwatini - and in all of us.",
  },
  speakers: [
    {
      name: "Ntokozo Bhembe",
      role: "Waterford Kamhlaba · '07",
      photo: "/bhembe.jpg",
      linkedin: "https://www.linkedin.com/in/ntokozo-bhembe/",
    },
    {
      name: "Wabantu Hlophe",
      role: "Waterford Kamhlaba · '10",
      photo: "/wabuntu.jpg",
      linkedin: "https://www.linkedin.com/in/wabantu-hlophe-92b388114/",
    },
  ],
  fireside: {
    eyebrow: "Fireside chat",
    speakers: [
      {
        name: "Gil Sander Joseph",
        role: "Haiti · UWC RBC '21",
        org: ["Knight-Hennessy Scholar", "Stanford University"],
        photo: "/gil.jpg",
        linkedin: "https://www.linkedin.com/in/gil-sander-joseph/",
      },
      {
        name: "Faith Abiodun",
        role: "Executive Director",
        org: ["UWC International"],
        photo: "/faith.jpg",
        photoPosition: "50% 22%",
        linkedin: "https://www.linkedin.com/in/faithabiodun/",
      },
    ] as FiresideSpeaker[],
  },
  totalSeats: 35,
  price: "$10",
  priceQualifier: "min",
  priceNote: "Limited capacity",
  ticketUrl: "https://buy.stripe.com/aFaeVddbsdMF3dmbC98Ra03",
  contactEmail: "manoloe@gmail.com",
  refreshments: "Light fare served",
} as const;

export type Event = typeof _event;

/** Array of all events. Append here to add a new one. */
export const events: readonly Event[] = [_event] as const;

/** Featured event — used by the public site + OG image + default newsletter fill. */
export const event: Event = events.find((e) => e.featured) ?? events[0];

/** Convert a site event into the shape the newsletter template expects. */
export function toNewsletterEvent(e: Event): {
  title: string;
  heroHeadline?: string;
  imageUrl?: string;
  imageAlt?: string;
  dateline?: string;
  location?: string;
  locationNote?: string;
  description?: string;
  speakers?: { name: string; title?: string }[];
  cta?: { label: string; url: string };
} {
  const speakers = [
    ...e.speakers.map((s) => ({ name: s.name, title: s.role })),
    ...(e.fireside?.speakers ?? []).map((s) => ({
      name: s.name,
      title: `${s.role} · ${s.org.join(", ")}`,
    })),
  ];
  return {
    title: `${e.hero.title} ${e.hero.titleItalic}`,
    heroHeadline: e.newsletterHeroHeadline,
    imageUrl: e.newsletterImageUrl,
    imageAlt: e.newsletterImageAlt,
    dateline: `${e.dateShort} · ${e.time}`,
    location: e.venue,
    locationNote: e.venueNeighborhood,
    description: e.hero.body,
    speakers,
    cta: { label: `Get tickets · ${e.price}`, url: e.ticketUrl },
  };
}
