import Link from "next/link";
import { createNewsFeatureAction } from "../../news-actions";
import NewsFeatureForm from "../../NewsFeatureForm";

export const dynamic = "force-dynamic";

export default function NewNewsFeaturePage() {
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
        New alumni news feature
      </h1>
      <NewsFeatureForm
        action={createNewsFeatureAction}
        submitLabel="Create feature"
        initial={{
          alumni: null,
          publication: "",
          date_label: "",
          pull_quote: "",
          article_url: "",
          article_image_url: "",
          article_card_style: "clean",
          portrait_override_url: "",
          current_role_override: "",
          sort_order: 0,
          enabled: true,
        }}
      />
    </div>
  );
}
