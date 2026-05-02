import { sql } from "./db";

export type ArticleCardStyle = "clean" | "clipping";

const ARTICLE_CARD_STYLES: ArticleCardStyle[] = ["clean", "clipping"];

export function isArticleCardStyle(v: string): v is ArticleCardStyle {
  return (ARTICLE_CARD_STYLES as string[]).includes(v);
}

export interface NewsFeatureRow {
  id: number;
  alumni_id: number | null;
  alumni_id_2: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  article_title: string | null;
  article_image_url: string | null;
  article_card_style: ArticleCardStyle;
  portrait_override_url: string | null;
  current_role_override: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined alumni fields (primary).
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
  alumni_photo_url: string | null;
  alumni_current_title: string | null;
  alumni_current_company: string | null;
  // Joined alumni fields (second alumnus, when present).
  alumni2_first_name: string | null;
  alumni2_last_name: string | null;
  alumni2_uwc_college: string | null;
  alumni2_grad_year: number | null;
  alumni2_photo_url: string | null;
}

/** Resolved shape for the public homepage. portrait_url falls back to
 * the alumni record's photo when no override is set. current_role
 * falls back to alumni.current_title + alumni.current_company. */
export interface ResolvedNewsAlumnus {
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
}

export interface ResolvedNewsFeature {
  id: number;
  alumni_id: number | null;
  alumni_id_2: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  article_title: string | null;
  article_image_url: string | null;
  article_card_style: ArticleCardStyle;
  /** Primary portrait — override or first alum's photo. */
  portrait_url: string | null;
  current_role: string | null;
  /** Primary alumnus name fields (kept flat for backwards compat). */
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
  /** Second alumnus, only set when alumni_id_2 is present. */
  alumni_2: ResolvedNewsAlumnus | null;
}

export type NewsFeatureLayout = "spotlight" | "pair" | "hidden";

export interface NewsFeatureDisplay {
  layout: NewsFeatureLayout;
  features: ResolvedNewsFeature[];
}

export interface NewsFeatureInput {
  alumni_id: number | null;
  alumni_id_2: number | null;
  publication: string | null;
  date_label: string | null;
  pull_quote: string;
  article_url: string | null;
  article_title: string | null;
  article_image_url: string | null;
  article_card_style: ArticleCardStyle;
  portrait_override_url: string | null;
  current_role_override: string | null;
  sort_order: number;
  enabled: boolean;
}

const SELECT_WITH_ALUMNI = `
  SELECT
    nf.*,
    al.first_name      AS alumni_first_name,
    al.last_name       AS alumni_last_name,
    al.uwc_college     AS alumni_uwc_college,
    al.grad_year       AS alumni_grad_year,
    al.photo_url       AS alumni_photo_url,
    al.current_title   AS alumni_current_title,
    al.current_company AS alumni_current_company,
    al2.first_name     AS alumni2_first_name,
    al2.last_name      AS alumni2_last_name,
    al2.uwc_college    AS alumni2_uwc_college,
    al2.grad_year      AS alumni2_grad_year,
    al2.photo_url      AS alumni2_photo_url
  FROM news_features nf
  LEFT JOIN alumni al  ON al.id  = nf.alumni_id
  LEFT JOIN alumni al2 ON al2.id = nf.alumni_id_2
`;

function deriveCurrentRole(r: NewsFeatureRow): string | null {
  if (r.current_role_override && r.current_role_override.trim()) {
    return r.current_role_override.trim();
  }
  const title = (r.alumni_current_title ?? "").trim();
  const company = (r.alumni_current_company ?? "").trim();
  if (title && company) return `${title} at ${company}`;
  if (title) return title;
  if (company) return `At ${company}`;
  return null;
}

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
    alumni_id_2: r.alumni_id_2,
    publication: r.publication,
    date_label: r.date_label,
    pull_quote: r.pull_quote,
    article_url: r.article_url,
    article_title: r.article_title,
    article_image_url: r.article_image_url,
    article_card_style: r.article_card_style ?? "clean",
    portrait_url: r.portrait_override_url ?? r.alumni_photo_url,
    current_role: deriveCurrentRole(r),
    alumni_first_name: r.alumni_first_name,
    alumni_last_name: r.alumni_last_name,
    alumni_uwc_college: r.alumni_uwc_college,
    alumni_grad_year: r.alumni_grad_year,
    alumni_2: r.alumni_id_2
      ? {
          first_name: r.alumni2_first_name,
          last_name: r.alumni2_last_name,
          uwc_college: r.alumni2_uwc_college,
          grad_year: r.alumni2_grad_year,
          photo_url: r.alumni2_photo_url,
        }
      : null,
  }));

  return {
    layout: features.length === 1 ? "spotlight" : "pair",
    features,
  };
}

export async function createNewsFeature(data: NewsFeatureInput): Promise<number> {
  const rows = (await sql`
    INSERT INTO news_features (
      alumni_id, alumni_id_2, publication, date_label, pull_quote, article_url,
      article_title, article_image_url, article_card_style,
      portrait_override_url, current_role_override, sort_order, enabled
    ) VALUES (
      ${data.alumni_id}, ${data.alumni_id_2}, ${data.publication}, ${data.date_label}, ${data.pull_quote},
      ${data.article_url}, ${data.article_title}, ${data.article_image_url}, ${data.article_card_style},
      ${data.portrait_override_url}, ${data.current_role_override},
      ${data.sort_order}, ${data.enabled}
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
      alumni_id_2           = ${data.alumni_id_2},
      publication           = ${data.publication},
      date_label            = ${data.date_label},
      pull_quote            = ${data.pull_quote},
      article_url           = ${data.article_url},
      article_title         = ${data.article_title},
      article_image_url     = ${data.article_image_url},
      article_card_style    = ${data.article_card_style},
      portrait_override_url = ${data.portrait_override_url},
      current_role_override = ${data.current_role_override},
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
