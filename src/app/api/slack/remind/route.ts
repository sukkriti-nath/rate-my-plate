import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getMenuForDate, getVoterEmailsForDate } from "@/lib/db";

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

  const today = new Date().toISOString().split("T")[0];

  // Check if there's a menu today
  const menu = getMenuForDate(today);
  if (!menu || menu.no_service) {
    return NextResponse.json({ message: "No lunch service today", sent: 0 });
  }

  const slack = new WebClient(botToken);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get emails of people who already voted
  const alreadyVoted = new Set(getVoterEmailsForDate(today));

  // Get all workspace members from a specific channel
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

        if (email && !alreadyVoted.has(email.toLowerCase())) {
          await slack.chat.postMessage({
            channel: userId,
            text: `Hey! You haven't rated today's lunch yet. Tap here to vote: ${appUrl}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Hey! You haven't rated today's lunch yet* :fork_and_knife:\n\n<${appUrl}|Rate today's meal on RateMyPlate>`,
                },
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

  return NextResponse.json({ sent: sentCount, alreadyVoted: alreadyVoted.size });
}
