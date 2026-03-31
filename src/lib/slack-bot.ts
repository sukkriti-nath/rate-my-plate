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
  { key: "sauce_sides", field: "sauce_sides", emoji: "🫙", label: "Sauce/Sides" },
] as const;

// Emoji scale matching Kate's mockup
const RATING_EMOJIS: Record<number, string> = {
  1: "🙁",
  2: "😕",
  3: "😐",
  4: "😋",
  5: "🤩",
};

const RATING_LABELS: Record<number, string> = {
  5: "Outstanding",
  4: "Really good",
  3: "Decent",
  2: "Below average",
  1: "Did not enjoy",
};

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

function formatDateHeader(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── Daily Rating Message ───────────────────────────────────────────────────
// Kate's design: emoji buttons in-channel for overall rating (1🙁 - 5🤩 + N/A)

export function buildDailyMenuBlocks(date: string): object[] | null {
  const menu = getMenuForDate(date);
  if (!menu || menu.no_service) return null;

  const dayName = menu.day_name as string;
  const dayEmoji = getDayEmoji(dayName);

  const dishLines = DISH_CATEGORIES
    .filter((cat) => cat.key !== "sauce_sides") // show sauce separately
    .map((cat) => {
      const val = menu[cat.field] as string | null;
      if (!val) return null;
      return `${cat.emoji}  *${cat.label}:* ${val}`;
    })
    .filter(Boolean)
    .join("\n");

  const sauceSides = menu.sauce_sides as string | null;
  const sauceLine = sauceSides ? `\n🫙  *Sauce/Sides:* ${sauceSides}` : "";

  const restaurant = menu.restaurant as string | null;
  const restaurantLine = restaurant ? `\n🍴  *Catered by:* ${restaurant}` : "";

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
        text: `<!here> Today's menu is looking *fire* 🔥${restaurantLine}\n\n${dishLines}${sauceLine}`,
      },
    },
    {
      type: "divider",
    },
    // Overall meal rating dropdown
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*How was today's meal overall?*\nRate it, then rate each dish:",
      },
      accessory: {
        type: "static_select",
        action_id: `rate_overall__${date}`,
        placeholder: { type: "plain_text", text: "Rate overall…" },
        options: DROPDOWN_OPTIONS,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📅 ${formatDateHeader(date)} • <${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}|Rate on web instead>`,
        },
      ],
    },
  ];

  return blocks;
}

// ─── Inline Dish Rating (ephemeral message with dropdowns) ──────────────────
// Compact dropdowns for each dish, shown inline in Slack (no popup modal)

const DROPDOWN_OPTIONS = [
  { text: { type: "plain_text" as const, text: "5 🤩 Outstanding", emoji: true }, value: "5" },
  { text: { type: "plain_text" as const, text: "4 😋 Really good", emoji: true }, value: "4" },
  { text: { type: "plain_text" as const, text: "3 😐 Decent", emoji: true }, value: "3" },
  { text: { type: "plain_text" as const, text: "2 😕 Below average", emoji: true }, value: "2" },
  { text: { type: "plain_text" as const, text: "1 🙁 Did not enjoy", emoji: true }, value: "1" },
  { text: { type: "plain_text" as const, text: "N/A — Didn't try", emoji: true }, value: "na" },
];

export function buildInlineRatingBlocks(
  date: string,
  overallRating: number | null,
  menu: Record<string, unknown>,
): object[] {
  const emoji = overallRating ? RATING_EMOJIS[overallRating] : "";
  const overallText = overallRating
    ? `You rated today's meal *${overallRating} ${emoji}* — now rate each dish:`
    : "Rate each dish below:";

  const blocks: object[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `✅ ${overallText}` },
    },
    { type: "divider" },
  ];

  for (const cat of DISH_CATEGORIES) {
    const dishName = menu[cat.field] as string | null;
    if (!dishName) continue;

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `${cat.emoji} *${dishName}*\n_${cat.label}_` },
      accessory: {
        type: "static_select",
        action_id: `dish_rate_${cat.key}__${date}`,
        placeholder: { type: "plain_text", text: "Rate…" },
        options: DROPDOWN_OPTIONS,
      },
    });
  }

  blocks.push({ type: "divider" });

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "✅ Submit Ratings", emoji: true },
        style: "primary",
        action_id: "submit_inline_ratings",
        value: date,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "💬 Add a Comment", emoji: true },
        action_id: "add_inline_comment",
        value: date,
      },
    ],
  });

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Select a rating for each dish, then hit Submit" },
    ],
  });

  return blocks;
}

// Small modal just for adding a comment (no dish ratings)
export function buildCommentModal(date: string): object {
  return {
    type: "modal",
    callback_id: "inline_comment_submission",
    private_metadata: JSON.stringify({ date }),
    title: { type: "plain_text", text: "Add a Comment", emoji: true },
    submit: { type: "plain_text", text: "Save Comment" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "comment_general",
        optional: false,
        element: {
          type: "plain_text_input",
          action_id: "input_comment_general",
          multiline: true,
          placeholder: { type: "plain_text", text: "Any thoughts about today's lunch?" },
        },
        label: { type: "plain_text", text: "Your feedback" },
      },
    ],
  };
}

// ─── Server-side rating cache for inline Slack flow ─────────────────────────
// Tracks selections as user interacts with dropdowns before hitting Submit

interface CachedRating {
  date: string;
  overall: number | null;
  dishes: Record<string, number | null>;
}

const ratingCache = new Map<string, CachedRating>();

export function cacheKey(userId: string, date: string): string {
  return `${userId}:${date}`;
}

export function getCachedRating(userId: string, date: string): CachedRating | undefined {
  return ratingCache.get(cacheKey(userId, date));
}

export function setCachedOverall(userId: string, date: string, overall: number | null): void {
  const key = cacheKey(userId, date);
  const existing = ratingCache.get(key);
  if (existing) {
    existing.overall = overall;
  } else {
    ratingCache.set(key, { date, overall, dishes: {} });
  }
}

export function setCachedDish(userId: string, date: string, dishKey: string, rating: number | null): void {
  const key = cacheKey(userId, date);
  const existing = ratingCache.get(key);
  if (existing) {
    existing.dishes[dishKey] = rating;
  } else {
    ratingCache.set(key, { date, overall: null, dishes: { [dishKey]: rating } });
  }
}

export function clearCachedRating(userId: string, date: string): void {
  ratingCache.delete(cacheKey(userId, date));
}

// Legacy modal builder (kept for reminder DM flow)
export function buildRatingModal(date: string, overallRating?: number | null): object {
  const menu = getMenuForDate(date);
  if (!menu) throw new Error(`No menu found for date ${date}`);

  const blocks: object[] = [
    { type: "header", text: { type: "plain_text", text: `${formatDateHeader(date)} - Dish Ratings` } },
  ];

  if (overallRating && overallRating >= 1 && overallRating <= 5) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `You rated today's meal a *${overallRating} ${RATING_EMOJIS[overallRating]}* — nice! Now tell us how you felt about each dish.` } });
  } else {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "Tell us how you felt about each dish!" } });
  }
  blocks.push({ type: "divider" });

  const ratingOptions = [
    { text: { type: "plain_text" as const, text: "5 🤩  Outstanding", emoji: true }, value: "5" },
    { text: { type: "plain_text" as const, text: "4 😋  Really good", emoji: true }, value: "4" },
    { text: { type: "plain_text" as const, text: "3 😐  Decent", emoji: true }, value: "3" },
    { text: { type: "plain_text" as const, text: "2 😕  Below average", emoji: true }, value: "2" },
    { text: { type: "plain_text" as const, text: "1 🙁  Did not enjoy", emoji: true }, value: "1" },
    { text: { type: "plain_text" as const, text: "N/A - Didn't try it", emoji: true }, value: "na" },
  ];

  for (const cat of DISH_CATEGORIES) {
    const dishName = menu[cat.field] as string | null;
    if (!dishName) continue;
    blocks.push({
      type: "input", block_id: `rating_${cat.key}`, optional: true,
      label: { type: "plain_text", text: `${dishName} (${cat.label})` },
      element: { type: "radio_buttons", action_id: `radio_rating_${cat.key}`, options: ratingOptions },
    });
    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "input", block_id: "comment_general", optional: true,
    element: { type: "plain_text_input", action_id: "input_comment_general", multiline: true, placeholder: { type: "plain_text", text: "Any other thoughts about today's lunch?" } },
    label: { type: "plain_text", text: "General Comments (optional)" },
  });

  return {
    type: "modal", callback_id: "rating_submission",
    private_metadata: JSON.stringify({ date, overallRating: overallRating ?? null }),
    title: { type: "plain_text", text: "Rate My Plate", emoji: true },
    submit: { type: "plain_text", text: "Submit Ratings" },
    close: { type: "plain_text", text: "Skip" },
    blocks,
  };
}

// ─── Parse Modal Submission ─────────────────────────────────────────────────

export interface ParsedRating {
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

function extractRadioRating(stateValues: Record<string, Record<string, unknown>>, blockId: string, actionId: string): number | null {
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

  // Overall rating comes from the channel button click (stored in metadata)
  const overallFromButton = metadata.overallRating;

  return {
    date: metadata.date,
    ratingOverall: overallFromButton ?? null,
    ratingStarch: extractRadioRating(stateValues, "rating_starch", "radio_rating_starch"),
    ratingVeganProtein: extractRadioRating(stateValues, "rating_vegan_protein", "radio_rating_vegan_protein"),
    ratingVeg: extractRadioRating(stateValues, "rating_veg", "radio_rating_veg"),
    ratingProtein1: extractRadioRating(stateValues, "rating_protein_1", "radio_rating_protein_1"),
    ratingProtein2: extractRadioRating(stateValues, "rating_protein_2", "radio_rating_protein_2"),
    comment: extractText(stateValues, "comment_general", "input_comment_general"),
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

  // Hall of Fame - Top 3 dishes
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

  // Hall of Shame (bottom dish)
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

// ─── Monthly Participation Recap ────────────────────────────────────────────

export interface MonthlyRecapData {
  monthLabel: string;
  totalParticipants: number;
  totalVotesCast: number;
  serviceDaysCount: number;
  leaderboard: { rank: number; name: string; daysVoted: number; totalDays: number; streak: number }[];
  perfectAttendance: string[];
  funStats: { label: string; value: string }[];
}

export function buildMonthlyRecapBlocks(data: MonthlyRecapData): object[] {
  const blocks: object[] = [];

  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `🏆 ${data.monthLabel} Participation Recap`, emoji: true },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `Here's who showed up and rated their meals this month! Out of *${data.serviceDaysCount}* lunch days, *${data.totalParticipants}* people cast a total of *${data.totalVotesCast}* votes.`,
    },
  });

  blocks.push({ type: "divider" });

  // Perfect attendance shoutout
  if (data.perfectAttendance.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🌟 *Perfect Attendance* — voted every single day!\n${data.perfectAttendance.map(n => `> 💪 ${n}`).join("\n")}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Leaderboard table
  const MEDALS = ["🥇", "🥈", "🥉"];
  let leaderboardText = "🏅 *Top Participants*\n\n```\n";
  leaderboardText += "| Rank | Name            | Days  |\n";
  leaderboardText += "| ---- | --------------- | ----- |\n";
  for (const p of data.leaderboard.slice(0, 15)) {
    const medal = p.rank <= 3 ? MEDALS[p.rank - 1] + " " : "  ";
    const name = p.name.padEnd(15).slice(0, 15);
    const days = `${p.daysVoted}/${p.totalDays}`;
    leaderboardText += `| ${medal}${String(p.rank).padStart(2)} | ${name} | ${days.padStart(5)} |\n`;
  }
  leaderboardText += "```";

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: leaderboardText },
  });

  // Streak callout
  const topStreaker = data.leaderboard.find(p => p.streak > 0);
  if (topStreaker && topStreaker.streak >= 3) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔥 *Longest active streak:* ${topStreaker.name} with *${topStreaker.streak} days* in a row!`,
      },
    });
  }

  // Fun stats
  if (data.funStats.length > 0) {
    const statsText = data.funStats.map(s => `• ${s.label}: *${s.value}*`).join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📊 *Fun Stats*\n${statsText}` },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Powered by RateMyPlate 🍽️ | Keep voting to climb the leaderboard!" }],
  });

  return blocks;
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
