import "dotenv/config";
import { analyzeUnanalyzedArticles, getAnalysisStats } from "../src/server/ai/analyze";

async function main() {
  const limit = Number(process.argv[2] ?? 5);
  console.log(`Analyzing up to ${limit} unanalyzed articles…`);

  const result = await analyzeUnanalyzedArticles({ limit });
  console.log(JSON.stringify(result, null, 2));

  const stats = await getAnalysisStats();
  console.log("DB stats:", stats);
  process.exit(result.failed > 0 && result.analyzed === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
