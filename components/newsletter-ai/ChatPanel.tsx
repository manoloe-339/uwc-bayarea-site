"use client";

import { useRef, useState } from "react";
import type { CampaignDraft } from "@/lib/campaign-content";

type Msg = { role: "user" | "assistant"; content: string; changed?: string[]; tools?: string[] };

type Props = {
  /** Current draft state — sent with every turn so Claude sees the latest. */
  draft: CampaignDraft;
  /** Called when Claude's tool_use produces a new draft. */
  onDraftUpdate: (nextDraft: CampaignDraft) => void;
};

/** Chat co-pilot for the newsletter editor. Uses Claude Sonnet with
 *  tool-use — Claude sees the current draft + real event/newsletter
 *  grounding and applies changes via update_draft tool calls that
 *  produce a new CampaignDraft, which is pushed back into the form
 *  via onDraftUpdate. */
export default function ChatPanel({ draft, onDraftUpdate }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/newsletter-ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft,
          // Only send role+content; strip tool metadata from client history.
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.assistant_text,
          changed: data.changed_fields,
          tools: data.tool_calls_made,
        },
      ]);
      if (data.updated_draft) onDraftUpdate(data.updated_draft);
      // Scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 40);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
      <header className="px-4 py-3 border-b border-[color:var(--rule)] bg-[color:var(--ivory-2)]">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">AI co-pilot</div>
        <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
          Ask me to draft sections, pull past events, or spotlight an alum. Try:{" "}
          <em className="not-italic">&ldquo;Summarize the last 3 events with hosts and one photo each.&rdquo;</em>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[300px]">
        {messages.length === 0 && (
          <div className="text-[13px] text-[color:var(--muted)]">
            No messages yet — start by describing what you want in the newsletter.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "bg-[color:var(--ivory-2)] border border-[color:var(--rule)] rounded px-3 py-2 text-[13px] whitespace-pre-wrap"
                : "text-[13px] leading-[1.55] whitespace-pre-wrap text-[color:var(--navy-ink)]"
            }
          >
            <div className="text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">
              {m.role === "user" ? "You" : "Claude"}
            </div>
            <div>{m.content}</div>
            {m.role === "assistant" && (m.changed?.length || m.tools?.length) ? (
              <div className="mt-2 text-[11px] text-[color:var(--muted)] space-y-0.5">
                {m.tools && m.tools.length > 0 && (
                  <div>
                    <span className="font-semibold">tools:</span>{" "}
                    {m.tools.filter((t) => t !== "update_draft").join(", ") || "—"}
                  </div>
                )}
                {m.changed && m.changed.length > 0 && (
                  <div>
                    <span className="font-semibold">updated:</span> {m.changed.join(", ")}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ))}
        {sending && (
          <div className="text-[13px] text-[color:var(--muted)] italic">Thinking…</div>
        )}
        {error && (
          <div className="text-[12px] px-3 py-2 bg-red-50 border border-red-200 text-red-900 rounded">
            {error}
          </div>
        )}
      </div>

      <footer className="border-t border-[color:var(--rule)] p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          disabled={sending}
          placeholder="Describe what to draft, edit, or add… (Cmd/Ctrl+Enter to send)"
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white resize-none"
        />
        <div className="mt-2 flex justify-between items-center">
          <span className="text-[11px] text-[color:var(--muted)]">
            Draft updates apply immediately — you can still edit fields directly.
          </span>
          <button
            type="button"
            onClick={send}
            disabled={sending || !input.trim()}
            className="bg-navy text-white px-4 py-1.5 rounded text-[12px] font-semibold tracking-wide disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}
