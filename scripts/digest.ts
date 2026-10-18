import "dotenv/config";
import { sendDailyDigest } from "../src/server/digest/send";

async function main() {
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Sending digest (force=${force}, dryRun=${dryRun})…`);
  const result = await sendDailyDigest({ force, dryRun });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
