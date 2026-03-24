"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function PodcastPage() {
  const searchParams = useSearchParams();
  const contentId = searchParams.get("contentId") || "";

  const [content, setContent] = useState<GeneratedContent | null>(null);

  useEffect(() => {
    if (!contentId) return;
    getGeneratedContent(contentId).then(setContent).catch(() => undefined);
  }, [contentId]);

  const segments = content?.json_content?.segments || [];

  return (
    <div className="card">
      <h2>Podcast Script</h2>
      {!contentId && <p>Khong co contentId. Hay tao tu material detail.</p>}
      {content && (
        <>
          <p>
            Style: <b>{content.json_content?.style}</b>
          </p>
          {segments.map((segment: any, idx: number) => (
            <div key={idx} className="card">
              <b>{segment.speaker}</b>
              <p>{segment.text}</p>
            </div>
          ))}
          <pre>{JSON.stringify(content.json_content?.tts_placeholder, null, 2)}</pre>
        </>
      )}
      <Link href="/">Ve dashboard</Link>
    </div>
  );
}
