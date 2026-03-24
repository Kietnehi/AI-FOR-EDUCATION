"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { listMaterials } from "@/lib/api";
import { Material } from "@/types";

export default function DashboardPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="card">
        <h2>Dashboard</h2>
        <p>Theo doi hoc lieu, trang thai xu ly va cac noi dung da sinh.</p>
        <Link href="/materials/upload">Upload learning material</Link>
      </div>

      {loading && <div className="card">Dang tai danh sach hoc lieu...</div>}
      {error && <div className="card">Loi: {error}</div>}

      {materials.map((material) => (
        <div className="card" key={material.id}>
          <h3>{material.title}</h3>
          <p>{material.description || "Khong co mo ta"}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <StatusBadge status={material.processing_status} />
            <span>{new Date(material.updated_at).toLocaleString()}</span>
          </div>
          <Link href={`/materials/${material.id}`}>Mo chi tiet</Link>
        </div>
      ))}
    </div>
  );
}
