import SiteHeaderClient from "./SiteHeaderClient";
import { getFeaturedNavEvent } from "@/lib/nav-featured-event";

type NavKey = "home" | "events" | "featured" | "signup" | "help" | "contact";

/** Server wrapper: fetches the featured-nav event (if any) and passes
 *  it into the client SiteHeader. Every page keeps importing SiteHeader
 *  from the same path — the server fetch happens transparently.
 *
 *  A failed fetch (rare — settings/db down) yields `null`, and the nav
 *  simply omits the featured item. Never blocks the page. */
export default async function SiteHeader({ active }: { active?: NavKey }) {
  let featuredEvent = null;
  try {
    featuredEvent = await getFeaturedNavEvent();
  } catch {
    /* keep header rendering — featured item just doesn't appear */
  }
  return <SiteHeaderClient active={active} featuredEvent={featuredEvent} />;
}
