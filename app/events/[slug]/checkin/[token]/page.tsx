import { notFound } from "next/navigation";
import { getEventByCheckinToken, hasValidPinCookie } from "@/lib/checkin";
import { getCheckinStats } from "@/lib/checkin-queries";
import { CheckinPinGate } from "@/components/checkin/CheckinPinGate";
import { CheckinApp } from "@/components/checkin/CheckinApp";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

function formatEventDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token, slug } = await params;
  const event = await getEventByCheckinToken(token);
  if (!event || event.slug !== slug) notFound();

  if (!(await hasValidPinCookie(event))) {
    return <CheckinPinGate token={token} eventName={event.name} />;
  }

  const initialStats = await getCheckinStats(event.id);

  return (
    <CheckinApp
      token={token}
      event={{
        id: event.id,
        name: event.name,
        date: formatEventDate(new Date(event.date)),
        time: event.time,
        location: event.location,
      }}
      initialStats={initialStats}
    />
  );
}
