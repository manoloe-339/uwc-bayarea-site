import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSiteSettings } from "@/lib/settings";
import {
  listUpcomingEventsForAI,
  listPastEventsForAI,
  listPastNewslettersForAI,
  listEventPhotosForAI,
  searchAlumniByName,
  appendStyleGuideNote,
} from "@/lib/newsletter-ai/context";
import { runPreflight } from "@/lib/newsletter-ai/preflight";
import type { CampaignDraft, NewsletterContent } from "@/lib/campaign-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = "claude-sonnet-5";

/** Message shape sent from the client. Only the assistant/user roles
 *  ever flow through the API — tool_use / tool_result are internal to
 *  the multi-turn tool-use loop below and not persisted client-side. */
type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  draft: CampaignDraft;
  messages: ClientMessage[];
};

type ResponseBody = {
  ok: true;
  assistant_text: string;
  updated_draft: CampaignDraft;
  changed_fields: string[];
  tool_calls_made: string[];
};

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "list_upcoming_events",
    description:
      "List upcoming UWC Bay Area events (Foodies meals + other gatherings). Returns each event's slug, name, date, time, location, whether it's Foodies, the hosts (resolved to first-last names), and a cover-photo URL if one exists.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max events to return (default 8)" },
      },
    },
  },
  {
    name: "list_past_events",
    description:
      "List past UWC Bay Area events, most recent first. Use to summarize what happened since the last newsletter, pick photos, and reference hosts by name. Each event has a cover_url pointing to the top approved gallery photo (use as image_url in the draft when highlighting the event).",
    input_schema: {
      type: "object",
      properties: {
        since: {
          type: "string",
          description: "ISO date (YYYY-MM-DD) — only events on/after this date. Default is 60 days ago.",
        },
        limit: { type: "number", description: "Max events to return (default 8)" },
      },
    },
  },
  {
    name: "list_event_photos",
    description:
      "Return the top N approved gallery photos for a single event (by slug), ordered exactly as the public gallery renders them (marquee first, then supporting). Use this when you want to build a thumbnail strip of multiple photos from one event — the list_past_events / list_upcoming_events tools only expose the single cover photo per event, which isn't enough for a photo strip.",
    input_schema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "Event slug (from list_past_events / list_upcoming_events)" },
        limit: { type: "number", description: "Max photos to return (default 5)" },
      },
    },
  },
  {
    name: "run_preflight_checks",
    description:
      "Run pre-send checks on the current newsletter draft. Currently returns email_weight (total bytes recipients will download for images, warning if >500 KB, fail if >3 MB). Use before telling the admin the draft is send-ready, and any time the admin asks 'is this too heavy?' / 'what's the file size?'. Extensible — more checks (spelling, broken links, missing subject) will be added over time.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "save_style_guide_note",
    description:
      "Persist a durable rule to the newsletter style guide. Use ONLY when the admin has explicitly told you to remember something for future newsletters (e.g. 'always use 150px thumbnails', 'never mention Alan in the recap', 'sign off with Manolo'). Appends under a '## Learned from admin' section — does not overwrite existing rules. Confirm what you saved back to the admin.",
    input_schema: {
      type: "object",
      required: ["note"],
      properties: {
        note: {
          type: "string",
          description: "The rule / preference to save. Write it as a standalone bullet the future you will see with no prior context — no 'you said' / 'the admin wants', just the rule itself.",
        },
      },
    },
  },
  {
    name: "search_alumni_by_name",
    description:
      "Look up alumni by name (case-insensitive). Returns up to 5 matches with UWC college, grad year, current company/title, and the LinkedIn 'about' blurb — useful when the user asks for a 'special alum' section and you want to ground the write-up in real facts.",
    input_schema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Name or partial name to search" },
      },
    },
  },
  {
    name: "update_draft",
    description:
      "Apply changes to the newsletter draft. All fields optional — send only what you want to change. Existing fields you don't include are preserved. Use this to set the subject, preheader, main body copy, upcoming-event spotlight, or toggle the WhatsApp/Foodies footer blocks.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line" },
        preheader: { type: "string", description: "Short preview text shown after the subject in inboxes" },
        mode: {
          type: "string",
          enum: ["announcement", "reminder", "update"],
          description: "Campaign template mode. Use 'newsletter' for a multi-section update.",
        },
        update_headline: { type: "string", description: "Main content block headline" },
        update_body: {
          type: "string",
          description: "Main content block body — supports markdown (blank line = paragraph, **bold**, *italic*, [text](url), image via ![alt](url)). This is where the summary of past events, alum spotlight, etc. lives.",
        },
        update_image_url: { type: "string", description: "Hero image URL for the main block (typically a cover photo from a past event)" },
        update_image_caption: { type: "string", description: "Caption under the hero image" },
        whats_next_show: { type: "boolean", description: "Show the 'What's next' upcoming-event spotlight?" },
        whats_next_title: { type: "string", description: "Upcoming event title (e.g. 'Foodies at Anchor Oyster Bar')" },
        whats_next_dateline: { type: "string", description: "Formatted date/time line (e.g. 'Sunday, Sep 7 · 6:30pm')" },
        whats_next_description: { type: "string", description: "One-paragraph description of the event" },
        whats_next_image_url: { type: "string", description: "Image for the spotlight (usually the event's cover)" },
        whatsapp_show: { type: "boolean", description: "Show the WhatsApp CTA footer block?" },
        foodies_show: { type: "boolean", description: "Show the Foodies CTA footer block?" },
      },
    },
  },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.messages?.length || !body.draft) {
    return NextResponse.json({ error: "messages[] and draft required" }, { status: 400 });
  }

  const [settings, upcoming, past, pastNewsletters] = await Promise.all([
    getSiteSettings(),
    listUpcomingEventsForAI(6),
    listPastEventsForAI(undefined, 6),
    listPastNewslettersForAI(3),
  ]);

  const systemPrompt = buildSystemPrompt({
    styleGuide: settings.newsletter_style_guide,
    upcoming,
    past,
    pastNewsletters,
    currentDraft: body.draft.newsletter ?? null,
    subject: body.draft.subject,
    preheader: body.draft.preheader,
  });

  const client = new Anthropic({ apiKey });

  // Tool-use loop. Claude may call multiple grounding tools, then
  // (usually last) call update_draft. Loop terminates on 'end_turn'.
  const conversation: Anthropic.Messages.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let updatedDraft = { ...body.draft };
  let assistantText = "";
  const changedFields: string[] = [];
  const toolCallsMade: string[] = [];
  const MAX_TOOL_ITERATIONS = 8;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages: conversation,
    });

    // Accumulate text from THIS turn.
    for (const block of resp.content) {
      if (block.type === "text") {
        assistantText += (assistantText ? "\n\n" : "") + block.text;
      }
    }

    // If Claude stopped for end_turn (no tool calls), we're done.
    if (resp.stop_reason === "end_turn" || !resp.content.some((b) => b.type === "tool_use")) {
      break;
    }

    // Add the assistant turn (with tool_use blocks) to the conversation,
    // then produce tool_result blocks.
    conversation.push({ role: "assistant", content: resp.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      toolCallsMade.push(block.name);
      const result = await runTool(
        block.name,
        block.input as Record<string, unknown>,
        updatedDraft,
      );
      if (result.draftUpdate) {
        updatedDraft = result.draftUpdate.draft;
        changedFields.push(...result.draftUpdate.fields);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.data),
      });
    }
    conversation.push({ role: "user", content: toolResults });
  }

  const responseBody: ResponseBody = {
    ok: true,
    assistant_text: assistantText.trim() || "(no reply)",
    updated_draft: updatedDraft,
    changed_fields: Array.from(new Set(changedFields)),
    tool_calls_made: toolCallsMade,
  };
  return NextResponse.json(responseBody);
}

function buildSystemPrompt(params: {
  styleGuide: string | null;
  upcoming: Awaited<ReturnType<typeof listUpcomingEventsForAI>>;
  past: Awaited<ReturnType<typeof listPastEventsForAI>>;
  pastNewsletters: Awaited<ReturnType<typeof listPastNewslettersForAI>>;
  currentDraft: NewsletterContent | null;
  subject: string;
  preheader: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const styleSection = params.styleGuide?.trim()
    ? `\n\n<style_guide>\n${params.styleGuide.trim()}\n</style_guide>`
    : "";
  const pastNewslettersSection = params.pastNewsletters.length
    ? `\n\n<past_newsletters count="${params.pastNewsletters.length}">\nUse these as tone/style examples — how sections are titled, how event summaries read, how sign-offs land. Do NOT copy content verbatim.\n${params.pastNewsletters
        .map(
          (n) =>
            `<newsletter subject="${escapeXml(n.subject)}" sent_at="${n.sent_at ?? "unknown"}">\n${escapeXml(n.preview)}\n</newsletter>`,
        )
        .join("\n")}\n</past_newsletters>`
    : "";
  return `You are the newsletter co-pilot for UWC Bay Area — an alumni community for United World Colleges graduates living in the San Francisco Bay Area. You collaborate with Manolo (the admin) in a chat panel to draft newsletters.

Today's date: ${today}.

Your job:
- Take the admin's request (e.g. "summarize the last 3 events with photos", "add a spotlight for the upcoming Foodies", "write a section about alum X").
- Call the grounding tools to fetch real events, hosts, photos, and alumni — never invent names, dates, or facts.
- Compose section copy that matches the site's voice.
- Apply changes via update_draft. Send only the fields you want to change; unmentioned fields are preserved.
- When the admin gives you a durable preference ("always use 150px thumbnails", "sign off as Manolo", "don't feature Alan"), call save_style_guide_note to persist it — the style_guide feeds into every future chat. Only save when the admin was clearly instructing for the future, not for a one-off request.
- Before telling the admin the draft is send-ready, and whenever they ask "is this too heavy" / "what's the file size" / "will it clip", call run_preflight_checks and report back with the totals. Do the same after adding lots of new images to a draft.

Editorial rules:
- Reference events by their real hosts and dates. If unsure, call list_past_events / list_upcoming_events first.
- When highlighting an event visually, set update_image_url or whats_next_image_url to the event's cover_url returned by the grounding tools.
- Keep body copy warm, concrete, and short. This is a peer community, not a corporate broadcast.
- Never include a raw chat.whatsapp.com URL. The WhatsApp footer block already links to the registration gate.
- Preserve any draft content the admin has typed manually unless they ask you to change it.

Markdown-only rule for update_body:
- Body is rendered through a tiny markdown subset. ANY raw HTML (including <img>, <br>, <div>, <span>) is escaped to plain text and shows up as visible tags in the email. Never write HTML tags.
- Supported syntax (only these):
    Paragraphs           — blank line between blocks
    # / ## / ### text    — section headings (line-leading hashes + space; emoji fine in the heading text)
    **bold** / *italic*  — inline emphasis
    [text](https://url)  — links
    ![alt](https://url)              — full-width image (single hero-in-body)
    ![alt](https://url =150)         — fixed thumbnail 150px wide (thumb strip)
    ![alt](https://url =150x100)     — fixed-size thumbnail
    ![alt](https://url =48%)         — percentage-width image (grid cell)
    [[bg=#f4efe3]]…[[/bg]]           — wrap enclosed block in a background-colored panel
- To resize an existing image the admin asks about, rewrite the markdown with the size suffix — never emit <img> HTML.
- Section headings should typically be ## (h2) — reserve # for a single top-level. Emoji are fine (e.g. "## 🌉 Around the Bay").

Photo layout rules (important — apply consistently):
- ONE photo in a section → hero: \`![alt](url)\` (no size suffix, renders full-width).
- TWO photos side-by-side → two-column row: each at 48%. Put them in the SAME paragraph so they sit on one line.
    e.g. \`![a](url1 =48%) ![b](url2 =48%)\`
- FOUR photos → 2×2 grid: four images at 48% in the SAME paragraph — they wrap into two rows of two.
    e.g. \`![a](url1 =48%) ![b](url2 =48%) ![c](url3 =48%) ![d](url4 =48%)\`
- THREE photos → 3-column row: each at 32%.
- Images are auto-optimized (recipients download ~50 KB compressed JPEGs, not the multi-megabyte originals) — you don't need to worry about file size, just choose the display width.

Section background colors:
- Use \`[[bg=<color>]]…[[/bg]]\` to give a distinct panel background to a section. Accepts hex (\`#f4efe3\`), named colors (\`ivory\`), or \`rgb(...)\`.
- Style suggestion: alternate subtle warm tones between sections. Site palette: \`#F4EFE3\` (ivory), \`#EFE8D6\` (ivory-2), \`#FFFFFF\` (white), \`#0B2545\` (navy — bg only for dark section with light text). Keep contrast readable.
- Don't wrap EVERY section — reserve for the 1–2 sections that deserve extra visual weight (e.g. the "Save the date" panel).

Draft structure (what update_draft controls):
- subject / preheader — the email envelope
- mode — email template mode. Rule: set mode='update' whenever you use the update_* fields (that's the multi-section newsletter shape). Use 'announcement' only for a single-event blast (fills the 'event' block, which you can't set from here — the admin picks the event manually). Use 'reminder' for follow-up nudges to a specific event.
- update_headline + update_body — the main content block. THIS is where past-event summaries, alum spotlights, and other prose live. Body is markdown. Whenever you use these, mode MUST be 'update' (auto-flipped if you forget, but be explicit for clarity).
- update_image_url / update_image_caption — hero image for the main block (pick from a past event's cover)
- whats_next_* — the "coming up" spotlight, typically for ONE upcoming event
- whatsapp_show / foodies_show — toggle the footer CTA blocks

<current_draft subject="${escapeXml(params.subject)}" preheader="${escapeXml(params.preheader)}">
${JSON.stringify(params.currentDraft, null, 2)}
</current_draft>${styleSection}${pastNewslettersSection}

After making updates, briefly (1-2 sentences) tell the admin what you did and what to check.`;
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  currentDraft: CampaignDraft,
): Promise<{
  data: unknown;
  draftUpdate?: { draft: CampaignDraft; fields: string[] };
}> {
  switch (name) {
    case "list_upcoming_events": {
      const limit = typeof input.limit === "number" ? input.limit : undefined;
      const events = await listUpcomingEventsForAI(limit);
      return { data: { events } };
    }
    case "list_past_events": {
      const since = typeof input.since === "string" ? input.since : undefined;
      const limit = typeof input.limit === "number" ? input.limit : undefined;
      const events = await listPastEventsForAI(since, limit);
      return { data: { events } };
    }
    case "run_preflight_checks": {
      // Preflight uses the JUST-updated draft, not the one from the
      // start of this turn — Claude may have called update_draft
      // earlier in the same tool loop.
      const result = await runPreflight(currentDraft);
      return { data: result };
    }
    case "save_style_guide_note": {
      const note = typeof input.note === "string" ? input.note : "";
      if (!note.trim()) return { data: { error: "note required" } };
      try {
        const { guide } = await appendStyleGuideNote(note);
        return { data: { ok: true, guide_length: guide.length } };
      } catch (err) {
        return { data: { error: err instanceof Error ? err.message : String(err) } };
      }
    }
    case "list_event_photos": {
      const slug = typeof input.slug === "string" ? input.slug : "";
      if (!slug) return { data: { error: "slug required" } };
      const limit = typeof input.limit === "number" ? input.limit : undefined;
      const photos = await listEventPhotosForAI(slug, limit);
      return { data: { photos } };
    }
    case "search_alumni_by_name": {
      const q = typeof input.name === "string" ? input.name : "";
      if (!q) return { data: { error: "name required" } };
      const results = await searchAlumniByName(q);
      return { data: { results } };
    }
    case "update_draft": {
      const { draft: nextDraft, changed } = applyDraftPatch(currentDraft, input);
      return { data: { ok: true, changed }, draftUpdate: { draft: nextDraft, fields: changed } };
    }
    default:
      return { data: { error: `unknown tool: ${name}` } };
  }
}

/** Merge Claude's update_draft input into the campaign draft. Fields
 *  Claude didn't send are preserved. Returns the new draft + which
 *  logical fields changed (for the client to summarize). */
function applyDraftPatch(
  draft: CampaignDraft,
  input: Record<string, unknown>,
): { draft: CampaignDraft; changed: string[] } {
  const next: CampaignDraft = { ...draft };
  const changed: string[] = [];
  const str = (k: string): string | undefined => (typeof input[k] === "string" ? (input[k] as string) : undefined);
  const bool = (k: string): boolean | undefined => (typeof input[k] === "boolean" ? (input[k] as boolean) : undefined);

  const subject = str("subject");
  if (subject != null) { next.subject = subject; changed.push("subject"); }
  const preheader = str("preheader");
  if (preheader != null) { next.preheader = preheader; changed.push("preheader"); }

  const nl: NewsletterContent = { ...(next.newsletter ?? { mode: "announcement" }) };

  const mode = str("mode");
  if (mode === "announcement" || mode === "reminder" || mode === "update") {
    nl.mode = mode;
    changed.push("mode");
  }

  const updateHeadline = str("update_headline");
  const updateBody = str("update_body");
  const updateImage = str("update_image_url");
  const updateCaption = str("update_image_caption");
  const touchedUpdateBlock =
    updateHeadline != null || updateBody != null || updateImage != null || updateCaption != null;
  if (touchedUpdateBlock) {
    const prev = nl.update ?? { headline: "", body: "" };
    nl.update = {
      headline: updateHeadline ?? prev.headline,
      body: updateBody ?? prev.body,
      imageUrl: updateImage ?? prev.imageUrl,
      imageAlt: prev.imageAlt,
      imageCaption: updateCaption ?? prev.imageCaption,
      cta: prev.cta,
    };
    if (updateHeadline != null) changed.push("update.headline");
    if (updateBody != null) changed.push("update.body");
    if (updateImage != null) changed.push("update.imageUrl");
    if (updateCaption != null) changed.push("update.imageCaption");
    // The email template only RENDERS the update block when mode is
    // "update" — so writing update.* without touching mode leaves the
    // content invisible in the preview. Auto-flip when Claude sets
    // update fields, unless Claude was explicit about a different mode
    // in the same patch (handled above — mode already set overrides).
    if (mode == null && nl.mode !== "update") {
      nl.mode = "update";
      changed.push("mode(auto→update)");
    }
  }

  const whatsNextShow = bool("whats_next_show");
  const whatsNextTitle = str("whats_next_title");
  const whatsNextDateline = str("whats_next_dateline");
  const whatsNextDescription = str("whats_next_description");
  const whatsNextImage = str("whats_next_image_url");
  if (
    whatsNextShow != null ||
    whatsNextTitle != null ||
    whatsNextDateline != null ||
    whatsNextDescription != null ||
    whatsNextImage != null
  ) {
    const prev = nl.whatsNext ?? { show: true, title: "" };
    nl.whatsNext = {
      show: whatsNextShow ?? prev.show,
      title: whatsNextTitle ?? prev.title,
      dateline: whatsNextDateline ?? prev.dateline,
      description: whatsNextDescription ?? prev.description,
      imageUrl: whatsNextImage ?? prev.imageUrl,
      imageAlt: prev.imageAlt,
      imageCaption: prev.imageCaption,
      cta: prev.cta,
      tag: prev.tag,
    };
    changed.push("whatsNext");
  }

  const waShow = bool("whatsapp_show");
  if (waShow != null) {
    nl.whatsapp = { ...(nl.whatsapp ?? { show: true }), show: waShow };
    changed.push("whatsapp.show");
  }
  const foodiesShow = bool("foodies_show");
  if (foodiesShow != null) {
    nl.foodies = { ...(nl.foodies ?? { show: true }), show: foodiesShow };
    changed.push("foodies.show");
  }

  next.newsletter = nl;
  return { draft: next, changed };
}

function escapeXml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
