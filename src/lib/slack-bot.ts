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

const DAILY_INTROS = [
  "Today's menu just dropped 🎤",
  "Here's what's cooking today 🍳",
  "Lunch is served — check it out 👇",
  "The menu for today is in 📋",
  "Take a look at today's lineup 👀",
  "Fresh menu, fresh opinions — let's go 🍽️",
  "Today's lunch menu is ready for you 📝",
  "See what's on the menu today ☕",
  "Another day, another menu to rate 🗳️",
  "Lunchtime — here's what we've got 🧑‍🍳",
  "The kitchen has spoken — here's today's menu 🔔",
  "Your daily lunch menu has arrived 📬",
  "Time to see what's for lunch 🍴",
  "Here's today's spread — rate away 📊",
  "Lunch lineup is up — take a look 👇",
];

function getDailyIntro(date: string): string {
  // Use the date string to pick a consistent-but-varying intro each day
  const hash = date.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return DAILY_INTROS[hash % DAILY_INTROS.length];
}

export async function buildDailyMenuBlocks(date: string): Promise<object[] | null> {
  const menu = await getMenuForDate(date);
  if (!menu || menu.no_service) return null;

  const dayName = menu.day_name as string;
  const dayEmoji = getDayEmoji(dayName);
  const intro = getDailyIntro(date);

  const restaurant = menu.restaurant as string | null;
  const restaurantLine = restaurant ? `  🍴 _Catered by ${restaurant}_` : "";

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
        text: `<!here> ${intro}${restaurantLine}`,
      },
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
          text: `📅 ${formatDateHeader(date)} • <https://getkikoff.com/rate-my-plate|Rate on web instead>`,
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

// ─── Slack rating cache — now DB-backed (see lib/db.ts) ─────────────────────
// Re-exported for convenience so existing imports still work
export {
  setCachedOverall,
  setCachedDish,
  getCachedRating,
  clearCachedRating,
} from "@/lib/db";

// Legacy modal builder (kept for reminder DM flow)
export async function buildRatingModal(date: string, overallRating?: number | null): Promise<object> {
  const menu = await getMenuForDate(date);
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

// ─── Bi-Weekly Trends Report ────────────────────────────────────────────────

import type { BiWeeklyTrendsData } from "@/lib/db";

export function buildBiWeeklyTrendsBlocks(data: BiWeeklyTrendsData): object[] {
  if (data.dayRankings.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: "No Mon-Thu ratings found for this period. 🤷" },
      },
    ];
  }

  const blocks: object[] = [];
  const sortedDays = [...data.dayRankings].sort((a, b) => b.avgOverall - a.avgOverall);
  const bestDay = sortedDays[0];
  const worstDay = sortedDays[sortedDays.length - 1];

  // Header
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: "📊 Bi-Weekly Trends Report", emoji: true },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${data.startDate} → ${data.endDate}* (Mon-Thu only)\n\n`
        + `📈 *Avg Overall:* ${data.avgOverall.toFixed(1)}/5.0\n`
        + `🗳️ *Total Votes:* ${data.totalVotes}\n`
        + `📅 *Days Rated:* ${data.totalDays}`,
    },
  });

  blocks.push({ type: "divider" });

  // Best & Worst Days
  const medalEmojis = ["🥇", "🥈", "🥉"];

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: "*📊 Ranked Days This Period*" },
  });

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    const medal = medalEmojis[i] || `#${i + 1}`;
    const menuItems = [
      day.menu.starch,
      day.menu.vegan_protein,
      day.menu.protein_1,
      day.menu.protein_2,
    ]
      .filter(Boolean)
      .join(", ");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${medal} *${day.dayName} (${day.date})* — ${starRating(day.avgOverall)} ${day.avgOverall.toFixed(1)}/5.0 _(${day.totalVotes} votes)_\n> _${menuItems}_`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Team Favorites by Category
  if (data.categoryFavorites.length > 0) {
    let favsText = "*✅ Team Favorites by Category*\n\n";
    for (const fav of data.categoryFavorites) {
      favsText += `> 🟢 *${fav.category}:* ${fav.dishName} — ${fav.avgRating.toFixed(1)}/5.0 _(${fav.timesServed} ratings)_\n`;
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: favsText },
    });
  }

  // Least Favorites by Category
  if (data.categoryWorst.length > 0) {
    let worstText = "*❌ Least Favorites by Category*\n\n";
    for (const w of data.categoryWorst) {
      worstText += `> 🔴 *${w.category}:* ${w.dishName} — ${w.avgRating.toFixed(1)}/5.0 _(${w.timesServed} ratings)_\n`;
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: worstText },
    });
  }

  blocks.push({ type: "divider" });

  // Recommendations
  const bestDishName = data.categoryFavorites.length > 0
    ? data.categoryFavorites.sort((a, b) => b.avgRating - a.avgRating)[0]
    : null;
  const worstDishName = data.categoryWorst.length > 0
    ? data.categoryWorst.sort((a, b) => a.avgRating - b.avgRating)[0]
    : null;

  const bestMenuItems = [bestDay.menu.starch, bestDay.menu.protein_1, bestDay.menu.protein_2]
    .filter(Boolean)
    .join(", ");
  const worstMenuItems = [worstDay.menu.starch, worstDay.menu.protein_1, worstDay.menu.protein_2]
    .filter(Boolean)
    .join(", ");

  let recsText = "*💡 Recommendations*\n\n";
  if (bestDishName) {
    recsText += `> 🟢 *ORDER MORE:* ${bestDishName.dishName} (${bestDishName.category}) — rated ${bestDishName.avgRating.toFixed(1)}, team favorite\n`;
  }
  if (worstDishName) {
    recsText += `> 🔴 *PHASE OUT:* ${worstDishName.dishName} (${worstDishName.category}) — rated ${worstDishName.avgRating.toFixed(1)}, consistently low\n`;
  }
  recsText += `> 🟢 *REPLICATE:* ${bestDay.dayName}'s menu (${bestDay.date}) scored ${bestDay.avgOverall.toFixed(1)} — _${bestMenuItems}_\n`;
  recsText += `> 🟡 *IMPROVE:* ${worstDay.dayName}'s menu (${worstDay.date}) scored ${worstDay.avgOverall.toFixed(1)} — _${worstMenuItems}_\n`;

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: recsText },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Powered by RateMyPlate 🍽️ | Bi-weekly report • Mon-Thu in-house catering only" },
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

/**
 * Send a DM to a specific Slack user by their user ID.
 */
export async function sendDirectMessage(
  userId: string,
  text: string,
  blocks?: object[]
): Promise<void> {
  const slack = getSlackClient();

  // Open a DM channel with the user
  const dm = await slack.conversations.open({ users: userId });
  const channelId = dm.channel?.id;
  if (!channelId) throw new Error(`Could not open DM with user ${userId}`);

  await slack.chat.postMessage({
    channel: channelId,
    text,
    ...(blocks ? { blocks: blocks as never[] } : {}),
  });
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
