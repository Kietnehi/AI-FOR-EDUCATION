"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquareText, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { listMaterials, subscribeToMaterialsRealtime } from "@/lib/api";
import { Material } from "@/types";

export default function ChatbotIndexPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items.filter((m) => m.processing_status === "processed")))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return subscribeToMaterialsRealtime({
      onSnapshot: (snapshot) => {
        setMaterials(snapshot.items.filter((material) => material.processing_status === "processed"));
        setLoading(false);
      },
      onError: () => undefined,
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Chatbot AI
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Chọn một học liệu đã xử lý để bắt đầu hỏi đáp
        </p>
      </div>

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {!loading && materials.length === 0 && (
        <EmptyState
          icon={<MessageSquareText className="w-10 h-10" />}
          title="Chưa có học liệu nào đã xử lý"
          description="Hãy tải lên và xử lý học liệu trước khi sử dụng chatbot"
          action={
            <Link href="/materials/upload">
              <Button>Tải lên học liệu</Button>
            </Link>
          }
        />
      )}

      {!loading && materials.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((material, idx) => (
            <motion.div
              key={material.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link href={`/materials/${material.id}/chat`} className="block no-underline">
                <Card hover>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mb-3">
                    <MessageSquareText className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1 line-clamp-1">
                    {material.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    {material.description || "Bắt đầu chat về nội dung này"}
                  </p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
