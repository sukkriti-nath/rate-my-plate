interface MenuCardProps {
  menu: {
    date: string;
    day_name: string;
    breakfast?: string;
    starch?: string;
    vegan_protein?: string;
    veg?: string;
    protein_1?: string;
    protein_2?: string;
    sauce_sides?: string;
    no_service?: number | boolean;
  };
  compact?: boolean;
}

const DISH_EMOJIS: Record<string, string> = {
  Starch: "🍚",
  "Vegan Protein": "🌱",
  Veg: "🥦",
  "Protein 1": "🍗",
  "Protein 2": "🥩",
  Sides: "🫙",
};

function DietTag({ text }: { text: string }) {
  const tags: string[] = [];
  if (text.includes("(V)")) tags.push("V");
  if (text.includes("(Gf)")) tags.push("GF");
  const cleanName = text.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim();

  return (
    <span className="flex items-center gap-1.5">
      <span>{cleanName}</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            tag === "V"
              ? "bg-kikoff/20 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

export default function MenuCard({ menu, compact = false }: MenuCardProps) {
  if (menu.no_service) {
    return (
      <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 ${compact ? "p-4" : "p-6"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl text-gray-900">{menu.day_name}</h3>
          <span className="text-sm text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
            {formatDate(menu.date)}
          </span>
        </div>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🏖️</div>
          <p className="text-gray-400 italic">No Lunch Service — touch grass!</p>
        </div>
      </div>
    );
  }

  const items = [
    { label: "Starch", value: menu.starch },
    { label: "Vegan Protein", value: menu.vegan_protein },
    { label: "Veg", value: menu.veg },
    { label: "Protein 1", value: menu.protein_1 },
    { label: "Protein 2", value: menu.protein_2 },
    { label: "Sides", value: menu.sauce_sides },
  ].filter((i) => i.value);

  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ${compact ? "p-4" : ""}`}>
      {/* Header with green accent bar */}
      {!compact && (
        <div className="bg-kikoff-dark px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="font-display text-xl text-white">{menu.day_name}&apos;s Menu</h3>
          </div>
          <span className="text-sm text-gray-400 bg-white/10 px-3 py-1 rounded-full">
            {formatDate(menu.date)}
          </span>
        </div>
      )}
      <div className={compact ? "" : "px-6 py-4"}>
        <div className="space-y-2.5">
          {items.map(({ label, value }, i) => (
            <div
              key={label}
              className="flex items-start gap-3 animate-slide-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <span className="text-lg w-7 text-center shrink-0 pt-0.5">
                {DISH_EMOJIS[label] || "🍴"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {label}
                </span>
                <div className="text-gray-800 text-sm font-medium">
                  <DietTag text={value!} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
