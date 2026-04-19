export const signup = {
  kicker: "MEMBER SIGN-UP · 2026",
  headlinePrefix: "Join",
  headlineEm: "UWC Bay Area",
  lede:
    "We’re planning a calendar of events for 2026 — firesides with alumni speakers, social gatherings, and gatherings with UWC leadership. Sign up to hear about them.",
  notes: [
    { label: "Time", body: "Two minutes — we just need a few details.", strong: "Two minutes" },
    { label: "Once", body: "Already submitted before? No need to resubmit.", strong: "No need to resubmit." },
    { label: "Reply", body: "Replies go straight to a real person.", strong: undefined },
  ] as ReadonlyArray<{ label: string; body: string; strong?: string }>,
  formEyebrow: "Member form · UWC Bay Area",
} as const;
