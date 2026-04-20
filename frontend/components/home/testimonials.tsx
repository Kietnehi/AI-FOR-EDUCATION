"use client";

import { motion } from "framer-motion";
import { Star, Quote, CheckCircle2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  avatar: string;
  rating: number;
  date: string;
  verified: boolean;
}

const testimonials: Testimonial[] = [
  { id: 1, name: "Nguyễn Văn Anh", role: "Giảng viên", content: "Công cụ này đã giải phóng tôi khỏi hàng giờ soạn slide thủ công. Khả năng trích xuất bài giảng thực sự ấn tượng.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix", rating: 5, date: "12/04/2024", verified: true },
  { id: 2, name: "Lê Minh Tâm", role: "Học sinh chuyên Tin", content: "Em dùng chatbot để ôn luyện các chủ đề khó. Cảm giác như có một gia sư riêng 24/7 giải thích mọi thắc mắc.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria", rating: 5, date: "15/04/2024", verified: true },
  { id: 3, name: "Dr. Hoàng Nam", role: "Nhà nghiên cứu", content: "Sự kết hợp giữa RAG và hạ tầng Vector DB giúp thông tin trích xuất có độ chính xác cực kỳ cao.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack", rating: 5, date: "10/04/2024", verified: true },
  { id: 4, name: "Phạm Thùy Linh", role: "Founder EdTech", content: "Giao diện rất dễ làm quen. Chúng tôi có thể tạo bài tập và podcast từ tài liệu gốc chỉ với vài cú click.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie", rating: 4, date: "08/04/2024", verified: true },
  { id: 5, name: "Trần Quốc Bảo", role: "Sinh viên", content: "Tính năng biến tài liệu thành Minigame giúp việc học không còn nhàm chán. Em đã đạt điểm A rất dễ dàng.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver", rating: 5, date: "18/04/2024", verified: true },
  { id: 6, name: "Mai Thu Cúc", role: "L&D Manager", content: "Tôi dùng để tóm tắt các tài liệu nội bộ dài dòng. Tiết kiệm được cực kỳ nhiều thời gian cho nhân viên.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby", rating: 5, date: "20/04/2024", verified: true },
  { id: 7, name: "Vũ Hải Đăng", role: "Kỹ sư PM", content: "Hạ tầng của AI Studio cực ổn định. API phản hồi nhanh, hỗ trợ tốt cho các tài liệu kỹ thuật phức tạp.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo", rating: 5, date: "21/04/2024", verified: true },
  { id: 8, name: "Đỗ Bảo Ngọc", role: "Giáo viên", content: "Slide cực sinh động. Các bé ở lớp rất hào hứng khi tôi dùng các trò chơi tạo từ AI Studio.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Misty", rating: 5, date: "22/04/2024", verified: true },
  { id: 9, name: "Ngô Quang Vinh", role: "Học viên", content: "Hỗ trợ trích xuất trích dẫn tài liệu tham khảo chính xác. Đây là trợ thủ đắc lực cho luận văn của tôi.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb", rating: 5, date: "19/04/2024", verified: true },
  { id: 10, name: "Lý Thanh Hà", role: "Creator", content: "Chuyển từ tài liệu PDF sang kịch bản Podcast chưa bao giờ dễ dàng như thế. Giọng AI rất tự nhiên.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella", rating: 4, date: "23/04/2024", verified: true },
  { id: 11, name: "Phan Anh Tuấn", role: "Director", content: "Hệ thống quản lý học liệu tập trung giúp team của tôi làm việc hiệu quả hơn 40%.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Max", rating: 5, date: "24/04/2024", verified: true },
  { id: 12, name: "Đặng Mỹ Linh", role: "Giảng viên", content: "Khả năng phân tích ngữ pháp và tạo câu hỏi trắc nghiệm tự động giúp tôi rảnh tay hơn rất nhiều.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna", rating: 5, date: "25/04/2024", verified: true },
];

const row1 = testimonials.slice(0, 6);
const row2 = testimonials.slice(6, 12);

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => (
  <div className="card-optimized flex-shrink-0 w-[360px] p-6 mx-4 rounded-[1.5rem] bg-[var(--bg-surface)] border border-[var(--border-structural)] dark:border-slate-800 hover:border-brand-400/50 transition-colors duration-300 relative group overflow-hidden">
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5 text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={12} fill={i < testimonial.rating ? "currentColor" : "none"} className={i < testimonial.rating ? "" : "text-slate-200 dark:text-slate-800"} />
          ))}
        </div>
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{testimonial.date}</span>
      </div>
      <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed line-clamp-3">
        "{testimonial.content}"
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-structural)] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <img src={testimonial.avatar} alt={testimonial.name} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 object-cover" loading="lazy" />
          <div>
            <div className="flex items-center gap-1">
              <h4 className="font-bold text-[var(--text-primary)] text-xs">{testimonial.name}</h4>
              {testimonial.verified && <CheckCircle2 size={10} className="text-brand-500" />}
            </div>
            <p className="text-[8px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-tighter">{testimonial.role}</p>
          </div>
        </div>
        <Badge variant="generated" className="!px-1.5 !py-0 text-[8px] dark:bg-brand-600/20 dark:text-brand-300 dark:border-brand-500/30" dot={false}>Verified</Badge>
      </div>
    </div>
  </div>
);

export function Testimonials() {
  return (
    <section className="relative py-24 bg-[var(--bg-section)] dark:bg-[#020617] overflow-hidden containment-layout">
      {/* Background Decor - Optimized for Performance */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/5 dark:bg-brand-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-500/5 dark:bg-accent-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="container mx-auto px-6 text-center mb-16 relative z-30">
        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-300 text-slate-900 text-[10px] font-black mb-6 uppercase tracking-[0.2em] shadow-md border border-brand-400">
            <Users size={14} /> +10k Reliable Users
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">
            Trust by <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-mint-400">Innovators</span>
          </h2>
        </motion.div>
      </div>

      {/* Optimized Infinite Marquee Section */}
      <div className="flex flex-col gap-6 relative py-4 mask-fade">
        {/* Row 1: Right to Left */}
        <div className="marquee-container animate-scroll-left">
          {[...row1, ...row1].map((t, i) => (
            <TestimonialCard key={`${t.id}-r1-${i}`} testimonial={t} />
          ))}
        </div>

        {/* Row 2: Left to Right */}
        <div className="marquee-container animate-scroll-right">
          {[...row2, ...row2].map((t, i) => (
            <TestimonialCard key={`${t.id}-r2-${i}`} testimonial={t} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        .containment-layout {
          contain: layout paint;
        }
        .mask-fade {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .marquee-container {
          display: flex;
          width: fit-content;
          will-change: transform;
          transform: translateZ(0); /* Hardware Acceleration */
        }
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-left {
          animation: scroll-left 45s linear infinite;
        }
        .animate-scroll-right {
          animation: scroll-right 50s linear infinite;
        }
        .card-optimized {
          backface-visibility: hidden;
          transform: translateZ(0);
        }
        .marquee-container:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
