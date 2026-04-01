import { NextResponse } from "next/server";
import {
  buildWeeklySnackSurveyBlocks,
  getSnackTargetChannelForPost,
  postSnackMessage,
} from "@/lib/snack-bot";
import { getCurrentSnackSurveyWeekId } from "@/lib/snack-db";
import { getSnackNamesForSurvey, warmSnackSurveyCache } from "@/lib/snack-sheet";

// GET /api/snacks/test
//   ?action=ping (default) — smoke test
//   ?action=survey — post weekly snack survey to the channel
//   ?action=preview — JSON only, no Slack post
//   ?week=2026-W14 — override week id for survey preview/post

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = searchParams.get("action") || "ping";
  const weekOverride = searchParams.get("week");
  const weekId = weekOverride || getCurrentSnackSurveyWeekId();

  try {
    if (action === "preview") {
      const snackNames = await getSnackNamesForSurvey();
      const blocks = buildWeeklySnackSurveyBlocks(weekId, {
        totalCount: snackNames.length,
        sampleNames: snackNames,
      });
      return NextResponse.json({
        action: "preview",
        weekId,
        snackOptionCount: snackNames.length,
        sampleSnacks: snackNames.slice(0, 8),
        channel: getSnackTargetChannelForPost(),
        blocks,
        hint: "Voting is in Slack (modal). Interactivity URL must be https://YOUR_HOST/api/snacks/events for the button to work.",
      });
    }

    if (action === "survey") {
      await warmSnackSurveyCache();
      const names = await getSnackNamesForSurvey();
      const blocks = buildWeeklySnackSurveyBlocks(weekId, {
        totalCount: names.length,
        sampleNames: names,
      });
      const ts = await postSnackMessage(
        blocks,
        `Weekly snack survey — ${weekId}`
      );
      const channel = getSnackTargetChannelForPost();
      if (process.env.NODE_ENV === "development") {
        console.log("[snack-test] survey posted to Slack", { weekId, channel, messageTs: ts });
      }
      return NextResponse.json({
        success: true,
        action: "survey",
        weekId,
        messageTs: ts,
        channel,
        whereToLook: `Open Slack → ${channel.startsWith("#") ? channel : `channel ID ${channel}`} and find the latest “Weekly snack survey” message.`,
        pickMyTop5Button:
          "Slack sends button clicks to your Interactivity URL. localhost is not reachable from Slack — use your deployed https://YOUR_HOST/api/snacks/events or an ngrok URL in the Slack app settings.",
      });
    }

    // ping (default)
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Snack Overflow test* — `postSnackMessage` and channel routing are working.",
        },
      },
    ];
    const ts = await postSnackMessage(blocks, "Snack Overflow test");
    return NextResponse.json({
      success: true,
      action: "ping",
      messageTs: ts,
      channel: getSnackTargetChannelForPost(),
      hint: "Try ?action=survey for the weekly survey, ?action=preview to inspect blocks",
    });
  } catch (error) {
    console.error("Snack test error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
