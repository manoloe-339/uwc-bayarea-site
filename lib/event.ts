// Single source of truth for event content.
// Edit this file to update all copy/links site-wide.

export const event = {
  title: "UWC Bay Area · May 1",
  dateShort: "May 1",
  dayOfWeek: "FRIDAY",
  timeLabel: "EVENING",
  time: "6:30 - 8:30pm",
  timeISOStart: "2026-05-01T18:30:00-07:00",
  timeISOEnd: "2026-05-01T20:30:00-07:00",
  city: "SAN FRANCISCO",
  venue: "530 Hampshire St #306",
  venueMapUrl: "https://maps.google.com/?q=530+Hampshire+St+%23306+San+Francisco",
  audienceTag: "ALUMNI & FRIENDS FROM ALL COLLEGES INVITED",
  hero: {
    title: "Hear the fascinating history of",
    titleItalic: "eSwatini",
    body:
      "Bhembe and Wabantu, Swazi alumni of UWC Waterford Kamhlaba, reflect on the tensions shaping life in eSwatini - and in all of us.",
  },
  speakers: [
    { name: "Ntokozo Bhembe", role: "Waterford Kamhlaba · '07", photo: "/bhembe.jpg" },
    { name: "Wabantu Hlophe", role: "Waterford Kamhlaba · '10", photo: "/wabuntu.jpg" },
  ],
  featured: {
    eyebrow: "Featuring",
    name: "Faith Abiodun",
    role: "Executive Director",
    org: "UWC International",
    photo: "/faith.jpg",
    update: "Update and Q&A",
  },
  price: "$10",
  priceNote: "Limited capacity",
  ticketUrl: "https://buy.stripe.com/aFaeVddbsdMF3dmbC98Ra03",
  contactEmail: "manoloe@gmail.com",
  refreshments: "Light fare served",
} as const;
