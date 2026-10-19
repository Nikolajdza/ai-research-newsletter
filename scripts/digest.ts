import "dotenv/config";
import { sendDailyDigests } from "../src/server/digest/send";

async function main() {
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Sending digests to every account (force=${force}, dryRun=${dryRun})…`);
  const result = await sendDailyDigests({ force, dryRun });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
