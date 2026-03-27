import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getSlackClient,
  buildRatingModal,
  parseModalSubmission,
} from "@/lib/slack-bot";
import { upsertVote, getMenuForDate } from "@/lib/db";

// Slack sends interactions as application/x-www-form-urlencoded with a `payload` field,
// and events API as application/json. This endpoint handles both.

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn("SLACK_SIGNING_SECRET not set, skipping verification");
    return true;
  }

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Check content type to determine if this is an events API call or interaction
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    // Events API (including URL verification)
    const payload = JSON.parse(rawBody);
    return handleEventsApi(payload);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    // Interactive component payload
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");
    if (!payloadStr) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    const payload = JSON.parse(payloadStr);
    return handleInteraction(payload);
  }

  return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
}

function handleEventsApi(payload: Record<string, unknown>) {
  // URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Event callbacks (we don't need any right now, but handle gracefully)
  if (payload.type === "event_callback") {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleInteraction(payload: Record<string, unknown>) {
  const type = payload.type as string;

  if (type === "block_actions") {
    return handleBlockAction(payload);
  }

  if (type === "view_submission") {
    return handleViewSubmission(payload);
  }

  return NextResponse.json({ ok: true });
}

async function handleBlockAction(payload: Record<string, unknown>) {
  const actions = payload.actions as Array<{ action_id: string; value: string }>;
  if (!actions || actions.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const action = actions[0];
  const triggerId = payload.trigger_id as string;

  // ─── Handle emoji rating buttons (1🙁 through 5🤩) ───────────────────
  // Kate's flow: tap emoji button in channel → records overall rating → opens modal
  const overallRatingMatch = action.action_id.match(/^rate_overall_(\d|na)$/);
  if (overallRatingMatch) {
    let parsed: { date: string; rating: number | null };
    try {
      parsed = JSON.parse(action.value);
    } catch {
      return NextResponse.json({ ok: true });
    }

    const { date, rating } = parsed;

    // Verify the menu exists
    const menu = getMenuForDate(date);
    if (!menu) {
      return NextResponse.json({ ok: true });
    }

    try {
      const slack = getSlackClient();
      const modal = buildRatingModal(date, rating);

      await slack.views.open({
        trigger_id: triggerId,
        view: modal as never,
      });
    } catch (err) {
      console.error("Failed to open modal:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // ─── Legacy: handle old "open_rating_modal" button (from reminders) ───
  if (action.action_id === "open_rating_modal") {
    const date = action.value;

    const menu = getMenuForDate(date);
    if (!menu) {
      return NextResponse.json({ ok: true });
    }

    try {
      const slack = getSlackClient();
      const modal = buildRatingModal(date);

      await slack.views.open({
        trigger_id: triggerId,
        view: modal as never,
      });
    } catch (err) {
      console.error("Failed to open modal:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // For other actions (radio buttons in modal, web link button, etc.), just acknowledge
  return NextResponse.json({ ok: true });
}

async function handleViewSubmission(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>;
  const callbackId = view.callback_id as string;

  if (callbackId !== "rating_submission") {
    return NextResponse.json({ response_action: "clear" });
  }

  try {
    const parsed = parseModalSubmission(view);

    // Get user info from the payload
    const user = payload.user as { id: string; name: string; username: string };
    const slackUserId = user.id;

    // Fetch user's email from Slack
    let userEmail = `${user.username}@kikoff.com`; // fallback
    let userName = user.name || user.username;

    try {
      const slack = getSlackClient();
      const userInfo = await slack.users.info({ user: slackUserId });
      if (userInfo.user?.profile?.email) {
        userEmail = userInfo.user.profile.email;
      }
      if (userInfo.user?.real_name) {
        userName = userInfo.user.real_name;
      }
    } catch (err) {
      console.error("Failed to fetch user email from Slack:", err);
    }

    // Check that at least one rating was provided (overall from button OR a dish rating)
    if (
      parsed.ratingOverall === null &&
      parsed.ratingStarch === null &&
      parsed.ratingVeganProtein === null &&
      parsed.ratingVeg === null &&
      parsed.ratingProtein1 === null &&
      parsed.ratingProtein2 === null
    ) {
      return NextResponse.json({
        response_action: "errors",
        errors: {
          comment_general:
            "Please rate at least one dish before submitting!",
        },
      });
    }

    upsertVote({
      menuDate: parsed.date,
      userName,
      userEmail,
      slackUserId,
      ratingOverall: parsed.ratingOverall,
      ratingStarch: parsed.ratingStarch,
      ratingVeganProtein: parsed.ratingVeganProtein,
      ratingVeg: parsed.ratingVeg,
      ratingProtein1: parsed.ratingProtein1,
      ratingProtein2: parsed.ratingProtein2,
      comment: parsed.comment,
      commentStarch: parsed.commentStarch,
      commentVeganProtein: parsed.commentVeganProtein,
      commentVeg: parsed.commentVeg,
      commentProtein1: parsed.commentProtein1,
      commentProtein2: parsed.commentProtein2,
    });

    // Send a DM confirmation to the user
    try {
      const slack = getSlackClient();
      const emoji = parsed.ratingOverall
        ? ({ 1: "🙁", 2: "😕", 3: "😐", 4: "😋", 5: "🤩" }[parsed.ratingOverall] || "")
        : "";
      const overallText = parsed.ratingOverall
        ? `${parsed.ratingOverall} ${emoji}`
        : "N/A";
      await slack.chat.postMessage({
        channel: slackUserId,
        text: `Thanks for rating today's lunch! Your overall: ${overallText}\nYour feedback helps us improve the menu. 🙏`,
      });
    } catch (err) {
      console.error("Failed to send confirmation DM:", err);
    }
  } catch (err) {
    console.error("Failed to save rating:", err);
    return NextResponse.json({
      response_action: "errors",
      errors: {
        comment_general: "Something went wrong saving your rating. Try again!",
      },
    });
  }

  return NextResponse.json({ response_action: "clear" });
}
