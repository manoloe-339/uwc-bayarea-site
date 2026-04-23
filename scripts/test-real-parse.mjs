import { config } from "dotenv";
config({ path: ".env.local" });
import { parseSearchQuery } from "../lib/event-nl-parser.ts";
for (const q of ["males", "men", "female alumni", "women in tech"]) {
  const r = await parseSearchQuery(q);
  console.log(`\nQ: "${q}"`);
  console.log(JSON.stringify(r, null, 2));
}
