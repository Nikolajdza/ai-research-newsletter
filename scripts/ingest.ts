import "dotenv/config";
import { collectFromEnabledSources } from "../src/server/ingest/collect";

async function main() {
  console.log("Starting RSS collect…");
  const result = await collectFromEnabledSources({ respectPreferences: true });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
