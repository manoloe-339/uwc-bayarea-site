// Single source of truth for event content.
// Edit this file to update all copy/links site-wide.

type FiresideSpeaker = {
  name: string;
  role: string;
  org: readonly string[];
  photo: string;
  photoPosition?: string;
  linkedin?: string;
};

export const event = {
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
  totalSeats: 20,
  price: "$10",
  priceQualifier: "min",
  priceNote: "Limited capacity",
  ticketUrl: "https://buy.stripe.com/aFaeVddbsdMF3dmbC98Ra03",
  contactEmail: "manoloe@gmail.com",
  refreshments: "Light fare served",
} as const;
