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
  const [ratingOverall, setRatingOverall] = useState(1);
  const [overallHasValue, setOverallHasValue] = useState(false);
  const [overallNA, setOverallNA] = useState(false);
  const [dishRatings, setDishRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const dish of dishes) {
      initial[dish.key] = 1;
    }
    return initial;
  });
  const [dishHasValues, setDishHasValues] = useState<Record<string, boolean>>({});
  const [dishNAs, setDishNAs] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState(
    (existingVote?.comment as string) || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  function setDishRating(key: string, value: number) {
    setDishRatings((prev) => ({ ...prev, [key]: value }));
    setDishHasValues((prev) => ({ ...prev, [key]: true }));
  }

  function toggleDishNA(key: string) {
    setDishNAs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!overallNA && !overallHasValue) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          ratingOverall: overallNA ? null : ratingOverall,
          ratingStarch: dishNAs.starch ? null : (dishHasValues.starch ? dishRatings.starch : null),
          ratingVeganProtein: dishNAs.vegan_protein ? null : (dishHasValues.vegan_protein ? dishRatings.vegan_protein : null),
          ratingVeg: dishNAs.veg ? null : (dishHasValues.veg ? dishRatings.veg : null),
          ratingProtein1: dishNAs.protein_1 ? null : (dishHasValues.protein_1 ? dishRatings.protein_1 : null),
          ratingProtein2: dishNAs.protein_2 ? null : (dishHasValues.protein_2 ? dishRatings.protein_2 : null),
          ratingDish6: dishNAs.dish_6 ? null : (dishHasValues.dish_6 ? dishRatings.dish_6 : null),
          ratingDish7: dishNAs.dish_7 ? null : (dishHasValues.dish_7 ? dishRatings.dish_7 : null),
          ratingDish8: dishNAs.dish_8 ? null : (dishHasValues.dish_8 ? dishRatings.dish_8 : null),
          ratingDish9: dishNAs.dish_9 ? null : (dishHasValues.dish_9 ? dishRatings.dish_9 : null),
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
  const reaction = overallNA ? "🤷 Didn't eat" : overallHasValue ? (OVERALL_REACTIONS[ratingOverall] || "") : "";
  const canSubmit = overallNA || overallHasValue;
  const alreadyVoted = !!existingVote && !submitted;

  if (alreadyVoted) {
    const voteOverall = existingVote.rating_overall as number | null;
    const voteSource = existingVote.slack_user_id ? "Slack" : "web";
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border-2 border-black rounded-xl p-5 text-center shadow-[4px_4px_0px_0px_#000]">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-bold text-gray-900 text-lg">You already voted today!</p>
          <p className="text-sm text-gray-500 mt-1">
            Submitted via {voteSource} {voteOverall ? `— you rated it ${voteOverall}/5 ${OVERALL_REACTIONS[voteOverall]?.split(" ").slice(1).join(" ") || ""}` : ""}
          </p>
        </div>
        {availableDishes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your dish ratings</p>
            {availableDishes.map((dish) => {
              const ratingKey = `rating_${dish.key}` as string;
              const val = existingVote[ratingKey] as number | null;
              return (
                <div key={dish.key} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl border-2 border-black">
                  <div>
                    <span className="text-xs text-gray-400 uppercase mr-2">{dish.label}</span>
                    <span className="text-sm text-gray-700">{dish.name}</span>
                  </div>
                  <span className="font-bold text-sm text-gray-700">
                    {val ? `${val}/5` : <span className="text-gray-400 font-normal">Not tried</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {(existingVote.comment as string) && (
          <div className="px-4 py-3 bg-gray-50 rounded-xl border-2 border-black">
            <p className="text-xs text-gray-400 mb-1">Your comment</p>
            <p className="text-sm text-gray-700">&ldquo;{existingVote.comment as string}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Confetti active={showConfetti} />
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Overall Rating */}
        <div className="bg-kikoff-lavender rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold text-gray-800">
              How was today&apos;s meal?
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Drag to rate from 1 (skip next time) to 5 (want it every week).
          </p>
          <SliderRating
            value={ratingOverall}
            onChange={(v) => { setRatingOverall(v); setOverallHasValue(true); }}
            lowLabel="Skip next time"
            highLabel="Want it every week"
            hasValue={overallHasValue}
            showNA
            isNA={overallNA}
            onNAChange={setOverallNA}
          />
        </div>

        {/* Per-dish Ratings */}
        {availableDishes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-gray-800">
                Rate each dish
              </label>
              <span className="text-xs text-gray-400">
                — skip what you didn&apos;t try
              </span>
            </div>
            {availableDishes.map((dish, i) => {
              const dishNA = dishNAs[dish.key] || false;

              return (
                <div
                  key={dish.key}
                  className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#000] animate-slide-up"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {dish.label}
                      </span>
                      <span className="text-sm text-gray-700 font-medium">
                        {dish.name?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim()}
                      </span>
                    </div>
                    <SliderRating
                      value={dishRatings[dish.key] || 1}
                      onChange={(v) => setDishRating(dish.key, v)}
                      lowLabel="Didn't like it"
                      highLabel="Loved it"
                      hasValue={dishHasValues[dish.key] || false}
                      showNA
                      isNA={dishNA}
                      onNAChange={() => toggleDishNA(dish.key)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* General comment */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Share any additional comments <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="The vibes were immaculate..."
            className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm text-gray-700
              focus:outline-none focus:border-kikoff transition-colors resize-none"
          />
          <div className="text-right text-[10px] text-gray-300 mt-1">
            {comment.length}/280
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-lg transition-all border-2 border-black
            ${submitted
              ? "bg-green-500 text-white shadow-none"
              : "bg-kikoff text-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
        >
          {submitted
            ? "🎉 Submitted! Thanks for rating!"
            : submitting
            ? "Sending..."
            : !canSubmit
            ? "Slide to rate first ☝️"
            : existingVote
            ? "Update Rating 🔄"
            : `Submit Rating ${ratingOverall >= 4 ? "🔥" : ratingOverall <= 2 && ratingOverall > 0 ? "😬" : "👍"}`}
        </button>
      </form>
    </>
  );
}
