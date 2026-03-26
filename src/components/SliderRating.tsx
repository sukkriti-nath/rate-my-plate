"use client";

export default function SliderRating({
  value,
  onChange,
  lowLabel = "Terrible",
  highLabel = "Amazing",
  showNA = false,
  isNA = false,
  onNAChange,
}: {
  value: number;
  onChange: (rating: number) => void;
  lowLabel?: string;
  highLabel?: string;
  showNA?: boolean;
  isNA?: boolean;
  onNAChange?: (na: boolean) => void;
}) {
  const pct = (value / 5) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={isNA ? 0 : value}
          disabled={isNA}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`flex-1 rounded-full cursor-pointer slider-rating transition-opacity ${
            isNA ? "opacity-30 cursor-not-allowed" : ""
          }`}
          style={{
            background: isNA
              ? "#e5e7eb"
              : `linear-gradient(to right, #b5fc4f ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
        <span className={`w-8 text-center text-lg font-bold tabular-nums transition-colors ${
          isNA ? "text-gray-300" : "text-kikoff-dark"
        }`}>
          {isNA ? "—" : value}
        </span>
        {showNA && (
          <button
            type="button"
            onClick={() => onNAChange?.(!isNA)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
              isNA
                ? "bg-gray-200 text-gray-600 border-gray-300"
                : "bg-transparent text-gray-400 border-gray-200 hover:border-gray-300"
            }`}
          >
            N/A
          </button>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 px-0.5">
        <span>0 — {lowLabel}</span>
        <span>{highLabel} — 5</span>
      </div>
    </div>
  );
}
