import {
  Atom,
  BrainCircuit,
  Briefcase,
  Code2,
  Globe2,
  HeartPulse,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { TopicSlug } from "@/lib/topics";

const ICONS: Record<TopicSlug, LucideIcon> = {
  "ai-ml": BrainCircuit,
  "web-dev": Code2,
  business: Briefcase,
  sports: Trophy,
  world: Globe2,
  science: Atom,
  health: HeartPulse,
  productivity: Timer,
};

export function TopicIcon({ topic, className }: { topic: TopicSlug; className?: string }) {
  const Icon = ICONS[topic] ?? Globe2;
  return <Icon className={className} />;
}
