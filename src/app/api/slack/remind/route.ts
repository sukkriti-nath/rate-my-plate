import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getMenuForDate, getVoterEmailsForDate, getVoteStatsForDate } from "@/lib/db";

const NUDGE_MESSAGES = [
  "Psst... you haven't rated today's lunch yet 👀",
  "The kitchen wants YOUR opinion 🍽️",
  "Don't let your taste buds go unheard! 🗣️",
  "Your food hot take is needed 🌶️",
  "Rate before you forget what it tasted like 😋",
  "Be the change you want to see in the cafeteria 🦸",
  "Your vote = better lunches. Science. 🔬",
];

function getRandomNudge(): string {
  return NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
}

export async function GET(request: Request) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "SLACK_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  // Use PT date
  const now = new Date();
  const ptDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const today = ptDate.toISOString().split("T")[0];
  const dayOfWeek = ptDate.getDay();

  // Only remind Mon-Thu
  if (dayOfWeek < 1 || dayOfWeek > 4) {
    return NextResponse.json({ message: "Not a reminder day", sent: 0 });
  }

  // Check if there's a menu today
  const menu = getMenuForDate(today);
  if (!menu || menu.no_service) {
    return NextResponse.json({ message: "No lunch service today", sent: 0 });
  }

  const slack = new WebClient(botToken);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get current vote stats for social proof
  const stats = getVoteStatsForDate(today);
  const voteCount = stats.totalVotes;
  const socialProof = voteCount > 0
    ? `\n📊 *${voteCount} Kikster${voteCount !== 1 ? "s" : ""}* already rated — join them!`
    : "";

  // Get emails of people who already voted
  const alreadyVoted = new Set(
    getVoterEmailsForDate(today).map((e) => e.toLowerCase())
  );

  // Get all workspace members from the channel
  const channelId = process.env.SLACK_CHANNEL_ID;
  let sentCount = 0;

  if (channelId) {
    const result = await slack.conversations.members({
      channel: channelId,
      limit: 500,
    });

    for (const userId of result.members || []) {
      try {
        // Get user's email from Slack
        const userInfo = await slack.users.info({ user: userId });
        const email = userInfo.user?.profile?.email;

        // Skip bots
        if (userInfo.user?.is_bot) continue;

        if (email && !alreadyVoted.has(email.toLowerCase())) {
          const nudge = getRandomNudge();
          await slack.chat.postMessage({
            channel: userId,
            text: `${nudge} Rate today's lunch: ${appUrl}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${nudge}*${socialProof}`,
                },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "⭐ Rate in Slack",
                      emoji: true,
                    },
                    style: "primary",
                    action_id: "open_rating_modal",
                    value: today,
                  },
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "🌐 Rate on Web",
                      emoji: true,
                    },
                    url: appUrl,
                    action_id: "open_web_rating",
                  },
                ],
              },
            ],
          });
          sentCount++;
        }
      } catch (err) {
        console.error(`Failed to process ${userId}:`, err);
      }
    }
  }

  return NextResponse.json({
    sent: sentCount,
    alreadyVoted: alreadyVoted.size,
    date: today,
  });
}
