import {
  ArrowRight,
  BrainCircuit,
  Clock3,
  Database,
  Rss,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { TOPIC_SLUGS, TOPICS } from "@/lib/topics";

export const metadata = {
  title: "How it works",
  description: "How InsightLoop turns RSS feeds into a personal, AI-curated daily digest on Telegram.",
};

const STEPS: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  {
    icon: Rss,
    title: "Collect",
    body: "Every hour InsightLoop reads curated RSS feeds for every topic someone follows. URLs are canonicalized and hashed, so the same story is stored once even if several feeds carry it.",
    tone: "text-sky-300 bg-sky-500/15",
  },
  {
    icon: BrainCircuit,
    title: "Analyze",
    body: "An LLM on Groq reads each new article and returns a summary, key takeaways, why it matters and a 1–10 relevance score. The output is validated with a Zod schema before it touches the database.",
    tone: "text-violet-300 bg-violet-500/15",
  },
  {
    icon: SlidersHorizontal,
    title: "Personalize",
    body: "Your digest is picked from your topics only, above your minimum score, with at most two stories per topic so one busy beat can't crowd out the rest.",
    tone: "text-emerald-300 bg-emerald-500/15",
  },
  {
    icon: Send,
    title: "Deliver",
    body: "At your chosen hour the bot sends a short header and one card per story — image, summary and a Read button — straight to your Telegram. Exactly once per day, even if the job retries.",
    tone: "text-blue-300 bg-blue-500/15",
  },
];

const DETAILS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ThumbsDown,
    title: "Learns what you skip",
    body: "Thumb a story down and it never reaches your digest. Saved stories build your own reading list.",
  },
  {
    icon: Database,
    title: "Shared analysis, private taste",
    body: "Articles are analyzed once for everyone, which keeps AI cost tiny. Your topics, votes and digests stay yours.",
  },
  {
    icon: Clock3,
    title: "Idempotent scheduling",
    body: "Each run is logged step by step. A unique key per reader and day guarantees no duplicate messages.",
  },
  {
    icon: ShieldCheck,
    title: "Built to run free",
    body: "Next.js on Vercel, Postgres on Supabase, Groq's free tier and the Telegram Bot API — no paid services.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 fade-up">
      <section className="pt-6 text-center sm:pt-12">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">How it works</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          The news you care about, read by AI, delivered to Telegram.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">
          InsightLoop watches dozens of sources, scores every story for relevance and sends you the few worth your
          time — once a day, as clean cards in your chat.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-white glow-accent">
            Create your digest <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="rounded-xl border border-line px-5 py-3 text-muted hover:text-foreground">
            I have an account
          </Link>
        </div>
      </section>

      <section>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card relative p-5">
              <span className="absolute top-5 right-5 text-xs text-muted">0{i + 1}</span>
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${step.tone}`}>
                <step.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pick your beats</h2>
          <p className="mt-2 text-muted">
            Follow any mix of {TOPIC_SLUGS.length} curated topics — or type your own, like “Formula 1” or a single
            video game. AI suggests news feeds, every feed is tested, and you choose which ones to follow.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {TOPIC_SLUGS.map((slug) => (
              <span key={slug} className={`rounded-xl px-3 py-1.5 text-sm ring-1 ${TOPICS[slug].chip}`}>
                {TOPICS[slug].emoji} {TOPICS[slug].label}
              </span>
            ))}
            <span className="rounded-xl border border-dashed border-accent/50 px-3 py-1.5 text-sm text-accent">
              + anything you type
            </span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm space-y-2.5 rounded-3xl border border-line bg-[#0e1621] p-4 text-[13px] text-slate-100">
          <div className="rounded-2xl rounded-tl-sm bg-[#182533] px-3.5 py-2.5">
            <p className="font-semibold">☀️ InsightLoop · Daily Digest</p>
            <p className="text-slate-300">6 stories picked for you</p>
          </div>
          {(["ai-ml", "sports"] as const).map((slug, i) => (
            <div key={slug} className="overflow-hidden rounded-2xl rounded-tl-sm bg-[#182533]">
              <div className={`aspect-[16/8] bg-gradient-to-br ${TOPICS[slug].thumb}`} />
              <div className="space-y-1 px-3.5 py-2.5">
                <p className="font-semibold">
                  {i + 1}. {i === 0 ? "A new open model tops the coding benchmarks" : "Late winner sends the champions through"}
                </p>
                <p className="text-xs text-slate-300">
                  {TOPICS[slug].emoji} {TOPICS[slug].label} · ⭐ {i === 0 ? "9.1" : "8.4"}
                </p>
              </div>
              <p className="border-t border-white/5 py-2 text-center text-xs font-medium text-sky-300">Read article ↗</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {DETAILS.map((d) => (
          <div key={d.title} className="card flex gap-4 p-5">
            <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="font-medium">{d.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="dusk relative overflow-hidden rounded-3xl border border-line px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold">Start tomorrow morning smarter.</h2>
        <p className="mx-auto mt-2 max-w-md text-white/75">Create an account, pick topics, connect Telegram. Two minutes.</p>
        <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 font-medium backdrop-blur hover:bg-black/55">
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
