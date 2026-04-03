/** Max upvotes each user can give on *other people's* suggestions per 2-week period (own suggestions excluded). */
export const MAX_UPVOTES_ON_OTHERS_SUGGESTIONS = 5;

/** Period length in milliseconds (2 weeks) */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/** Get the start of the current 2-week period (aligned to a fixed epoch for consistency) */
export function getCurrentPeriodStart(): Date {
  // Use a fixed epoch start date (Jan 1, 2024) and calculate 2-week periods from there
  const epochStart = new Date("2024-01-01T00:00:00Z").getTime();
  const now = Date.now();
  const periodsSinceEpoch = Math.floor((now - epochStart) / TWO_WEEKS_MS);
  return new Date(epochStart + periodsSinceEpoch * TWO_WEEKS_MS);
}

/** Get the end of the current 2-week period */
export function getCurrentPeriodEnd(): Date {
  const start = getCurrentPeriodStart();
  return new Date(start.getTime() + TWO_WEEKS_MS);
}

export function buildSuggestionSubmitterMap(
  suggestionRows: string[][]
): Map<string, string> {
  const m = new Map<string, string>();
  const hasHeader =
    suggestionRows.length > 0 && suggestionRows[0][0] === "id";
  const start = hasHeader ? 1 : 0;
  for (let i = start; i < suggestionRows.length; i++) {
    const id = suggestionRows[i][0];
    if (id) m.set(String(id), String(suggestionRows[i][2] ?? ""));
  }
  return m;
}

/**
 * Count upvotes on others' suggestions within the current 2-week period.
 * Vote rows format: [suggestionId, oderId, voteType, timestamp?]
 */
export function countOthersUpvotes(
  userId: string,
  voteRows: string[][],
  submitterById: Map<string, string>
): number {
  const periodStart = getCurrentPeriodStart().getTime();
  let n = 0;
  for (const row of voteRows) {
    if (!row[0] || !row[1]) continue;
    if (row[1] !== userId || row[2] !== "up") continue;

    // Check if vote is within current 2-week period
    const voteTimestamp = row[3] ? new Date(row[3]).getTime() : 0;
    if (voteTimestamp && voteTimestamp < periodStart) continue;

    const submitter = submitterById.get(String(row[0])) || "";
    if (submitter !== userId) n++;
  }
  return n;
}
