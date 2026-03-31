"use client";

import { useState } from "react";

export default function StarRating({
  value,
  onChange,
  size = "lg",
  readonly = false,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  const sizeClass = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${sizeClass} transition-transform ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          }`}
          onMouseEnter={() => !readonly && setHovered(star)}
          onClick={() => onChange?.(star)}
        >
          <span
            className={
              star <= (hovered || value)
                ? "text-kikoff drop-shadow-[1px_1px_0px_#000]"
                : "text-gray-300"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
