"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Toast } from "@/components/toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function UploadMaterialPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" }>({
    message: "",
    type: "success",
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setToast({ message: "", type: "success" });

    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("description", description);
        form.append("subject", subject);
        form.append("education_level", educationLevel);
        form.append("tags", tags);
        response = await fetch(`${API_BASE}/materials/upload`, {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch(`${API_BASE}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            subject,
            education_level: educationLevel,
            tags: tags
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            raw_text: rawText,
            source_type: "manual_text",
          }),
        });
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setToast({ message: "Tao hoc lieu thanh cong", type: "success" });
      router.push(`/materials/${data.id}`);
    } catch (error) {
      setToast({ message: `Loi: ${String(error)}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Upload Learning Material</h2>
      <p>Upload PDF/DOCX/TXT/MD hoac nhap text thu cong.</p>
      <form className="grid" onSubmit={handleSubmit}>
        <div className="grid grid-2">
          <label>
            Tieu de
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Mon hoc
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-2">
          <label>
            Cap hoc
            <input value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} />
          </label>
          <label>
            Tags (phay)
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>

        <label>
          Mo ta
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <label>
          File hoc lieu
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        {!file && (
          <label>
            Hoac nhap text
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={10} required={!file} />
          </label>
        )}

        <button disabled={loading}>{loading ? "Dang gui..." : "Tao hoc lieu"}</button>
      </form>
      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}
