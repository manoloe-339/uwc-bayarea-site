export const signup = {
  formEmbedUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSc1U_GA4lU8P4GUHVPvTXyPmnfWFz5DhxMzFoQSRFnmeUlnWQ/viewform?embedded=true",
  formDirectUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSc1U_GA4lU8P4GUHVPvTXyPmnfWFz5DhxMzFoQSRFnmeUlnWQ/viewform",
  formHeight: 1400,
  kicker: "MEMBER SIGN-UP · 2026",
  headlinePrefix: "Join",
  headlineEm: "UWC Bay Area",
  lede:
    "We’re planning a calendar of events for 2026 — firesides with alumni speakers, social gatherings, and gatherings with UWC leadership. Sign up to hear about them.",
  notes: [
    { label: "Time", body: "Two minutes — we just need a few details.", strong: "Two minutes" },
    { label: "Once", body: "Already submitted before? No need to resubmit.", strong: "No need to resubmit." },
    { label: "Tip", body: "Easier to fill out on desktop than on mobile.", strong: undefined },
  ] as ReadonlyArray<{ label: string; body: string; strong?: string }>,
  formEyebrow: "Member form · UWC Bay Area",
  formTip: "The form below is embedded from Google Forms.",
  fallbackText: "Can’t see the form?",
  fallbackLinkText: "Open it in a new tab →",
} as const;
