import { redirect } from "next/navigation";

export default async function LegacyCampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/admin/email/campaigns/${id}`);
}
