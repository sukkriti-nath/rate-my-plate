import { WebClient } from "@slack/web-api";
import { DRINK_CATEGORIES, SNACK_CATEGORIES, getItemOptionsForSlack } from "./snack-inventory";

// Get Slack client for Snack Overflow (separate from Rate My Plate)
export function getSnackSlackClient(): WebClient {
  const token =
    process.env.SNACK_SLACK_BOT_TOKEN?.trim() ||
    process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("SNACK_SLACK_BOT_TOKEN or SLACK_BOT_TOKEN is not configured");
  }
  return new WebClient(token);
}

/** `chat.postMessage` accepts ID or `#channel-name`. Prefer env; else default `#snack-bot-test` for now. */
export function getSnackTargetChannelForPost(): string {
  const id = process.env.SNACK_SLACK_CHANNEL_ID?.trim();
  if (id) return id;
  const name = process.env.SNACK_SLACK_CHANNEL?.trim();
  if (name) return name.startsWith("#") ? name : `#${name}`;
  return "#snack-bot-test";
}

// ============== Out of Stock Modal ==============

export function buildOutOfStockModal(): object {
  const optionGroups = getItemOptionsForSlack().map((group) => ({
    label: { type: "plain_text" as const, text: group.label.slice(0, 75) },
    options: group.options.slice(0, 100).map((opt) => ({
      text: { type: "plain_text" as const, text: opt.text.slice(0, 75) },
      value: opt.value.slice(0, 75),
    })),
  }));

  return {
    type: "modal",
    callback_id: "snack_empty_modal",
    title: { type: "plain_text", text: "Report Out of Stock" },
    submit: { type: "plain_text", text: "Report" },
    blocks: [
      {
        type: "input",
        block_id: "snack_select",
        element: {
          type: "static_select",
          action_id: "selected_snack",
          placeholder: { type: "plain_text", text: "Search for a snack..." },
          option_groups: optionGroups,
        },
        label: { type: "plain_text", text: "Which snack is out of stock?" },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 Can't find it? Use the field below to type it in.",
          },
        ],
      },
      {
        type: "input",
        block_id: "custom_snack",
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "custom_snack_text",
          placeholder: { type: "plain_text", text: "Or type a snack not in the list..." },
        },
        label: { type: "plain_text", text: "Other (if not listed above)" },
      },
    ],
  };
}

// ============== Profile Flow Messages ==============

export function buildProfileStep1Message(
  userId: string,
  currentAllocation: Record<string, number> = {}
): { text: string; blocks: object[] } {
  const totalTokens = Object.values(currentAllocation).reduce((a, b) => a + b, 0);

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🍿 Snack Profile — Step 1: Drinks", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `You have *100 tokens* to allocate across drink categories.\nTap + or - to adjust. Current total: *${totalTokens}/100*`,
      },
    },
    { type: "divider" },
  ];

  for (const cat of DRINK_CATEGORIES) {
    const tokens = currentAllocation[cat.name] || 0;
    const bar = "█".repeat(tokens / 10) + "░".repeat(10 - tokens / 10);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${cat.emoji} *${cat.name}*\n\`${bar}\` ${tokens}`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: tokens > 0 ? `${tokens}` : "0", emoji: true },
        action_id: `drink_token_${cat.name}`,
        value: String(tokens),
      },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Next → Snacks", emoji: true },
        style: totalTokens === 100 ? "primary" : undefined,
        action_id: "profile_next_snacks",
        value: JSON.stringify(currentAllocation),
      },
    ],
  });

  if (totalTokens !== 100) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: totalTokens < 100
            ? `⚠️ You have ${100 - totalTokens} tokens left to spend!`
            : `⚠️ You're ${totalTokens - 100} tokens over budget!`,
        },
      ],
    });
  }

  return {
    text: "Snack Profile — Step 1: Drinks",
    blocks,
  };
}

export function buildProfileStep2Message(
  drinksAllocation: Record<string, number>,
  currentAllocation: Record<string, number> = {}
): { text: string; blocks: object[] } {
  const totalTokens = Object.values(currentAllocation).reduce((a, b) => a + b, 0);

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🍿 Snack Profile — Step 2: Snacks", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Now allocate *100 tokens* for snack categories.\nCurrent total: *${totalTokens}/100*`,
      },
    },
    { type: "divider" },
  ];

  for (const cat of SNACK_CATEGORIES) {
    const tokens = currentAllocation[cat.name] || 0;
    const bar = "█".repeat(tokens / 10) + "░".repeat(10 - tokens / 10);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${cat.emoji} *${cat.name}*\n\`${bar}\` ${tokens}`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: tokens > 0 ? `${tokens}` : "0", emoji: true },
        action_id: `snack_token_${cat.name}`,
        value: String(tokens),
      },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "← Back to Drinks", emoji: true },
        action_id: "profile_back_drinks",
        value: JSON.stringify({ drinks: drinksAllocation, snacks: currentAllocation }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Next → Favorites", emoji: true },
        style: totalTokens === 100 ? "primary" : undefined,
        action_id: "profile_next_favorites",
        value: JSON.stringify({ drinks: drinksAllocation, snacks: currentAllocation }),
      },
    ],
  });

  if (totalTokens !== 100) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: totalTokens < 100
            ? `⚠️ You have ${100 - totalTokens} tokens left to spend!`
            : `⚠️ You're ${totalTokens - 100} tokens over budget!`,
        },
      ],
    });
  }

  return {
    text: "Snack Profile — Step 2: Snacks",
    blocks,
  };
}

export function buildProfileStep3Message(
  drinksAllocation: Record<string, number>,
  snacksAllocation: Record<string, number>,
  favoriteDrinks: string[] = [],
  favoriteSnacks: string[] = []
): { text: string; blocks: object[] } {
  const itemOptions = getItemOptionsForSlack();

  // Filter to drink-related categories
  const drinkOptions = itemOptions.filter((g) =>
    ["Juice", "Energy Drink", "Yerba Mate", "Protein Shake", "Cold Brew Tea", "Sparkling Tea", "Probiotic Soda", "Tepache", "Water Vitamin", "Sparkling Water", "Protein Smoothie", "Cold Brew Latte Alternative"].includes(g.label)
  );

  // Filter to snack-related categories
  const snackOptions = itemOptions.filter((g) =>
    !["Juice", "Energy Drink", "Yerba Mate", "Protein Shake", "Cold Brew Tea", "Sparkling Tea", "Probiotic Soda", "Tepache", "Water Vitamin", "Sparkling Water", "Protein Smoothie", "Cold Brew Latte Alternative"].includes(g.label)
  );

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🍿 Snack Profile — Step 3: Favorites", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Pick your top favorite drinks and snacks! These help us know what to always keep stocked.",
      },
    },
    { type: "divider" },
    {
      type: "input",
      block_id: "favorite_drinks",
      optional: true,
      element: {
        type: "multi_static_select",
        action_id: "select_favorite_drinks",
        placeholder: { type: "plain_text", text: "Select favorite drinks..." },
        max_selected_items: 5,
        option_groups: drinkOptions.map((g) => ({
          label: { type: "plain_text" as const, text: g.label.slice(0, 75) },
          options: g.options.slice(0, 100).map((o) => ({
            text: { type: "plain_text" as const, text: o.text.slice(0, 75) },
            value: o.value.slice(0, 75),
          })),
        })),
      },
      label: { type: "plain_text", text: "🥤 Favorite Drinks (up to 5)" },
    },
    {
      type: "input",
      block_id: "favorite_snacks",
      optional: true,
      element: {
        type: "multi_static_select",
        action_id: "select_favorite_snacks",
        placeholder: { type: "plain_text", text: "Select favorite snacks..." },
        max_selected_items: 5,
        option_groups: snackOptions.map((g) => ({
          label: { type: "plain_text" as const, text: g.label.slice(0, 75) },
          options: g.options.slice(0, 100).map((o) => ({
            text: { type: "plain_text" as const, text: o.text.slice(0, 75) },
            value: o.value.slice(0, 75),
          })),
        })),
      },
      label: { type: "plain_text", text: "🍪 Favorite Snacks (up to 5)" },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "← Back to Snacks", emoji: true },
          action_id: "profile_back_snacks",
          value: JSON.stringify({ drinks: drinksAllocation, snacks: snacksAllocation }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "✅ Save Profile", emoji: true },
          style: "primary",
          action_id: "profile_save",
          value: JSON.stringify({ drinks: drinksAllocation, snacks: snacksAllocation }),
        },
      ],
    },
  ];

  return {
    text: "Snack Profile — Step 3: Favorites",
    blocks,
  };
}

// ============== Profile Card ==============

export function buildProfileCard(profile: {
  displayName: string;
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
}): object[] {
  const topDrinks = Object.entries(profile.drinksAllocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, tokens]) => {
      const emoji = DRINK_CATEGORIES.find((c) => c.name === cat)?.emoji || "🥤";
      return `${emoji} ${cat} (${tokens})`;
    });

  const topSnacks = Object.entries(profile.snacksAllocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, tokens]) => {
      const emoji = SNACK_CATEGORIES.find((c) => c.name === cat)?.emoji || "🍿";
      return `${emoji} ${cat} (${tokens})`;
    });

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `🎉 Profile Saved!`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${profile.displayName}'s Snack Profile*\n\n*Top Drink Categories:*\n${topDrinks.join("\n")}\n\n*Top Snack Categories:*\n${topSnacks.join("\n")}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Favorites: ${[...profile.favoriteDrinks, ...profile.favoriteSnacks].slice(0, 5).join(", ") || "None selected"}`,
        },
      ],
    },
  ];
}

// ============== Out of Stock Alert ==============

export function buildOutOfStockAlert(
  snackName: string,
  category: string | null,
  userId: string,
  timestamp: string
): object[] {
  const text = category
    ? `*${snackName}* (${category}) is out of stock!`
    : `*${snackName}* is out of stock!`;

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "🚨 Out of Stock Alert", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Reported by <@${userId}> • ${timestamp}`,
        },
      ],
    },
  ];
}

// ============== Weekly survey (channel message + top-5 modal) ==============

/** Optional preview of ballot size + sample rows for the channel message (voting still happens in the Slack modal). */
export type WeeklyBallotPreview = {
  totalCount: number;
  sampleNames: string[];
};

function slackMrkdwnSafeLine(s: string, max = 100): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, max);
}

/**
 * Channel message for the weekly survey. Voting is *in Slack*: the button opens a modal with the full
 * searchable list (up to 100 options per Slack). Pass `ballot` so the channel shows a preview list.
 */
export function buildWeeklySnackSurveyBlocks(
  weekId: string,
  ballot?: WeeklyBallotPreview
): object[] {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 Weekly snack & bev picks",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<!here> *Vote entirely in Slack* — pick your *top 5* snacks and/or beverages for this week. Scoring: 1st = 5 pts … 5th = 1 pt.\n_Week ${weekId}_ • <${appUrl}/snacks|Web dashboard (optional)>`,
      },
    },
  ];

  if (ballot && ballot.totalCount > 0) {
    const maxPreview = 20;
    const names = ballot.sampleNames.slice(0, maxPreview);
    const lines = names.map((n) => `• ${slackMrkdwnSafeLine(n)}`);
    const more =
      ballot.totalCount > names.length
        ? `\n_…and ${ballot.totalCount - names.length} more on the ballot (all in the form)._`
        : "";
    const previewBody = `*Ballot: ${ballot.totalCount} items* — sample below. Tap the button to open the *in-Slack* form and choose your top 5.\n\n${lines.join("\n")}${more}`;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          previewBody.length > 2900
            ? `${previewBody.slice(0, 2880)}…`
            : previewBody,
      },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      block_id: `snack_survey_${weekId.replace(/[^a-zA-Z0-9]/g, "_")}`,
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open ballot & vote in Slack",
            emoji: true,
          },
          style: "primary",
          action_id: "snack_survey_open_modal",
          value: weekId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Opens a Slack form on your screen — no website required. You can change your top 5 anytime this week.",
        },
      ],
    }
  );

  return blocks;
}

/** Modal: multi-select exactly 5 from sheet-driven list (max 100 options for Slack). */
export function buildSnackTop5ModalView(weekId: string, snackNames: string[]): object {
  const maxOptions = 100;
  const truncated = snackNames.length > maxOptions;
  const names = snackNames.slice(0, maxOptions);
  // Slack requires unique option labels in multi_static_select; collisions break views.open.
  const seenLabels = new Set<string>();
  const seenValues = new Set<string>();
  const options = names.map((name, i) => {
    let label = name.slice(0, 75);
    let suffix = 0;
    while (seenLabels.has(label)) {
      suffix += 1;
      const extra = ` ·${i + 1}`;
      label = `${name.slice(0, Math.max(0, 75 - extra.length))}${extra}`.slice(0, 75);
      if (suffix > 200) {
        label = `Item ${i + 1}`.slice(0, 75);
        break;
      }
    }
    seenLabels.add(label);
    // Value = snack identity (Slack max 2000). Submissions must not depend on a separate
    // server-side list snapshot (cache can change between open and submit).
    let value = name.slice(0, 2000);
    let vs = 0;
    while (seenValues.has(value)) {
      vs += 1;
      value = `${name.slice(0, 1980)} ·${vs}`.slice(0, 2000);
    }
    seenValues.add(value);
    return {
      text: { type: "plain_text" as const, text: label },
      value,
    };
  });

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*You’re voting in Slack.* Type in the box below to search. Select *exactly 5* items (snacks and/or beverages). *Selection order* = your ranking (#1 = 5 pts … #5 = 1 pt).",
      },
    },
  ];
  if (truncated) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `⚠️ Showing first *${maxOptions}* items (Slack limit). Shorten the sheet or split tabs if you need all items listed.`,
        },
      ],
    });
  }
  blocks.push({
    type: "input",
    block_id: "top5_block",
    optional: false,
    element: {
      type: "multi_static_select",
      action_id: "top5_select",
      placeholder: { type: "plain_text", text: "Choose 5 items" },
      options,
      max_selected_items: 5,
    },
    label: { type: "plain_text", text: "Your top 5 picks" },
  });

  return {
    type: "modal",
    callback_id: "snack_survey_top5_modal",
    private_metadata: JSON.stringify({ weekId }),
    title: { type: "plain_text", text: "Top 5 (snacks & bevs)" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

// ============== Post to Channel ==============

export async function postSnackMessage(
  blocks: object[],
  text: string
): Promise<string | undefined> {
  const slack = getSnackSlackClient();
  const channel = getSnackTargetChannelForPost();

  const result = await slack.chat.postMessage({
    channel,
    text,
    blocks: blocks as never[],
  });

  if (!result.ok) {
    throw new Error(
      `Slack chat.postMessage failed: ${result.error ?? "unknown"} (channel=${channel}). Is the bot in that channel? Token matches this workspace?`
    );
  }

  return result.ts;
}
