import QuickSendForm from "./QuickSendForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quick send · UWC Admin",
};

export default function QuickSendPage() {
  return (
    <div className="max-w-[760px]">
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">
        Quick send
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Send a one-off email to a pasted list of addresses. Tracked alongside
        regular campaigns. Use this for occasional sends to people not in (or
        beyond) your alumni DB.
      </p>
      <QuickSendForm />
    </div>
  );
}
