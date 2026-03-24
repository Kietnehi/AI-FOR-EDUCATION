"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getGeneratedContent, submitGameAttempt } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function MinigamePage() {
  const searchParams = useSearchParams();
  const contentId = searchParams.get("contentId") || "";

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!contentId) return;
    getGeneratedContent(contentId).then(setContent).catch(() => undefined);
  }, [contentId]);

  const items = useMemo(() => {
    const games = content?.json_content?.games || [];
    return games.flatMap((game: any) => (game.items || []).map((item: any) => ({ ...item, gameType: game.type })));
  }, [content]);

  async function handleSubmit() {
    const answerList = Object.entries(answers).map(([id, answer]) => ({ id, answer }));
    const submitted = await submitGameAttempt(contentId, answerList);
    setResult(submitted);
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Minigame</h2>
        {!contentId && <p>Khong co contentId. Hay tao tu material detail.</p>}
      </div>

      {items.map((item: any) => (
        <div key={item.id} className="card">
          <p>
            <b>{item.question || item.front}</b>
          </p>
          {Array.isArray(item.options) && item.options.length > 0 ? (
            <select
              value={answers[item.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
            >
              <option value="">Chon dap an</option>
              {item.options.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={answers[item.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
              placeholder={item.gameType === "flashcard" ? "Nhap noi dung ban nho" : "Nhap dap an"}
            />
          )}
        </div>
      ))}

      {items.length > 0 && <button onClick={handleSubmit}>Nop bai</button>}

      {result && (
        <div className="card">
          <h3>Ket qua</h3>
          <p>
            Score: {result.score}/{result.max_score}
          </p>
          <pre>{JSON.stringify(result.feedback, null, 2)}</pre>
        </div>
      )}

      <Link href="/">Ve dashboard</Link>
    </div>
  );
}
