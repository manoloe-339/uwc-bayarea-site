import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import { triageHit } from "@/lib/discovery/triage-llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Row = {
  id: number;
  linkedin_url: string;
  title_snippet: string | null;
  body_snippet: string | null;
};

/**
 * Re-runs Claude triage on un-actioned candidates (status in
 * new/probable_match/possible_match). Useful after the prompt is
 * updated so historical rows reflect the new rules.
 */
export async function POST(): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const rows = (await sql`
    SELECT id, linkedin_url, title_snippet, body_snippet
    FROM alumni_candidates
    WHERE status IN ('new', 'probable_match', 'possible_match')
    ORDER BY id ASC
  `) as Row[];

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, retriaged: 0, message: "Nothing to re-triage." });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let updated = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      const triage = await triageHit(client, {
        url: r.linkedin_url,
        title: r.title_snippet ?? "",
        snippet: r.body_snippet ?? "",
      });
      if (!triage) {
        failed++;
        continue;
      }
      await sql`
        UPDATE alumni_candidates
        SET triage_confidence = ${triage.confidence},
            triage_role = ${triage.role},
            triage_reasoning = ${triage.reasoning}
        WHERE id = ${r.id}
      `;
      updated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    retriaged: updated,
    failed,
    total: rows.length,
  });
}
