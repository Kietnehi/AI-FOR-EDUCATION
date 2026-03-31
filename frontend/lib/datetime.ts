const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VIETNAM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parseApiDate(value: string): Date {
  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
}

export function formatVietnamDateTime(value: string): string {
  return VIETNAM_DATE_TIME_FORMATTER.format(parseApiDate(value));
}
