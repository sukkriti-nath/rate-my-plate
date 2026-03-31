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
  const [overallNA, setOverallNA] = useState(false);
  const [dishRatings, setDishRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const dish of dishes) {
      initial[dish.key] = 0;
    }
    return initial;
  });
  const [dishNAs, setDishNAs] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState(
    (existingVote?.comment as string) || ""
  );
  const [dishComments, setDishComments] = useState<Record<string, string>>({});
  const [expandedDish, setExpandedDish] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  function setDishRating(key: string, value: number) {
    setDishRatings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDishNA(key: string) {
    setDishNAs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!overallNA && ratingOverall === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          ratingOverall: overallNA ? null : ratingOverall,
          ratingStarch: dishNAs.starch ? null : (dishRatings.starch || null),
          ratingVeganProtein: dishNAs.vegan_protein ? null : (dishRatings.vegan_protein || null),
          ratingVeg: dishNAs.veg ? null : (dishRatings.veg || null),
          ratingProtein1: dishNAs.protein_1 ? null : (dishRatings.protein_1 || null),
          ratingProtein2: dishNAs.protein_2 ? null : (dishRatings.protein_2 || null),
          comment: comment || null,
          commentStarch: dishComments.starch || null,
          commentVeganProtein: dishComments.vegan_protein || null,
          commentVeg: dishComments.veg || null,
          commentProtein1: dishComments.protein_1 || null,
          commentProtein2: dishComments.protein_2 || null,
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
  const reaction = overallNA ? "🤷 Didn't eat" : (OVERALL_REACTIONS[ratingOverall] || "");
  const canSubmit = overallNA || ratingOverall > 0;
  const alreadyVoted = !!existingVote && !submitted;

  if (alreadyVoted) {
    const voteOverall = existingVote.rating_overall as number | null;
    const voteSource = existingVote.slack_user_id ? "Slack" : "web";
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
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
                <div key={dish.key} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-xs text-gray-400 uppercase mr-2">{dish.label}</span>
                    <span className="text-sm text-gray-700">{dish.name}</span>
                  </div>
                  <span className="font-bold text-sm text-gray-700">
                    {val ? `${val}/5` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {(existingVote.comment as string) && (
          <div className="px-4 py-3 bg-gray-50 rounded-xl">
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
        <div className="bg-kikoff-lavender rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold text-gray-800">
              How was today&apos;s meal?
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Drag to rate from 0 (skip next time) to 5 (want it every week).
          </p>
          <SliderRating
            value={ratingOverall}
            onChange={setRatingOverall}
            lowLabel="Skip next time"
            highLabel="Want it every week"
            showNA
            isNA={overallNA}
            onNAChange={setOverallNA}
          />
          {reaction && (
            <div className="mt-2 text-center text-base animate-slide-up" key={`${ratingOverall}-${overallNA}`}>
              {reaction}
            </div>
          )}
        </div>

        {/* General comment */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Drop a hot take 🌶️ <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="The vibes were immaculate..."
            className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-700
              focus:outline-none focus:border-kikoff transition-colors resize-none"
          />
          <div className="text-right text-[10px] text-gray-300 mt-1">
            {comment.length}/280
          </div>
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
              const isExpanded = expandedDish === dish.key;
              const dishNA = dishNAs[dish.key] || false;

              return (
                <div
                  key={dish.key}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm animate-slide-up"
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
                      value={dishRatings[dish.key] || 0}
                      onChange={(v) => setDishRating(dish.key, v)}
                      lowLabel="Didn't like it"
                      highLabel="Loved it"
                      showNA
                      isNA={dishNA}
                      onNAChange={() => toggleDishNA(dish.key)}
                    />
                  </div>

                  {/* Expandable feedback */}
                  <button
                    type="button"
                    onClick={() => setExpandedDish(isExpanded ? null : dish.key)}
                    className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-50"
                  >
                    {isExpanded ? "Hide feedback ▴" : "Add feedback ▾"}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 animate-slide-up">
                      <textarea
                        value={dishComments[dish.key] || ""}
                        onChange={(e) =>
                          setDishComments((prev) => ({ ...prev, [dish.key]: e.target.value }))
                        }
                        maxLength={200}
                        rows={2}
                        placeholder={`What did you think of the ${dish.label.toLowerCase()}?`}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700
                          focus:outline-none focus:border-kikoff transition-colors resize-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98]
            ${submitted
              ? "bg-green-500 text-white"
              : "bg-kikoff text-kikoff-dark hover:bg-kikoff-hover hover:shadow-lg hover:shadow-kikoff/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
