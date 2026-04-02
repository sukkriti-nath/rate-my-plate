"use client";

export default function SliderRating({
  value,
  onChange,
  lowLabel = "Terrible",
  highLabel = "Amazing",
  showNA = false,
  isNA = false,
  onNAChange,
  hasValue = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  lowLabel?: string;
  highLabel?: string;
  showNA?: boolean;
  isNA?: boolean;
  onNAChange?: (na: boolean) => void;
  hasValue?: boolean;
}) {
  // 1–5 range: map value 1→0% ... 5→100%
  const pct = ((value - 1) / 4) * 100;
  const unselected = !isNA && !hasValue;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={isNA ? 1 : value}
          disabled={isNA}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`flex-1 rounded-full cursor-pointer slider-rating transition-opacity ${
            isNA ? "opacity-30 cursor-not-allowed" : ""
          } ${unselected ? "slider-rating-empty" : ""}`}
          style={{
            background:
              isNA || unselected
                ? "#e5e7eb"
                : `linear-gradient(to right, #B5FC4F ${pct}%, #e5e7eb ${pct}%)`,
            border: isNA ? undefined : "2px solid black",
            borderRadius: "9999px",
          }}
        />
        <span
          className={`w-8 text-center text-lg font-bold tabular-nums transition-colors ${
            isNA || unselected ? "text-gray-300" : "text-kikoff-dark"
          }`}
        >
          {isNA || unselected ? "—" : value}
        </span>
        {showNA && (
          <button
            type="button"
            onClick={() => onNAChange?.(!isNA)}
            className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all border-2 ${
              isNA
                ? "bg-gray-200 text-gray-600 border-black shadow-[2px_2px_0px_0px_#000]"
                : "bg-transparent text-gray-400 border-black hover:bg-gray-100"
            }`}
          >
            N/A
          </button>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 px-0.5">
        <span>1 — {lowLabel}</span>
        <span>{highLabel} — 5</span>
      </div>
    </div>
  );
}
