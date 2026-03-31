import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getSlackClient,
  buildRatingModal,
  buildInlineRatingBlocks,
  buildCommentModal,
  parseModalSubmission,
  setCachedOverall,
  setCachedDish,
  getCachedRating,
  clearCachedRating,
} from "@/lib/slack-bot";
import { upsertVote, getMenuForDate, getUserVoteForDate, warmDb } from "@/lib/db";

// Eagerly start DB connection on module load (reduces cold start latency)
warmDb();

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

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = JSON.parse(rawBody);
    return handleEventsApi(payload);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");
    if (!payloadStr) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    const payload = JSON.parse(payloadStr);
    const type = payload.type as string;

    // View submissions (modals) must be handled synchronously — Slack expects response_action
    if (type === "view_submission") {
      return handleViewSubmission(payload);
    }

    // Block actions: handle normally — warmDb() at module load keeps cold starts fast
    return handleInteraction(payload);
  }

  return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
}

function handleEventsApi(payload: Record<string, unknown>) {
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
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
  const actions = payload.actions as Array<{
    action_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  if (!actions || actions.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const action = actions[0];
  const triggerId = payload.trigger_id as string;
  const responseUrl = payload.response_url as string | undefined;
  const user = payload.user as { id: string; name: string; username: string };
  const userId = user.id;

  // ─── Overall rating dropdown (rate_overall__{date}) ──────────────────────
  const overallDropdownMatch = action.action_id.match(/^rate_overall__(\d{4}-\d{2}-\d{2})$/);
  if (overallDropdownMatch) {
    const date = overallDropdownMatch[1];
    const selectedValue = action.selected_option?.value;
    const rating = selectedValue && selectedValue !== "na" ? parseInt(selectedValue, 10) : null;

    const menu = await getMenuForDate(date) as Record<string, unknown> | undefined;
    if (!menu) return NextResponse.json({ ok: true });

    // Cache the overall rating
    await setCachedOverall(userId, date, rating);

    // Post ephemeral message with per-dish dropdowns via response_url
    if (responseUrl) {
      const blocks = buildInlineRatingBlocks(date, rating, menu);
      try {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "Rate each dish below:",
            blocks,
          }),
        });
      } catch (err) {
        console.error("Failed to post inline rating message:", err);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ─── Dish dropdown selection (dish_rate_{key}__{date}) ─────────────────
  const dishRateMatch = action.action_id.match(/^dish_rate_(.+)__(\d{4}-\d{2}-\d{2})$/);
  if (dishRateMatch) {
    const dishKey = dishRateMatch[1];
    const date = dishRateMatch[2];
    const selectedValue = action.selected_option?.value;

    if (selectedValue && date) {
      const rating = selectedValue === "na" ? null : parseInt(selectedValue, 10);
      await setCachedDish(userId, date, dishKey, rating);
    }

    // Just acknowledge — Slack UI shows the selected dropdown value
    return NextResponse.json({ ok: true });
  }

  // ─── Submit inline ratings ─────────────────────────────────────────────
  if (action.action_id === "submit_inline_ratings") {
    const date = action.value || "";
    const cached = await getCachedRating(userId, date);

    if (!cached) {
      // No cached data — tell user
      if (responseUrl) {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replace_original: true,
            text: "⚠️ No ratings found. Try rating again!",
            blocks: [{ type: "section", text: { type: "mrkdwn", text: "⚠️ No ratings found — please try again from the channel message." } }],
          }),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Get user email from Slack
    let userEmail = `${user.username}@kikoff.com`;
    let userName = user.name || user.username;
    try {
      const slack = getSlackClient();
      const userInfo = await slack.users.info({ user: userId });
      if (userInfo.user?.profile?.email) userEmail = userInfo.user.profile.email;
      if (userInfo.user?.real_name) userName = userInfo.user.real_name;
    } catch (err) {
      console.error("Failed to fetch user email:", err);
    }

    // Save to DB — merge with any existing vote (don't overwrite with nulls)
    try {
      const existing = await getUserVoteForDate(userEmail, date);

      await upsertVote({
        menuDate: date,
        userName,
        userEmail,
        slackUserId: userId,
        ratingOverall: cached.overall ?? (existing?.rating_overall as number | null) ?? null,
        ratingStarch: cached.dishes.starch ?? (existing?.rating_starch as number | null) ?? null,
        ratingVeganProtein: cached.dishes.vegan_protein ?? (existing?.rating_vegan_protein as number | null) ?? null,
        ratingVeg: cached.dishes.veg ?? (existing?.rating_veg as number | null) ?? null,
        ratingProtein1: cached.dishes.protein_1 ?? (existing?.rating_protein_1 as number | null) ?? null,
        ratingProtein2: cached.dishes.protein_2 ?? (existing?.rating_protein_2 as number | null) ?? null,
        comment: (existing?.comment as string | null) ?? null,
        commentStarch: (existing?.comment_starch as string | null) ?? null,
        commentVeganProtein: (existing?.comment_vegan_protein as string | null) ?? null,
        commentVeg: (existing?.comment_veg as string | null) ?? null,
        commentProtein1: (existing?.comment_protein_1 as string | null) ?? null,
        commentProtein2: (existing?.comment_protein_2 as string | null) ?? null,
      });

      // Build confirmation summary using merged data
      const EMOJIS: Record<number, string> = { 1: "🙁", 2: "😕", 3: "😐", 4: "😋", 5: "🤩" };
      const finalOverall = cached.overall ?? (existing?.rating_overall as number | null) ?? null;
      const overallText = finalOverall ? `${finalOverall} ${EMOJIS[finalOverall]}` : "N/A";
      const dishCount = Object.values(cached.dishes).filter((v) => v !== null && v !== undefined).length;

      const isUpdate = !!existing;
      if (responseUrl) {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replace_original: true,
            text: isUpdate ? "Ratings updated!" : "Ratings submitted!",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: isUpdate
                    ? `✏️ *Ratings updated!*\n\n⭐ Overall: *${overallText}*\n🍽️ Dishes rated: *${dishCount}*\n\nYour previous ratings have been updated. Thanks! 🙏`
                    : `🎉 *Ratings submitted!*\n\n⭐ Overall: *${overallText}*\n🍽️ Dishes rated: *${dishCount}*\n\nThanks for your feedback — it helps us improve the menu! 🙏`,
                },
              },
            ],
          }),
        });
      }

      await clearCachedRating(userId, date);
    } catch (err) {
      console.error("Failed to save inline ratings:", err);
      if (responseUrl) {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replace_original: true,
            text: "Error saving ratings",
            blocks: [{ type: "section", text: { type: "mrkdwn", text: "❌ Something went wrong saving your ratings. Please try again!" } }],
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ─── Add comment button → opens small modal ───────────────────────────
  if (action.action_id === "add_inline_comment") {
    const date = action.value || "";
    try {
      const slack = getSlackClient();
      const modal = buildCommentModal(date);
      await slack.views.open({ trigger_id: triggerId, view: modal as never });
    } catch (err) {
      console.error("Failed to open comment modal:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Legacy: "Rate in Slack" from reminder DMs ─────────────────────────
  if (action.action_id === "open_rating_modal") {
    const date = action.value || "";
    const menu = await getMenuForDate(date);
    if (!menu) return NextResponse.json({ ok: true });

    try {
      const slack = getSlackClient();
      const modal = await buildRatingModal(date);
      await slack.views.open({ trigger_id: triggerId, view: modal as never });
    } catch (err) {
      console.error("Failed to open modal:", err);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleViewSubmission(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>;
  const callbackId = view.callback_id as string;
  const user = payload.user as { id: string; name: string; username: string };
  const userId = user.id;

  // ─── Inline comment modal ──────────────────────────────────────────────
  if (callbackId === "inline_comment_submission") {
    const metadata = JSON.parse(view.private_metadata as string);
    const date = metadata.date;
    const stateValues = (view.state as { values: Record<string, Record<string, { value?: string }>> }).values;
    const comment = stateValues.comment_general?.input_comment_general?.value?.trim() || null;

    if (comment) {
      // Get user email
      let userEmail = `${user.username}@kikoff.com`;
      let userName = user.name || user.username;
      try {
        const slack = getSlackClient();
        const userInfo = await slack.users.info({ user: userId });
        if (userInfo.user?.profile?.email) userEmail = userInfo.user.profile.email;
        if (userInfo.user?.real_name) userName = userInfo.user.real_name;
      } catch { /* use fallback */ }

      // Get cached ratings and existing vote — merge to avoid overwriting
      const cached = await getCachedRating(userId, date);
      const existing = await getUserVoteForDate(userEmail, date);

      await upsertVote({
        menuDate: date,
        userName,
        userEmail,
        slackUserId: userId,
        ratingOverall: cached?.overall ?? (existing?.rating_overall as number | null) ?? null,
        ratingStarch: cached?.dishes.starch ?? (existing?.rating_starch as number | null) ?? null,
        ratingVeganProtein: cached?.dishes.vegan_protein ?? (existing?.rating_vegan_protein as number | null) ?? null,
        ratingVeg: cached?.dishes.veg ?? (existing?.rating_veg as number | null) ?? null,
        ratingProtein1: cached?.dishes.protein_1 ?? (existing?.rating_protein_1 as number | null) ?? null,
        ratingProtein2: cached?.dishes.protein_2 ?? (existing?.rating_protein_2 as number | null) ?? null,
        comment,
        commentStarch: (existing?.comment_starch as string | null) ?? null,
        commentVeganProtein: (existing?.comment_vegan_protein as string | null) ?? null,
        commentVeg: (existing?.comment_veg as string | null) ?? null,
        commentProtein1: (existing?.comment_protein_1 as string | null) ?? null,
        commentProtein2: (existing?.comment_protein_2 as string | null) ?? null,
      });

      await clearCachedRating(userId, date);
    }

    return NextResponse.json({ response_action: "clear" });
  }

  // ─── Legacy modal submission (from reminder DMs) ───────────────────────
  if (callbackId === "rating_submission") {
    try {
      const parsed = parseModalSubmission(view);
      const slackUserId = user.id;

      let userEmail = `${user.username}@kikoff.com`;
      let userName = user.name || user.username;
      try {
        const slack = getSlackClient();
        const userInfo = await slack.users.info({ user: slackUserId });
        if (userInfo.user?.profile?.email) userEmail = userInfo.user.profile.email;
        if (userInfo.user?.real_name) userName = userInfo.user.real_name;
      } catch { /* use fallback */ }

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
          errors: { comment_general: "Please rate at least one dish before submitting!" },
        });
      }

      await upsertVote({
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

      // Send DM confirmation
      try {
        const slack = getSlackClient();
        const emoji = parsed.ratingOverall ? ({ 1: "🙁", 2: "😕", 3: "😐", 4: "😋", 5: "🤩" }[parsed.ratingOverall] || "") : "";
        const overallText = parsed.ratingOverall ? `${parsed.ratingOverall} ${emoji}` : "N/A";
        await slack.chat.postMessage({
          channel: slackUserId,
          text: `Thanks for rating today's lunch! Your overall: ${overallText}\nYour feedback helps us improve the menu. 🙏`,
        });
      } catch { /* DM failed, that's ok */ }
    } catch (err) {
      console.error("Failed to save rating:", err);
      return NextResponse.json({
        response_action: "errors",
        errors: { comment_general: "Something went wrong saving your rating. Try again!" },
      });
    }

    return NextResponse.json({ response_action: "clear" });
  }

  return NextResponse.json({ response_action: "clear" });
}
