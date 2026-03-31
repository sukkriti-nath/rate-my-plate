"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface DatePickerProps {
  currentDate: string;
  todayDate: string;
  availableDates: string[];
}

export default function DatePicker({ currentDate, todayDate, availableDates }: DatePickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(date: string) {
    if (date === todayDate) {
      router.push("/");
    } else {
      router.push(`/?date=${date}`);
    }
  }

  const currentIdx = availableDates.indexOf(currentDate);
  const canGoPrev = currentIdx < availableDates.length - 1;
  const canGoNext = currentIdx > 0;
  const isToday = currentDate === todayDate;

  const label = new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => canGoPrev && navigate(availableDates[currentIdx + 1])}
        disabled={!canGoPrev}
        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <span className={`px-4 py-1.5 rounded-xl text-sm font-semibold ${isToday ? "bg-kikoff/20 text-kikoff-dark" : "bg-gray-100 text-gray-700"}`}>
        {isToday ? "Today" : label}
      </span>
      <button
        onClick={() => canGoNext && navigate(availableDates[currentIdx - 1])}
        disabled={!canGoNext}
        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
      {!isToday && (
        <button
          onClick={() => navigate(todayDate)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-kikoff text-kikoff-dark hover:bg-kikoff-hover transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}
