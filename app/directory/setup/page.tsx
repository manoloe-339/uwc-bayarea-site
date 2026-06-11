import type { Metadata } from "next";
import Link from "next/link";
import { consumeInviteToken } from "@/lib/directory-users";
import { buildLoginData } from "@/lib/login-data";
import { type BackdropId } from "@/components/login/LoginBackdrop";
import { sql } from "@/lib/db";
import SetupExperience from "./SetupExperience";

export const metadata: Metadata = {
  title: "Set your directory password · UWC Bay Area",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DirectorySetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = (sp.token ?? "").trim();

  // Validate the token up front so we render a helpful error page
  // rather than letting the user type a password into a form that's
  // going to fail anyway. We do NOT consume the token here —
  // consumption happens on submit so a reload doesn't burn it.
  const lookup = token
    ? await consumeInviteToken(token)
    : ({ ok: false, reason: "not_found" } as const);

  if (!lookup.ok) {
    const messages: Record<string, string> = {
      not_found: "This invite link doesn't match any open invitation.",
      expired: "This invite has expired. Ask the admin to resend.",
      used: "This invite has already been used. Sign in instead.",
      revoked: "This account has been revoked.",
    };
    return (
      <div
        className="min-h-[100dvh] relative isolate"
        style={{ background: "var(--rich-deep)" }}
      >
        <main className="relative z-[2] min-h-[100dvh] flex items-center justify-center px-5 py-8">
          <div
            className="w-full max-w-[420px] rounded-[12px] p-6 text-center"
            style={{
              background: "rgba(255,255,255,.97)",
              border: "1px solid rgba(11,37,69,.08)",
              boxShadow:
                "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.5)",
            }}
          >
            <div className="inline-flex items-center gap-2 text-rose-700 font-bold text-[10px] tracking-[.22em] uppercase mb-3">
              <span className="inline-block w-5 h-0.5 bg-rose-700" aria-hidden />
              Invite issue
            </div>
            <h1 className="font-sans font-bold text-[color:var(--navy-ink)] text-[22px] leading-[1.1] mb-2">
              Can&rsquo;t set up
            </h1>
            <p className="text-[color:var(--muted)] text-sm leading-snug mb-4">
              {messages[lookup.reason] ?? "This invite isn't usable."}
            </p>
            <Link
              href="/directory/login"
              className="inline-block text-navy font-bold text-sm hover:underline"
            >
              → Go to sign-in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // First name for the welcome pill — lookup against alumni via the
  // directory_users.alumni_id join. Falls back to null when the
  // invite isn't linked to an alumni record.
  const fnRows = (await sql`
    SELECT a.first_name
    FROM directory_users u
    LEFT JOIN alumni a ON a.id = u.alumni_id
    WHERE u.id = ${lookup.user.id}
    LIMIT 1
  `) as Array<{ first_name: string | null }>;
  const firstName =
    fnRows[0]?.first_name?.trim().split(/\s+/)[0] ?? null;

  // Backdrop data, same as the login page uses.
  const initialPools = await buildLoginData();
  const initialBackdrop: BackdropId = (
    ["living", "mosaic", "constellation"] as BackdropId[]
  )[Math.floor(Math.random() * 3)];
  const opt = (u: string, w: number) =>
    u.endsWith(".svg") ? u : `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=70`;
  const initialPreloadUrls: string[] = [];
  for (const t of initialPools.photoPool) {
    if (t.kind === "photo") initialPreloadUrls.push(opt(t.imgUrl, 384));
  }
  for (const t of initialPools.mixedPool) {
    if (t.kind === "uwc" || t.kind === "org" || t.kind === "flag") {
      if (t.imgUrl) initialPreloadUrls.push(opt(t.imgUrl, 256));
    }
  }

  return (
    <div
      className="min-h-[100dvh] relative isolate"
      style={{ background: "var(--rich-deep)" }}
    >
      <SetupExperience
        initialPools={initialPools}
        initialBackdrop={initialBackdrop}
        initialPreloadUrls={initialPreloadUrls}
        token={token}
        email={lookup.user.email}
        firstName={firstName}
      />
    </div>
  );
}
