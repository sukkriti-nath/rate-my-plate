import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getSnackSlackClient,
  buildOutOfStockModal,
  buildProfileStep1Message,
  buildProfileStep2Message,
  buildProfileStep3Message,
  buildProfileCard,
  buildOutOfStockAlert,
  postSnackMessage,
  buildSnackTop5ModalView,
} from "@/lib/snack-bot";
import {
  getProfile,
  upsertProfile,
  awardPoints,
  reportOutOfStock,
  recordSnackTop5Vote,
} from "@/lib/snack-db";
import { getSnackNamesForSurveyWithinSlackDeadline } from "@/lib/snack-sheet";
import { ALL_INVENTORY, getItemName, TOKENS_PER_CLICK, MAX_TOKENS } from "@/lib/snack-inventory";

// Verify Slack request signature (raw body must match what Slack signed — form-urlencoded or JSON)
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(now - ts) > 300) {
    return false;
  }
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(baseString);
  const expectedSignature = `v0=${hmac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

type ProfileSession = {
  step: number;
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
  messageTs?: string;
};

// In-memory session storage for profile flow (simple approach)
const profileSessions = new Map<string, ProfileSession>();

/** Slack block_actions / shortcuts: after views.open, respond with empty 200 — not `{ ok: true }` (invalid payload → warning icon). */
function slackInteractionAck(): NextResponse {
  return new NextResponse(null, { status: 200 });
}

/** Ephemeral follow-up when the HTTP ack must be empty (Slack still shows this in-channel to the user). */
async function postEphemeralToResponseUrl(
  responseUrl: string | undefined,
  text: string
): Promise<void> {
  if (!responseUrl) return;
  try {
    const res = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        replace_original: false,
        text,
      }),
    });
    if (!res.ok) {
      console.error(
        "[snack-survey] response_url POST failed:",
        res.status,
        await res.text()
      );
    }
  } catch (e) {
    console.error("[snack-survey] response_url fetch failed:", e);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature") || "";
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";

  const signingSecret =
    process.env.SNACK_SLACK_SIGNING_SECRET?.trim() ||
    process.env.SLACK_SIGNING_SECRET?.trim();
  if (signingSecret) {
    if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
      console.warn(
        "[snack-events] Invalid Slack signature — use Signing Secret from this Slack app (Basic Information → App Credentials). Env: SNACK_SLACK_SIGNING_SECRET or SLACK_SIGNING_SECRET."
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const contentType = request.headers.get("content-type") || "";

  // Events API (JSON): URL verification, event subscriptions
  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }
    if (body.type === "event_callback") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  // Slash commands + interactive components (buttons, modals) — always form-urlencoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const slack = getSnackSlackClient();

    const payloadStr = params.get("payload");
    if (payloadStr) {
      try {
        const payload = JSON.parse(payloadStr) as Record<string, unknown>;
        return await handleInteraction(payload, slack);
      } catch (error) {
        console.error("Snack bot error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    }

    const command = params.get("command");
    if (command) {
      const body: Record<string, string> = {};
      params.forEach((v, k) => {
        body[k] = v;
      });
      try {
        return await handleSlashCommand(body, slack);
      } catch (error) {
        console.error("Snack bot error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Missing payload or command" }, { status: 400 });
  }

  console.warn(
    "[snack-events] Unsupported Content-Type:",
    contentType || "(empty)",
    "— Slack buttons send application/x-www-form-urlencoded with a payload= field"
  );
  return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
}

/** GET: confirm this URL is deployed (browser/curl). Slack still POSTs interactivity here. */
export async function GET() {
  const hasSigning = !!(
    process.env.SNACK_SLACK_SIGNING_SECRET?.trim() ||
    process.env.SLACK_SIGNING_SECRET?.trim()
  );
  const hasToken = !!(
    process.env.SNACK_SLACK_BOT_TOKEN?.trim() ||
    process.env.SLACK_BOT_TOKEN?.trim()
  );
  return NextResponse.json({
    ok: true,
    path: "/api/snacks/events",
    whatThisDoes:
      "Slack POSTs button clicks here; the server calls views.open so you get a Top 5 modal.",
    smokeTest: {
      signingSecretConfigured: hasSigning,
      botTokenConfigured: hasToken,
    },
    troubleshooting: [
      "Interactivity: Slack app → Interactivity → Request URL = https://YOUR_HOST/api/snacks/events (must match deploy; not localhost unless using a tunnel).",
      "Signing Secret in your host env must match Slack → Basic Information → App Credentials for the same app that owns the bot token.",
      "Bot token (SNACK_SLACK_BOT_TOKEN or SLACK_BOT_TOKEN) must be that same app’s Bot User OAuth Token.",
      "If the button spins then shows a warning: 401 = bad signature; check logs for [snack-events] and [snack-survey].",
      "Modal must open within ~3s of the click (trigger_id expires); warm cache with /api/snacks/test?action=survey or a second click.",
    ],
  });
}

async function handleSlashCommand(body: Record<string, string>, slack: ReturnType<typeof getSnackSlackClient>) {
  const command = body.command;
  const userId = body.user_id;
  const triggerId = body.trigger_id;

  switch (command) {
    case "/snack-empty": {
      // Open the out-of-stock modal
      await slack.views.open({
        trigger_id: triggerId,
        view: buildOutOfStockModal() as never,
      });
      return slackInteractionAck();
    }

    case "/snack-profile": {
      // Start profile flow - send DM with interactive message
      const existingProfile = await getProfile(userId);

      // Initialize or restore session
      const session: ProfileSession = {
        step: 1,
        drinksAllocation: existingProfile?.drinksAllocation || {},
        snacksAllocation: existingProfile?.snacksAllocation || {},
        favoriteDrinks: existingProfile?.favoriteDrinks || [],
        favoriteSnacks: existingProfile?.favoriteSnacks || [],
      };
      profileSessions.set(userId, session);

      const message = buildProfileStep1Message(userId, session.drinksAllocation);
      const result = await slack.chat.postMessage({
        channel: userId,
        ...message,
      });

      session.messageTs = result.ts;
      profileSessions.set(userId, session);

      return NextResponse.json({
        response_type: "ephemeral",
        text: "📬 Check your DMs! I sent you the snack profile form.",
      });
    }

    case "/snack-list": {
      // Show inventory categories
      const categories = new Set(ALL_INVENTORY.map((i) => i.category));
      const text = `*📋 Snack Categories*\n\n${Array.from(categories).sort().map((c) => `• ${c}`).join("\n")}\n\n_Use \`/snack-empty\` to report out-of-stock items_`;

      return NextResponse.json({
        response_type: "ephemeral",
        text,
      });
    }

    default:
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Unknown command: ${command}`,
      });
  }
}

async function handleInteraction(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>
) {
  const type = payload.type as string;
  const userId = (payload.user as { id: string }).id;

  // Handle modal submissions
  if (type === "view_submission") {
    const callbackId = (payload.view as { callback_id: string }).callback_id;

    if (callbackId === "snack_empty_modal") {
      return handleOutOfStockSubmission(payload, slack);
    }
    if (callbackId === "snack_survey_top5_modal") {
      return handleSnackTop5Submission(payload, slack);
    }
  }

  // Handle block actions (button clicks)
  if (type === "block_actions") {
    const actions = payload.actions as { action_id: string; value?: string }[];
    const action = actions[0];
    if (!action) {
      return slackInteractionAck();
    }
    const actionId = action.action_id;

    if (actionId === "snack_survey_open_modal") {
      return handleSnackSurveyOpenModal(payload, slack);
    }

    // Token allocation buttons
    if (actionId.startsWith("drink_token_") || actionId.startsWith("snack_token_")) {
      return handleTokenClick(payload, slack, userId, actionId);
    }

    // Profile navigation
    if (actionId === "profile_next_snacks") {
      return handleProfileNextSnacks(payload, slack, userId);
    }
    if (actionId === "profile_back_drinks") {
      return handleProfileBackDrinks(payload, slack, userId);
    }
    if (actionId === "profile_next_favorites") {
      return handleProfileNextFavorites(payload, slack, userId);
    }
    if (actionId === "profile_back_snacks") {
      return handleProfileBackSnacks(payload, slack, userId);
    }
    if (actionId === "profile_save") {
      return handleProfileSave(payload, slack, userId);
    }
  }

  return slackInteractionAck();
}

async function handleOutOfStockSubmission(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>
) {
  const userId = (payload.user as { id: string }).id;
  const view = payload.view as {
    state: { values: Record<string, Record<string, { selected_option?: { value: string }; value?: string }>> };
  };

  const selected = view.state.values.snack_select?.selected_snack?.selected_option?.value;
  const custom = view.state.values.custom_snack?.custom_snack_text?.value;
  const snackName = selected || custom?.trim();

  if (!snackName) {
    return NextResponse.json({
      response_action: "errors",
      errors: { snack_select: "Please select or enter a snack" },
    });
  }

  // Find category from inventory
  const item = ALL_INVENTORY.find((i) => getItemName(i) === snackName);
  const category = item?.category || null;

  // Save report
  await reportOutOfStock(snackName, userId, category || undefined);

  // Award points
  const userInfo = await slack.users.info({ user: userId });
  const displayName = userInfo.user?.real_name || userInfo.user?.name || userId;
  await awardPoints(userId, "out_of_stock", displayName);

  // Post alert to channel
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "short",
    timeStyle: "short",
  });
  const alertBlocks = buildOutOfStockAlert(snackName, category, userId, timestamp);
  await postSnackMessage(alertBlocks, `Out of stock: ${snackName}`);

  // Confirm to user
  await slack.chat.postMessage({
    channel: userId,
    text: `✅ Thanks for reporting! *${snackName}* has been reported as out of stock.`,
  });

  return NextResponse.json({ response_action: "clear" });
}

async function handleTokenClick(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string,
  actionId: string
) {
  const session = profileSessions.get(userId);
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  const isDrink = actionId.startsWith("drink_token_");
  const category = actionId.replace(isDrink ? "drink_token_" : "snack_token_", "");
  const allocation = isDrink ? session.drinksAllocation : session.snacksAllocation;

  // Cycle through: 0 -> 10 -> 20 -> ... -> 50 -> 0
  const current = allocation[category] || 0;
  const next = current >= 50 ? 0 : current + TOKENS_PER_CLICK;
  allocation[category] = next;

  // Update session
  if (isDrink) {
    session.drinksAllocation = allocation;
  } else {
    session.snacksAllocation = allocation;
  }
  profileSessions.set(userId, session);

  // Update message
  const message = isDrink
    ? buildProfileStep1Message(userId, session.drinksAllocation)
    : buildProfileStep2Message(session.drinksAllocation, session.snacksAllocation);

  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      ...message,
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleProfileNextSnacks(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string
) {
  const session = profileSessions.get(userId);
  if (!session) return NextResponse.json({ ok: true });

  const total = Object.values(session.drinksAllocation).reduce((a, b) => a + b, 0);
  if (total !== MAX_TOKENS) {
    return NextResponse.json({ ok: true }); // Don't proceed if not exactly 100
  }

  session.step = 2;
  profileSessions.set(userId, session);

  const message = buildProfileStep2Message(session.drinksAllocation, session.snacksAllocation);
  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      ...message,
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleProfileBackDrinks(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string
) {
  const session = profileSessions.get(userId);
  if (!session) return NextResponse.json({ ok: true });

  session.step = 1;
  profileSessions.set(userId, session);

  const message = buildProfileStep1Message(userId, session.drinksAllocation);
  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      ...message,
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleProfileNextFavorites(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string
) {
  const session = profileSessions.get(userId);
  if (!session) return NextResponse.json({ ok: true });

  const total = Object.values(session.snacksAllocation).reduce((a, b) => a + b, 0);
  if (total !== MAX_TOKENS) {
    return NextResponse.json({ ok: true });
  }

  session.step = 3;
  profileSessions.set(userId, session);

  const message = buildProfileStep3Message(
    session.drinksAllocation,
    session.snacksAllocation,
    session.favoriteDrinks,
    session.favoriteSnacks
  );
  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      ...message,
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleProfileBackSnacks(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string
) {
  const session = profileSessions.get(userId);
  if (!session) return NextResponse.json({ ok: true });

  session.step = 2;
  profileSessions.set(userId, session);

  const message = buildProfileStep2Message(session.drinksAllocation, session.snacksAllocation);
  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      ...message,
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleProfileSave(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>,
  userId: string
) {
  const session = profileSessions.get(userId);
  if (!session) return NextResponse.json({ ok: true });

  // Get user info for display name
  const userInfo = await slack.users.info({ user: userId });
  const displayName = userInfo.user?.real_name || userInfo.user?.name || userId;

  // Check if this is a new profile or update
  const existingProfile = await getProfile(userId);
  const isNew = !existingProfile;

  // Save profile
  await upsertProfile({
    userId,
    displayName,
    drinksAllocation: session.drinksAllocation,
    snacksAllocation: session.snacksAllocation,
    favoriteDrinks: session.favoriteDrinks,
    favoriteSnacks: session.favoriteSnacks,
    isPublic: true,
  });

  // Award points
  await awardPoints(userId, isNew ? "profile_create" : "profile_update", displayName);

  // Send confirmation with profile card
  const profileCard = buildProfileCard({
    displayName,
    drinksAllocation: session.drinksAllocation,
    snacksAllocation: session.snacksAllocation,
    favoriteDrinks: session.favoriteDrinks,
    favoriteSnacks: session.favoriteSnacks,
  });

  const channel = (payload.channel as { id: string })?.id || userId;
  const messageTs = (payload.message as { ts: string })?.ts || session.messageTs;

  if (messageTs) {
    await slack.chat.update({
      channel,
      ts: messageTs,
      text: "Profile saved!",
      blocks: profileCard as never[],
    });
  }

  // Clean up session
  profileSessions.delete(userId);

  return NextResponse.json({ ok: true });
}

async function handleSnackSurveyOpenModal(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>
) {
  const responseUrl = payload.response_url as string | undefined;
  const actions = payload.actions as { action_id: string; value?: string }[];
  const weekId = actions[0]?.value;
  const triggerId = payload.trigger_id as string | undefined;

  const fail = async (msg: string, extra?: Record<string, unknown>) => {
    console.error("[snack-survey] open_modal failed:", msg, extra ?? {});
    await postEphemeralToResponseUrl(responseUrl, msg);
    return slackInteractionAck();
  };

  if (!weekId || !triggerId) {
    return fail(
      "Snack survey: missing data from Slack (try the button again). If it persists, check Interactivity → `/api/snacks/events`."
    );
  }

  const clickUser = (payload.user as { id?: string })?.id;
  console.log("[snack-survey] open_modal start", { weekId, user: clickUser });

  const t0 = Date.now();
  let names: string[];
  try {
    // Must stay under Slack’s ~3s budget for trigger_id + views.open (cold sheet read can exceed it).
    names = await getSnackNamesForSurveyWithinSlackDeadline();
    console.log("[snack-survey] names loaded", {
      weekId,
      count: names.length,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return fail(
      "Couldn’t load the snack list (sheet or DB). Check server logs and GOOGLE_SERVICE_ACCOUNT_JSON / sheet share.",
      { err: String(e) }
    );
  }

  if (names.length < 5) {
    return fail(
      `Need at least 5 snack options (found ${names.length}). Check SNACK_SHEET_ID / inventory tab.`
    );
  }

  try {
    const t1 = Date.now();
    const result = await slack.views.open({
      trigger_id: triggerId,
      view: buildSnackTop5ModalView(weekId, names) as never,
    });
    if (!result.ok) {
      const err = (result as { error?: string }).error || "unknown";
      return fail(`Slack refused the modal (\`${err}\`). Often: expired trigger — click the button again within a few seconds.`);
    }
    console.log("[snack-survey] views.open ok", {
      weekId,
      optionsShown: Math.min(100, names.length),
      namesMs: t1 - t0,
      openMs: Date.now() - t1,
      totalMs: Date.now() - t0,
    });
    // Don’t await — Slack needs empty 200 within ~3s; response_url is best-effort follow-up.
    void postEphemeralToResponseUrl(
      responseUrl,
      "✅ *Ballot opened in Slack* — In the window above, search the list, pick *exactly 5* items, then *Submit*. Nothing leaves Slack."
    );
  } catch (e: unknown) {
    const err = e as { data?: { error?: string }; message?: string };
    const detail =
      err?.data?.error || err?.message || String(e);
    console.error("[snack-survey] views.open threw:", detail, e);
    return fail(
      `Couldn’t open the form: ${detail}. Confirm Interactivity URL is HTTPS → \`/api/snacks/events\` for this Slack app.`
    );
  }

  return slackInteractionAck();
}

async function handleSnackTop5Submission(
  payload: Record<string, unknown>,
  slack: ReturnType<typeof getSnackSlackClient>
) {
  const userId = (payload.user as { id: string }).id;
  const view = payload.view as {
    private_metadata: string;
    state: {
      values: Record<
        string,
        Record<string, { selected_options?: { value: string }[] }>
      >;
    };
  };
  let weekId: string;
  try {
    weekId = JSON.parse(view.private_metadata || "{}").weekId;
  } catch {
    return NextResponse.json({
      response_action: "errors",
      errors: { top5_block: "Invalid form — try again" },
    });
  }
  if (!weekId) {
    return NextResponse.json({
      response_action: "errors",
      errors: { top5_block: "Missing week" },
    });
  }

  const selected =
    view.state.values?.top5_block?.top5_select?.selected_options;
  if (!selected || selected.length !== 5) {
    return NextResponse.json({
      response_action: "errors",
      errors: {
        top5_block: "Select exactly 5 snacks (order = your ranking)",
      },
    });
  }

  // Option values are the snack strings from the modal (not list indices), so votes stay
  // valid if the sheet cache refreshes between open and submit.
  const picks = selected.map((o) => o.value);
  if (new Set(picks).size !== 5) {
    return NextResponse.json({
      response_action: "errors",
      errors: { top5_block: "All 5 picks must be different" },
    });
  }

  const { isNewVoter } = await recordSnackTop5Vote(weekId, userId, picks);
  const userInfo = await slack.users.info({ user: userId });
  const displayName = userInfo.user?.real_name || userInfo.user?.name || userId;
  if (isNewVoter) {
    await awardPoints(userId, "weekly_vote", displayName);
  }

  return NextResponse.json({
    response_action: "clear",
  });
}
