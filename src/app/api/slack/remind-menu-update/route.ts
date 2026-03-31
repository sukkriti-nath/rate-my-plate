import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";

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

  // Only run on Fridays (PT)
  const now = new Date();
  const ptDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const dayOfWeek = ptDate.getDay();

  if (dayOfWeek !== 5) {
    return NextResponse.json({ message: "Not Friday, skipping", sent: false });
  }

  const slack = new WebClient(botToken);
  const shivaniEmail = "shivani@kikoff.com";
  const spreadsheetUrl =
    "https://docs.google.com/spreadsheets/d/1dtB8h8DuOpDjZUidjs3m0UyJB6yIVe6OzuHB_3pPMTg/edit?gid=1889885856#gid=1889885856";

  try {
    // Look up Shivani's Slack user ID by email
    const userResult = await slack.users.lookupByEmail({
      email: shivaniEmail,
    });
    const userId = userResult.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Could not find Slack user for shivani@kikoff.com" },
        { status: 404 }
      );
    }

    // Send DM reminder
    await slack.chat.postMessage({
      channel: userId,
      text: `Hi Shivani! Friendly reminder to update next week's lunch menu: ${spreadsheetUrl}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *Happy Friday, Shivani!*\n\nFriendly reminder to update next week's lunch menu in the spreadsheet so the team knows what's coming!",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📝 Open Menu Spreadsheet",
                emoji: true,
              },
              url: spreadsheetUrl,
              style: "primary",
              action_id: "open_menu_spreadsheet",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Sent automatically by RateMyPlate 🍽️",
            },
          ],
        },
      ],
    });

    return NextResponse.json({ sent: true, userId });
  } catch (error) {
    console.error("Failed to send menu update reminder:", error);
    return NextResponse.json(
      {
        error: "Failed to send reminder",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
