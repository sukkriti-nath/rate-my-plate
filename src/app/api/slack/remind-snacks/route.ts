import type { WebClient } from "@slack/web-api";
import { NextResponse } from "next/server";
import { getSnackSlackClient } from "@/lib/snack-bot";

export const dynamic = "force-dynamic";

/** Weekly SnackOverflow reminder always posts here (not other snack env channels). */
const SNACK_REMINDER_CHANNEL = "#snack-bot-test";

async function resolveSnackBotTestChannelId(
  slack: WebClient
): Promise<string | null> {
  const fromEnv =
    process.env.SNACK_BOT_TEST_CHANNEL_ID?.trim() ||
    process.env.SNACK_SLACK_CHANNEL_ID?.trim();
  if (fromEnv) return fromEnv;

  let cursor: string | undefined;
  for (let page = 0; page < 15; page++) {
    const res = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    for (const c of res.channels || []) {
      if (c?.name === "snack-bot-test" && c.id) return c.id;
    }
    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return null;
}

function buildSnackReminderBlocks(appUrl: string) {
  const profileUrl = `${appUrl}/snacks/profile`;
  const dashboardUrl = `${appUrl}/snacks`;

  return [
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text:
          "*SnackOverflow* 🍿\n\n" +
          "• *Snack profile* — allocate points across categories and pick favorites so we know what to stock.\n" +
          "• *Suggestions* — add ideas and vote on the team leaderboard.\n\n" +
          "_Sign in with your Kikoff email on the web._",
      },
    },
    {
      type: "actions" as const,
      elements: [
        {
          type: "button" as const,
          text: {
            type: "plain_text" as const,
            text: "Set snack profile",
            emoji: true,
          },
          url: profileUrl,
        },
        {
          type: "button" as const,
          text: {
            type: "plain_text" as const,
            text: "Suggest & vote",
            emoji: true,
          },
          style: "primary" as const,
          url: dashboardUrl,
        },
      ],
    },
    {
      type: "context" as const,
      elements: [
        {
          type: "mrkdwn" as const,
          text: `<${appUrl}|Open SnackOverflow>`,
        },
      ],
    },
  ];
}

/**
 * GET /api/slack/remind-snacks?secret=CRON_SECRET
 *
 * Posts a reminder to the snack Slack channel (default) with links to the web app.
 *
 * Query:
 * - `dm=true` — DM each member of *#snack-bot-test*. Resolves channel ID via
 *   `SNACK_BOT_TEST_CHANNEL_ID`, `SNACK_SLACK_CHANNEL_ID`, or Slack `conversations.list`.
 *
 * Env: `NEXT_PUBLIC_APP_URL`, snack bot token (`SNACK_SLACK_BOT_TOKEN` or `SLACK_BOT_TOKEN`).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let slack: ReturnType<typeof getSnackSlackClient>;
  try {
    slack = getSnackSlackClient();
  } catch {
    return NextResponse.json(
      { error: "SNACK_SLACK_BOT_TOKEN or SLACK_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const profileUrl = `${appUrl}/snacks/profile`;
  const dashboardUrl = `${appUrl}/snacks`;
  const fallbackText = `SnackOverflow — set your snack profile: ${profileUrl} · suggest & vote: ${dashboardUrl}`;

  const blocks = buildSnackReminderBlocks(appUrl);
  const dm =
    searchParams.get("dm") === "1" || searchParams.get("dm")?.toLowerCase() === "true";

  if (!dm) {
    try {
      const result = await slack.chat.postMessage({
        channel: SNACK_REMINDER_CHANNEL,
        text: fallbackText,
        blocks: blocks as never[],
      });
      return NextResponse.json({
        ok: true,
        mode: "channel",
        channel: SNACK_REMINDER_CHANNEL,
        ts: result.ts,
      });
    } catch (e) {
      console.error("[remind-snacks] channel post failed:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "postMessage failed" },
        { status: 500 }
      );
    }
  }

  let channelId: string | null = null;
  try {
    channelId = await resolveSnackBotTestChannelId(slack);
  } catch (e) {
    console.error("[remind-snacks] resolveSnackBotTestChannelId:", e);
  }
  if (!channelId) {
    return NextResponse.json(
      {
        error:
          "DM mode: could not resolve #snack-bot-test channel ID. Set SNACK_BOT_TEST_CHANNEL_ID or SNACK_SLACK_CHANNEL_ID, or ensure the bot can list channels.",
      },
      { status: 400 }
    );
  }

  let sent = 0;
  let errors = 0;
  try {
    const result = await slack.conversations.members({
      channel: channelId,
      limit: 500,
    });

    for (const userId of result.members || []) {
      try {
        const userInfo = await slack.users.info({ user: userId });
        if (userInfo.user?.is_bot) continue;

        await slack.chat.postMessage({
          channel: userId,
          text: fallbackText,
          blocks: blocks as never[],
        });
        sent++;
      } catch (err) {
        errors++;
        console.error(`[remind-snacks] DM failed for ${userId}:`, err);
      }
    }
  } catch (e) {
    console.error("[remind-snacks] conversations.members failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list channel members" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "dm",
    sent,
    errors,
    channelId,
  });
}
