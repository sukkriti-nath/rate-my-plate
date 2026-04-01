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
      const blocks = buildWeeklySnackSurveyBlocks(weekId);
      const snackNames = await getSnackNamesForSurvey();
      return NextResponse.json({
        action: "preview",
        weekId,
        snackOptionCount: snackNames.length,
        sampleSnacks: snackNames.slice(0, 8),
        channel: getSnackTargetChannelForPost(),
        blocks,
        hint: "Default: Kikoff inventory sheet (Brand+Flavor rows). Override SNACK_SHEET_ID / SNACK_SHEET_GID. Interactivity → /api/snacks/events",
      });
    }

    if (action === "survey") {
      await warmSnackSurveyCache();
      const blocks = buildWeeklySnackSurveyBlocks(weekId);
      const ts = await postSnackMessage(
        blocks,
        `Weekly snack survey — ${weekId}`
      );
      return NextResponse.json({
        success: true,
        action: "survey",
        weekId,
        messageTs: ts,
        channel: getSnackTargetChannelForPost(),
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
