"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Toast } from "@/components/toast";
import {
  generateMinigame,
  generatePodcast,
  generateSlides,
  getMaterial,
  processMaterial,
} from "@/lib/api";
import { Material } from "@/types";

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialId = params.id;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" }>({
    message: "",
    type: "success",
  });

  useEffect(() => {
    if (!materialId) return;
    getMaterial(materialId)
      .then(setMaterial)
      .catch((error) => setToast({ message: String(error), type: "error" }))
      .finally(() => setLoading(false));
  }, [materialId]);

  async function handleProcess() {
    setBusyAction("process");
    try {
      await processMaterial(materialId);
      setToast({ message: "Da xep hang xu ly tai lieu", type: "success" });
      const updated = await getMaterial(materialId);
      setMaterial(updated);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateSlides() {
    setBusyAction("slides");
    try {
      const generated = await generateSlides(materialId);
      router.push(`/materials/${materialId}/slides?contentId=${generated.id}`);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGeneratePodcast() {
    setBusyAction("podcast");
    try {
      const generated = await generatePodcast(materialId);
      router.push(`/materials/${materialId}/podcast?contentId=${generated.id}`);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateMinigame() {
    setBusyAction("minigame");
    try {
      const generated = await generateMinigame(materialId);
      router.push(`/materials/${materialId}/minigame?contentId=${generated.id}`);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  if (loading) return <div className="card">Dang tai chi tiet...</div>;
  if (!material) return <div className="card">Khong tim thay hoc lieu.</div>;

  return (
    <div className="grid">
      <div className="card">
        <h2>{material.title}</h2>
        <p>{material.description || "Khong co mo ta"}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StatusBadge status={material.processing_status} />
          <span>{material.subject || "No subject"}</span>
        </div>
      </div>

      <div className="card">
        <h3>Xu ly tai lieu</h3>
        <button onClick={handleProcess} disabled={busyAction.length > 0}>
          {busyAction === "process" ? "Dang xu ly..." : "Process Material"}
        </button>
      </div>

      <div className="card">
        <h3>Generate Content</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handleGenerateSlides} disabled={busyAction.length > 0}>
            {busyAction === "slides" ? "Dang tao..." : "Generate Slides"}
          </button>
          <button onClick={handleGeneratePodcast} disabled={busyAction.length > 0}>
            {busyAction === "podcast" ? "Dang tao..." : "Generate Podcast"}
          </button>
          <button onClick={handleGenerateMinigame} disabled={busyAction.length > 0}>
            {busyAction === "minigame" ? "Dang tao..." : "Generate Minigame"}
          </button>
          <Link href={`/materials/${materialId}/chat`}>Open Chatbot</Link>
        </div>
      </div>

      <div className="card">
        <h3>Noi dung trich</h3>
        <pre>{(material.cleaned_text || material.raw_text || "").slice(0, 1200)}</pre>
      </div>

      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}
