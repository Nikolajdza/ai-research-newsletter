import "dotenv/config";
import { runDailyPipeline } from "../src/server/pipeline/daily";

async function main() {
  const dryRunDigest = process.argv.includes("--dry-run");
  const forceDigest = process.argv.includes("--force");
  const analyzeLimit = Number(
    process.argv.find((a) => a.startsWith("--analyze="))?.split("=")[1] ?? 5,
  );

  const result = await runDailyPipeline({
    trigger: "cli",
    analyzeLimit,
    dryRunDigest,
    forceDigest,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
