"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { createChatSession, getChatSession, sendChatMessage } from "@/lib/api";
import { ChatMessage } from "@/types";

export default function ChatbotPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialId) return;
    createChatSession(materialId)
      .then(async (session) => {
        setSessionId(session.id);
        const detail = await getChatSession(session.id);
        setMessages(detail.messages);
      })
      .catch(() => undefined);
  }, [materialId]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !input.trim()) return;

    const userMessage: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      session_id: sessionId,
      message: input,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input;
    setInput("");
    setLoading(true);

    try {
      const assistantMessage = await sendChatMessage(sessionId, question);
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Chatbot RAG</h2>
        <p>Hoi dap dua tren hoc lieu da upload. Neu thieu du lieu, bot se tra loi khong chac chan.</p>
      </div>

      <div className="card" style={{ maxHeight: 500, overflow: "auto" }}>
        {messages.map((msg) => (
          <div key={msg.id} className="card">
            <b>{msg.role === "assistant" ? "Assistant" : "User"}</b>
            <p>{msg.message}</p>
            {msg.citations?.length > 0 && (
              <pre>{JSON.stringify(msg.citations, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>

      <form className="card" onSubmit={handleSend}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Nhap cau hoi..." />
        <button disabled={loading}>{loading ? "Dang tra loi..." : "Gui"}</button>
      </form>
    </div>
  );
}
