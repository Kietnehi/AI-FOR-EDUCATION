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

const VIETNAM_INPUT_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function parseVietnamDateTime(value: string): Date {
  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (hasTimeZone) {
    return new Date(value);
  }

  const [datePart, timePart = "00:00:00"] = value.trim().split(/[ T]/, 2);
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
}

export function formatVietnamInputDateTime(value: string): string {
  if (!value) {
    return "";
  }

  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!hasTimeZone) {
    return value.slice(0, 16).replace(" ", "T");
  }

  return VIETNAM_INPUT_FORMATTER.format(parseVietnamDateTime(value)).replace(" ", "T");
}

export function formatVietnamTime(value: string): string {
  if (!value) {
    return "";
  }

  return parseVietnamDateTime(value).toLocaleTimeString("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getVietnamDay(value: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    weekday: "short",
  }).format(parseVietnamDateTime(value));
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[parts] ?? 0;
}

export function getVietnamNowInputValue(): string {
  return VIETNAM_INPUT_FORMATTER.format(new Date()).replace(" ", "T");
}

export function addMinutesToInputValue(value: string, minutesToAdd: number): string {
  const date = parseVietnamDateTime(value);
  const next = new Date(date.getTime() + minutesToAdd * 60_000);
  return VIETNAM_INPUT_FORMATTER.format(next).replace(" ", "T");
}
