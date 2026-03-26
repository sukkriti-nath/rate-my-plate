import { WebClient } from "@slack/web-api";
import { getMenuForDate, type WeeklyDayRanking } from "@/lib/db";

// Re-export for convenience
export function getSlackClient(): WebClient {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured");
  return new WebClient(token);
}

const DISH_CATEGORIES = [
  { key: "starch", field: "starch", emoji: "🍚", label: "Starch" },
  { key: "vegan_protein", field: "vegan_protein", emoji: "🌱", label: "Vegan Protein" },
  { key: "veg", field: "veg", emoji: "🥦", label: "Veg" },
  { key: "protein_1", field: "protein_1", emoji: "🍗", label: "Protein 1" },
  { key: "protein_2", field: "protein_2", emoji: "🥩", label: "Protein 2" },
] as const;

function starRating(n: number): string {
  const full = Math.round(n);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function getDayEmoji(dayName: string): string {
  const emojis: Record<string, string> = {
    Monday: "🌮",
    Tuesday: "🍜",
    Wednesday: "🍕",
    Thursday: "🍱",
    Friday: "🎉",
  };
  return emojis[dayName] || "🍽️";
}

// ─── Daily Rating Message ───────────────────────────────────────────────────

export function buildDailyMenuBlocks(date: string): object[] | null {
  const menu = getMenuForDate(date);
  if (!menu || menu.no_service) return null;

  const dayName = menu.day_name as string;
  const dayEmoji = getDayEmoji(dayName);

  const dishLines = DISH_CATEGORIES
    .map((cat) => {
      const val = menu[cat.field] as string | null;
      if (!val) return null;
      return `${cat.emoji}  *${cat.label}:* ${val}`;
    })
    .filter(Boolean)
    .join("\n");

  const sauceSides = menu.sauce_sides as string | null;
  const sauceLine = sauceSides ? `\n🫙  *Sauce/Sides:* ${sauceSides}` : "";

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${dayEmoji} ${dayName}'s Lunch is Served!`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Today's menu is looking *fire* 🔥\n\n${dishLines}${sauceLine}`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "What do you think? Rate today's lunch and help us crown the weekly champion!",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⭐ Rate Today's Lunch",
            emoji: true,
          },
          style: "primary",
          action_id: "open_rating_modal",
          value: date,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🌐 Rate on Web",
            emoji: true,
          },
          url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          action_id: "open_web_rating",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📅 ${date} • Ratings are anonymous-ish (we see your name but won't judge... much 😏)`,
        },
      ],
    },
  ];

  return blocks;
}

// ─── Rating Modal ───────────────────────────────────────────────────────────

export function buildRatingModal(date: string): object {
  const menu = getMenuForDate(date);
  if (!menu) throw new Error(`No menu found for date ${date}`);

  const blocks: object[] = [];

  // Overall rating
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*🍽️ Overall Meal Rating*\nHow was today's lunch overall?",
    },
  });
  blocks.push({
    type: "actions",
    block_id: "rating_overall",
    elements: [
      {
        type: "static_select",
        action_id: "select_rating_overall",
        placeholder: {
          type: "plain_text",
          text: "Pick a rating",
        },
        options: [
          ...([1, 2, 3, 4, 5].map((n) => ({
            text: { type: "plain_text" as const, text: `${"⭐".repeat(n)} (${n})`, emoji: true },
            value: String(n),
          }))),
          {
            text: { type: "plain_text" as const, text: "N/A - Didn't try", emoji: true },
            value: "na",
          },
        ],
      },
    ],
  });

  // Overall comment
  blocks.push({
    type: "input",
    block_id: "comment_overall",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "input_comment_overall",
      multiline: true,
      placeholder: {
        type: "plain_text",
        text: "Any overall thoughts? Chef's kiss or needs work?",
      },
    },
    label: {
      type: "plain_text",
      text: "💬 Overall Comments",
      emoji: true,
    },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*🍳 Rate Each Dish*\nHelp us know exactly what hit and what missed!",
    },
  });

  // Per-dish ratings
  for (const cat of DISH_CATEGORIES) {
    const dishName = menu[cat.field] as string | null;
    if (!dishName) continue;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${cat.emoji} *${cat.label}:* ${dishName}`,
      },
    });

    blocks.push({
      type: "actions",
      block_id: `rating_${cat.key}`,
      elements: [
        {
          type: "static_select",
          action_id: `select_rating_${cat.key}`,
          placeholder: {
            type: "plain_text",
            text: "Pick a rating",
          },
          options: [
            ...([1, 2, 3, 4, 5].map((n) => ({
              text: { type: "plain_text" as const, text: `${"⭐".repeat(n)} (${n})`, emoji: true },
              value: String(n),
            }))),
            {
              text: { type: "plain_text" as const, text: "N/A - Didn't try", emoji: true },
              value: "na",
            },
          ],
        },
      ],
    });

    blocks.push({
      type: "input",
      block_id: `comment_${cat.key}`,
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: `input_comment_${cat.key}`,
        placeholder: {
          type: "plain_text",
          text: `Thoughts on the ${dishName.toLowerCase()}?`,
        },
      },
      label: {
        type: "plain_text",
        text: `💬 ${cat.label} Comment`,
        emoji: true,
      },
    });
  }

  return {
    type: "modal",
    callback_id: "rating_submission",
    private_metadata: JSON.stringify({ date }),
    title: {
      type: "plain_text",
      text: "Rate My Plate 🍽️",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Submit Rating",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks,
  };
}

// ─── Parse Modal Submission ─────────────────────────────────────────────────

interface ParsedRating {
  date: string;
  ratingOverall: number | null;
  ratingStarch: number | null;
  ratingVeganProtein: number | null;
  ratingVeg: number | null;
  ratingProtein1: number | null;
  ratingProtein2: number | null;
  comment: string | null;
  commentStarch: string | null;
  commentVeganProtein: string | null;
  commentVeg: string | null;
  commentProtein1: string | null;
  commentProtein2: string | null;
}

function extractRating(stateValues: Record<string, Record<string, unknown>>, blockId: string, actionId: string): number | null {
  const block = stateValues[blockId];
  if (!block) return null;
  const action = block[actionId] as { selected_option?: { value?: string } } | undefined;
  const val = action?.selected_option?.value;
  if (!val || val === "na") return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

function extractText(stateValues: Record<string, Record<string, unknown>>, blockId: string, actionId: string): string | null {
  const block = stateValues[blockId];
  if (!block) return null;
  const action = block[actionId] as { value?: string } | undefined;
  const val = action?.value?.trim();
  return val || null;
}

export function parseModalSubmission(view: Record<string, unknown>): ParsedRating {
  const metadata = JSON.parse(view.private_metadata as string);
  const stateValues = (view.state as { values: Record<string, Record<string, unknown>> }).values;

  return {
    date: metadata.date,
    ratingOverall: extractRating(stateValues, "rating_overall", "select_rating_overall"),
    ratingStarch: extractRating(stateValues, "rating_starch", "select_rating_starch"),
    ratingVeganProtein: extractRating(stateValues, "rating_vegan_protein", "select_rating_vegan_protein"),
    ratingVeg: extractRating(stateValues, "rating_veg", "select_rating_veg"),
    ratingProtein1: extractRating(stateValues, "rating_protein_1", "select_rating_protein_1"),
    ratingProtein2: extractRating(stateValues, "rating_protein_2", "select_rating_protein_2"),
    comment: extractText(stateValues, "comment_overall", "input_comment_overall"),
    commentStarch: extractText(stateValues, "comment_starch", "input_comment_starch"),
    commentVeganProtein: extractText(stateValues, "comment_vegan_protein", "input_comment_vegan_protein"),
    commentVeg: extractText(stateValues, "comment_veg", "input_comment_veg"),
    commentProtein1: extractText(stateValues, "comment_protein_1", "input_comment_protein_1"),
    commentProtein2: extractText(stateValues, "comment_protein_2", "input_comment_protein_2"),
  };
}

// ─── Friday Power Rankings ──────────────────────────────────────────────────

export function buildPowerRankingsBlocks(rankings: WeeklyDayRanking[]): object[] {
  if (rankings.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "No ratings this week! Everyone was too busy eating to rate. 😅",
        },
      },
    ];
  }

  // Sort days by average overall rating
  const sortedDays = [...rankings]
    .filter((d) => d.totalVotes > 0)
    .sort((a, b) => b.avgOverall - a.avgOverall);

  // Collect all dishes across the week
  const allDishes = rankings.flatMap((d) =>
    d.dishRankings.map((dish) => ({
      ...dish,
      dayName: d.dayName,
      date: d.date,
    }))
  );
  const sortedDishes = [...allDishes].sort((a, b) => b.avg - a.avg);

  const medalEmojis = ["🥇", "🥈", "🥉"];
  const blocks: object[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🏆 Weekly Power Rankings",
      emoji: true,
    },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "The votes are in! Here's how this week's lunches stacked up:",
    },
  });

  blocks.push({ type: "divider" });

  // Day rankings
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*📊 Best Day of the Week*",
    },
  });

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    const medal = medalEmojis[i] || `#${i + 1}`;
    const stars = starRating(day.avgOverall);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${medal} *${day.dayName}* — ${stars} ${day.avgOverall.toFixed(1)}/5.0 _(${day.totalVotes} votes)_`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Top 3 dishes
  if (sortedDishes.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🏛️ Hall of Fame*",
      },
    });

    const topDishes = sortedDishes.slice(0, 3);
    for (let i = 0; i < topDishes.length; i++) {
      const dish = topDishes[i];
      const medal = medalEmojis[i] || `#${i + 1}`;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${medal} *${dish.name}* (${dish.category}, ${dish.dayName}) — ${starRating(dish.avg)} ${dish.avg.toFixed(1)}/5.0`,
        },
      });
    }
  }

  // Needs work (bottom dish)
  if (sortedDishes.length > 1) {
    blocks.push({ type: "divider" });

    const worstDish = sortedDishes[sortedDishes.length - 1];
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*💀 Hall of Shame*\n${worstDish.name} (${worstDish.category}, ${worstDish.dayName}) — ${starRating(worstDish.avg)} ${worstDish.avg.toFixed(1)}/5.0\n_Better luck next time!_`,
      },
    });
  }

  blocks.push({ type: "divider" });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Powered by RateMyPlate 🍽️ | Ratings from this week's lunches",
      },
    ],
  });

  return blocks;
}

// ─── Post message to channel ────────────────────────────────────────────────

export async function postToChannel(blocks: object[], text: string): Promise<string | undefined> {
  const slack = getSlackClient();
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!channelId) throw new Error("SLACK_CHANNEL_ID is not configured");

  const result = await slack.chat.postMessage({
    channel: channelId,
    text,
    blocks: blocks as never[],
  });

  return result.ts;
}

export async function uploadFileToChannel(buffer: Buffer, filename: string, title: string): Promise<void> {
  const slack = getSlackClient();
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!channelId) throw new Error("SLACK_CHANNEL_ID is not configured");

  await slack.filesUploadV2({
    channel_id: channelId,
    file: buffer,
    filename,
    title,
    initial_comment: "📊 Here's this week's Power Rankings graphic for All Hands!",
  });
}
