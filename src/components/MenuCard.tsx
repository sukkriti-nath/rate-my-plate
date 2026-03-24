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
              ? "bg-green-100 text-green-700"
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
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${compact ? "p-4" : "p-6"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg text-gray-900">{menu.day_name}</h3>
          <span className="text-sm text-gray-500">{formatDate(menu.date)}</span>
        </div>
        <p className="text-gray-400 italic">No Lunch Service</p>
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
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-gray-900">{menu.day_name}</h3>
        <span className="text-sm text-gray-500">{formatDate(menu.date)}</span>
      </div>
      <div className="space-y-2">
        {items.map(({ label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-24 shrink-0 pt-0.5">
              {label}
            </span>
            <span className="text-gray-700 text-sm">
              <DietTag text={value!} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
