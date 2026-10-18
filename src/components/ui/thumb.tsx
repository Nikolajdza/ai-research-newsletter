"use client";

import { useState } from "react";
import { TOPICS, type TopicSlug } from "@/lib/topics";
import { TopicIcon } from "./topic-icon";

export function Thumb({
  imageUrl,
  topic,
  className = "",
  iconClassName = "h-10 w-10",
}: {
  imageUrl: string | null;
  topic: TopicSlug;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;

  return (
    <div className={`relative overflow-hidden bg-panel-2 ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary RSS hosts, no loader config
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`grid h-full w-full place-items-center bg-gradient-to-br ${TOPICS[topic]?.thumb ?? "from-slate-700 to-slate-950"}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
          <TopicIcon topic={topic} className={`relative text-white/90 drop-shadow ${iconClassName}`} />
        </div>
      )}
    </div>
  );
}
