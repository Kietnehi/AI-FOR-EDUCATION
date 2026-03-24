"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Toast } from "@/components/toast";
import { apiDownloadUrl, getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function SlidesPage() {
  const searchParams = useSearchParams();
  const contentId = searchParams.get("contentId") || "";

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contentId) return;
    getGeneratedContent(contentId).then(setContent).catch((err) => setError(String(err)));
  }, [contentId]);

  return (
    <div className="card">
      <h2>Generated Slides</h2>
      {!contentId && <p>Khong co contentId. Hay tao tu trang material detail.</p>}
      {content && (
        <>
          <p>Version: v{content.version}</p>
          <ul>
            {content.outline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {content.file_url && (
            <p>
              <a href={apiDownloadUrl(content.file_url)} target="_blank">
                Download PPTX
              </a>
            </p>
          )}
        </>
      )}
      {error && <Toast message={error} type="error" />}
      <Link href="/">Ve dashboard</Link>
    </div>
  );
}
