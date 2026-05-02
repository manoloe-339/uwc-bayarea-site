import { sql } from "./db";

export interface NewsFeatureRow {
  id: number;
  alumni_id: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  portrait_override_url: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined alumni fields (for admin display + public render).
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
  alumni_photo_url: string | null;
}

/** Resolved shape for the public homepage. portrait_url falls back to
 * the alumni record's photo when no override is set. */
export interface ResolvedNewsFeature {
  id: number;
  alumni_id: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  portrait_url: string | null;
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
}

export type NewsFeatureLayout = "spotlight" | "pair" | "hidden";

export interface NewsFeatureDisplay {
  layout: NewsFeatureLayout;
  features: ResolvedNewsFeature[];
}

export interface NewsFeatureInput {
  alumni_id: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  portrait_override_url: string | null;
  sort_order: number;
  enabled: boolean;
}

const SELECT_WITH_ALUMNI = `
  SELECT
    nf.*,
    al.first_name AS alumni_first_name,
    al.last_name  AS alumni_last_name,
    al.uwc_college AS alumni_uwc_college,
    al.grad_year  AS alumni_grad_year,
    al.photo_url  AS alumni_photo_url
  FROM news_features nf
  LEFT JOIN alumni al ON al.id = nf.alumni_id
`;

export async function listNewsFeaturesForAdmin(): Promise<NewsFeatureRow[]> {
  return (await sql.query(
    `${SELECT_WITH_ALUMNI} ORDER BY nf.sort_order ASC, nf.id ASC`
  )) as NewsFeatureRow[];
}

export async function getNewsFeatureById(id: number): Promise<NewsFeatureRow | null> {
  const rows = (await sql.query(
    `${SELECT_WITH_ALUMNI} WHERE nf.id = $1 LIMIT 1`,
    [id]
  )) as NewsFeatureRow[];
  return rows[0] ?? null;
}

/** Public homepage display — layout chosen by enabled count. */
export async function getNewsFeatureDisplay(): Promise<NewsFeatureDisplay> {
  const rows = (await sql.query(
    `${SELECT_WITH_ALUMNI} WHERE nf.enabled = TRUE ORDER BY nf.sort_order ASC, nf.id ASC LIMIT 2`
  )) as NewsFeatureRow[];
  if (rows.length === 0) return { layout: "hidden", features: [] };

  const features: ResolvedNewsFeature[] = rows.map((r) => ({
    id: r.id,
    alumni_id: r.alumni_id,
    publication: r.publication,
    date_label: r.date_label,
    pull_quote: r.pull_quote,
    article_url: r.article_url,
    portrait_url: r.portrait_override_url ?? r.alumni_photo_url,
    alumni_first_name: r.alumni_first_name,
    alumni_last_name: r.alumni_last_name,
    alumni_uwc_college: r.alumni_uwc_college,
    alumni_grad_year: r.alumni_grad_year,
  }));

  return {
    layout: features.length === 1 ? "spotlight" : "pair",
    features,
  };
}

export async function createNewsFeature(data: NewsFeatureInput): Promise<number> {
  const rows = (await sql`
    INSERT INTO news_features (
      alumni_id, publication, date_label, pull_quote, article_url,
      portrait_override_url, sort_order, enabled
    ) VALUES (
      ${data.alumni_id}, ${data.publication}, ${data.date_label}, ${data.pull_quote},
      ${data.article_url}, ${data.portrait_override_url}, ${data.sort_order}, ${data.enabled}
    )
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function updateNewsFeature(
  id: number,
  data: NewsFeatureInput
): Promise<void> {
  await sql`
    UPDATE news_features SET
      alumni_id             = ${data.alumni_id},
      publication           = ${data.publication},
      date_label            = ${data.date_label},
      pull_quote            = ${data.pull_quote},
      article_url           = ${data.article_url},
      portrait_override_url = ${data.portrait_override_url},
      sort_order            = ${data.sort_order},
      enabled               = ${data.enabled},
      updated_at            = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteNewsFeature(id: number): Promise<void> {
  await sql`DELETE FROM news_features WHERE id = ${id}`;
}

export async function setNewsFeatureEnabled(id: number, enabled: boolean): Promise<void> {
  await sql`
    UPDATE news_features SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${id}
  `;
}
