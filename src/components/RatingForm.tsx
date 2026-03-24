"use client";

import { useState } from "react";
import SliderRating from "./SliderRating";
import Confetti from "./Confetti";

interface DishInfo {
  key: string;
  label: string;
  name: string | null;
}

interface RatingFormProps {
  date: string;
  dishes: DishInfo[];
  existingVote?: Record<string, unknown> | null;
  onVoteSubmitted?: () => void;
}

const OVERALL_REACTIONS = [
  "",
  "😬 Yikes...",
  "😐 Meh",
  "🙂 Decent",
  "😋 Tasty!",
  "🤤 Chef's kiss!",
];

export default function RatingForm({
  date,
  dishes,
  existingVote,
  onVoteSubmitted,
}: RatingFormProps) {
  const [ratingOverall, setRatingOverall] = useState(0);
  const [dishRatings, setDishRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const dish of dishes) {
      initial[dish.key] = 0;
    }
    return initial;
  });
  const [comment, setComment] = useState(
    (existingVote?.comment as string) || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  function setDishRating(key: string, value: number) {
    setDishRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratingOverall === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          ratingOverall,
          ratingStarch: dishRatings.starch || null,
          ratingVeganProtein: dishRatings.vegan_protein || null,
          ratingVeg: dishRatings.veg || null,
          ratingProtein1: dishRatings.protein_1 || null,
          ratingProtein2: dishRatings.protein_2 || null,
          comment: comment || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setShowConfetti(true);
        onVoteSubmitted?.();
        setTimeout(() => {
          setSubmitted(false);
          setShowConfetti(false);
        }, 3000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const availableDishes = dishes.filter((d) => d.name);
  const reaction = OVERALL_REACTIONS[ratingOverall] || "";

  return (
    <>
      <Confetti active={showConfetti} />
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Overall Rating */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Overall Lunch Rating
          </label>
          <p className="text-xs text-gray-400 mb-3">
            How was today&apos;s lunch overall? Drag the slider to rate from 0 (skip next time) to 5 (want it every week).
          </p>
          <SliderRating
            value={ratingOverall}
            onChange={setRatingOverall}
            lowLabel="Skip next time"
            highLabel="Want it every week"
          />
          {reaction && (
            <div className="mt-2 text-center text-lg animate-slide-up" key={ratingOverall}>
              {reaction}
            </div>
          )}
        </div>

        {/* Per-dish Ratings */}
        {availableDishes.length > 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Rate Each Dish
              </label>
              <p className="text-xs text-gray-400">
                Rate individual dishes so we know what to keep and what to swap. Leave at 0 if you didn&apos;t try it.
              </p>
            </div>
            <div className="space-y-4">
              {availableDishes.map((dish, i) => (
                <div
                  key={dish.key}
                  className="bg-kikoff-lavender rounded-xl px-4 py-3 animate-slide-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {dish.label}
                    </div>
                    <div className="text-sm text-gray-700">
                      {dish.name?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim()}
                    </div>
                  </div>
                  <SliderRating
                    value={dishRatings[dish.key] || 0}
                    onChange={(v) => setDishRating(dish.key, v)}
                    lowLabel="Didn't like it"
                    highLabel="Loved it"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Drop a hot take (optional) 🌶️
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Chef's kiss... or needs more salt?"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-kikoff focus:border-transparent resize-none"
          />
          <div className="text-right text-xs text-gray-300 mt-1">
            {comment.length}/280
          </div>
        </div>

        <button
          type="submit"
          disabled={ratingOverall === 0 || submitting}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]
            ${submitted
              ? "bg-green-500 text-white"
              : "bg-kikoff text-kikoff-dark hover:bg-kikoff-hover disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
        >
          {submitted
            ? "🎉 Submitted! Thanks for rating!"
            : submitting
            ? "Sending..."
            : ratingOverall === 0
            ? "Slide to rate first ☝️"
            : existingVote
            ? "Update Rating 🔄"
            : `Submit Rating ${ratingOverall >= 4 ? "🔥" : ratingOverall <= 2 ? "😬" : "👍"}`}
        </button>
      </form>
    </>
  );
}
