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
        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        ← Prev
      </button>
      <span className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 border-black ${isToday ? "bg-kikoff text-black" : "bg-gray-100 text-gray-700"}`}>
        {isToday ? "Today" : label}
      </span>
      <button
        onClick={() => canGoNext && navigate(availableDates[currentIdx - 1])}
        disabled={!canGoNext}
        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        Next →
      </button>
      {!isToday && (
        <button
          onClick={() => navigate(todayDate)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-kikoff text-black border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
        >
          Today
        </button>
      )}
    </div>
  );
}
