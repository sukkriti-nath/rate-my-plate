/** Max upvotes each user can give on *other people's* suggestions (own suggestions excluded). */
export const MAX_UPVOTES_ON_OTHERS_SUGGESTIONS = 3;

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

export function countOthersUpvotes(
  userId: string,
  voteRows: string[][],
  submitterById: Map<string, string>
): number {
  let n = 0;
  for (const row of voteRows) {
    if (!row[0] || !row[1]) continue;
    if (row[1] !== userId || row[2] !== "up") continue;
    const submitter = submitterById.get(String(row[0])) || "";
    if (submitter !== userId) n++;
  }
  return n;
}
