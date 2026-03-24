"use client";

export default function SliderRating({
  value,
  onChange,
  lowLabel = "Terrible",
  highLabel = "Amazing",
}: {
  value: number;
  onChange: (rating: number) => void;
  lowLabel?: string;
  highLabel?: string;
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
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-kikoff slider-rating"
          style={{
            background: `linear-gradient(to right, #b5fc4f ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
        <span className="w-8 text-center text-lg font-bold text-kikoff-dark tabular-nums">
          {value}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 px-0.5">
        <span>0 — {lowLabel}</span>
        <span>{highLabel} — 5</span>
      </div>
    </div>
  );
}
