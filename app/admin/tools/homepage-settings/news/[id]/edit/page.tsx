import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsFeatureById } from "@/lib/news-features";
import { updateNewsFeatureAction } from "../../../news-actions";
import NewsFeatureForm from "../../../NewsFeatureForm";

export const dynamic = "force-dynamic";

export default async function EditNewsFeaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const featureId = Number(id);
  if (!Number.isFinite(featureId) || featureId <= 0) notFound();
  const feature = await getNewsFeatureById(featureId);
  if (!feature) notFound();
  const update = updateNewsFeatureAction.bind(null, featureId);

  const alumni = feature.alumni_id
    ? {
        id: feature.alumni_id,
        first_name: feature.alumni_first_name,
        last_name: feature.alumni_last_name,
        email: null,
        uwc_college: feature.alumni_uwc_college,
        grad_year: feature.alumni_grad_year,
      }
    : null;

  return (
    <div className="max-w-[760px]">
      <div className="mb-4 text-sm">
        <Link
          href="/admin/tools/homepage-settings"
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← Homepage settings
        </Link>
      </div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-6">
        Edit alumni news feature
      </h1>
      <NewsFeatureForm
        action={update}
        submitLabel="Save changes"
        initial={{
          alumni,
          publication: feature.publication ?? "",
          date_label: feature.date_label ?? "",
          pull_quote: feature.pull_quote,
          article_url: feature.article_url ?? "",
          article_title: feature.article_title ?? "",
          article_image_url: feature.article_image_url ?? "",
          article_card_style: feature.article_card_style ?? "clean",
          portrait_override_url: feature.portrait_override_url ?? "",
          current_role_override: feature.current_role_override ?? "",
          sort_order: feature.sort_order,
          enabled: feature.enabled,
        }}
      />
    </div>
  );
}
