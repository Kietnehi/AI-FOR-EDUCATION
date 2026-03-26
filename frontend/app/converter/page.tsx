import { Metadata } from "next";
import { PdfConverter } from "@/components/converter/pdf-converter";

export const metadata: Metadata = {
  title: "Chuyển đổi & Trích xuất PDF | AI Learning Studio",
  description: "Chuyển đổi mọi file và web sang PDF, trích xuất dữ liệu từ PDF",
};

export default function ConverterPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-accent-600">
          Chuyển đổi & Trích xuất PDF
        </h1>
        <p className="text-[var(--text-secondary)] text-lg">
          Chuyển đổi mọi định dạng và trang web sang PDF, cũng như trích xuất dữ liệu nhanh chóng.
        </p>
      </div>
      
      <PdfConverter />
    </div>
  );
}
