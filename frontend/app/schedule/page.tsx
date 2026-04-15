import { ScheduleView } from "@/components/schedule/schedule-view";

export const metadata = {
  title: "Lịch học & làm việc | AI Learning Studio",
  description: "Tải lên và quản lý lịch học tập làm việc của bạn với sự hỗ trợ của AI.",
};

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-section)]">
      <ScheduleView />
    </div>
  );
}
