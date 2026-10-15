// Complete mapping of all Tailwind background classes to exact Hex codes
export const TAILWIND_COLOR_MAP: Record<string, string> = {
  // Emerald / Greens
  "bg-emerald-400": "#34d399",
  "bg-emerald-500": "#10b981",
  "bg-emerald-600": "#059669",
  "bg-green-400": "#4ade80",
  "bg-green-500": "#22c55e",
  "bg-green-600": "#16a34a",
  "bg-teal-400": "#2dd4bf",
  "bg-teal-500": "#14b8a6",
  "bg-teal-600": "#0d9488",
  
  // Cyans / Blues / Skys
  "bg-cyan-400": "#22d3ee",
  "bg-cyan-500": "#06b6d4",
  "bg-cyan-600": "#0891b2",
  "bg-sky-400": "#38bdf8",
  "bg-sky-500": "#0ea5e9",
  "bg-sky-600": "#0284c7",
  "bg-blue-400": "#60a5fa",
  "bg-blue-500": "#3b82f6",
  "bg-blue-600": "#2563eb",
  "bg-indigo-400": "#818cf8",
  "bg-indigo-500": "#6366f1",
  "bg-indigo-600": "#4f46e5",

  // Ambers / Oranges / Yellows
  "bg-amber-400": "#fbbf24",
  "bg-amber-500": "#f59e0b",
  "bg-amber-600": "#d97706",
  "bg-orange-400": "#fb923c",
  "bg-orange-500": "#f97316",
  "bg-orange-550": "#ea580c",
  "bg-orange-600": "#ea580c",
  "bg-yellow-400": "#facc15",
  "bg-yellow-500": "#eab308",

  // Reds / Roses / Pinks
  "bg-red-400": "#f87171",
  "bg-red-500": "#ef4444",
  "bg-red-550": "#dc2626",
  "bg-red-600": "#dc2626",
  "bg-rose-400": "#fb7185",
  "bg-rose-500": "#f43f5e",
  "bg-rose-600": "#e11d48",
  "bg-pink-400": "#f472b6",
  "bg-pink-500": "#ec4899",
  "bg-pink-600": "#db2777",

  // Purples / Violets
  "bg-purple-400": "#c084fc",
  "bg-purple-500": "#a855f7",
  "bg-purple-600": "#9333ea",
  "bg-violet-400": "#a78bfa",
  "bg-violet-500": "#8b5cf6",
  "bg-violet-600": "#7c3aed",
  "bg-fuchsia-500": "#d946ef",

  // Grays / Slates / Zincs
  "bg-slate-400": "#94a3b8",
  "bg-slate-500": "#64748b",
  "bg-slate-600": "#475569",
  "bg-zinc-400": "#a1a1aa",
  "bg-zinc-500": "#71717a",
  "bg-zinc-600": "#52525b"
};

// Default category color mappings
export const DEFAULT_CATEGORY_HEX: Record<string, string> = {
  // Entradas
  "Vendas": "#10b981",
  "Salário": "#06b6d4",
  "Serviços": "#6366f1",
  "Aluguéis Ativos": "#0ea5e9",
  "Investimentos": "#14b8a6",
  "Crédito": "#34d399",
  "Outras Receitas": "#94a3b8",

  // Saídas
  "Alimentação": "#f59e0b",
  "Moradia (Aluguel/IPTU)": "#dc2626",
  "Combustível": "#ea580c",
  "Contas de Consumo (Luz/Água)": "#0284c7",
  "Impostos & Tributos (IPTU/IR)": "#9333ea",
  "Financiamento/Carro": "#2563eb",
  "Transporte": "#60a5fa",
  "Saúde": "#f43f5e",
  "Lazer": "#ec4899",
  "Suprimentos": "#fb923c",
  "Serviços Contratados": "#8b5cf6",
  "Outras Despesas": "#71717a"
};

/**
 * Normalizes any color representation (hex with or without #, tailwind class, or category name fallback)
 * to a clean, valid 7-character HEX color code `#rrggbb`.
 */
export function resolveCategoryColorHex(
  colorInput?: string | null,
  categoryName?: string,
  type: "entrada" | "saida" = "saida"
): string {
  const trimmed = (colorInput || "").trim();

  // 1. Direct valid Hex (#rrggbb or #rgb)
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
    if (trimmed.length === 4) {
      // expand #rgb to #rrggbb
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }

  // 2. Hex without '#' (e.g. "10b981" or "f43f5e")
  if (/^([0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
    if (trimmed.length === 3) {
      return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`.toLowerCase();
    }
    return `#${trimmed}`.toLowerCase();
  }

  // 3. Tailwind class mapped
  if (TAILWIND_COLOR_MAP[trimmed]) {
    return TAILWIND_COLOR_MAP[trimmed];
  }

  // 4. Category name matching default dictionary
  if (categoryName && DEFAULT_CATEGORY_HEX[categoryName]) {
    return DEFAULT_CATEGORY_HEX[categoryName];
  }

  // 5. Partial name match
  if (categoryName) {
    const norm = categoryName.toLowerCase();
    if (norm.includes("aluguel") || norm.includes("aluguéis")) return "#0ea5e9";
    if (norm.includes("imposto") || norm.includes("tributo") || norm.includes("iptu")) return "#9333ea";
    if (norm.includes("carro") || norm.includes("veículo") || norm.includes("financiamento")) return "#2563eb";
    if (norm.includes("farmacia") || norm.includes("farmácia") || norm.includes("saúde") || norm.includes("saude") || norm.includes("médic")) return "#f43f5e";
    if (norm.includes("mercado") || norm.includes("alimenta") || norm.includes("comida")) return "#f59e0b";
    if (norm.includes("combust") || norm.includes("gasolina")) return "#ea580c";
    if (norm.includes("luz") || norm.includes("água") || norm.includes("agua") || norm.includes("energia")) return "#0284c7";
    if (norm.includes("venda")) return "#10b981";
    if (norm.includes("salário") || norm.includes("salario")) return "#06b6d4";
    if (norm.includes("lazer") || norm.includes("viagem")) return "#ec4899";
  }

  // 6. Safe fallback based on type
  return type === "entrada" ? "#10b981" : "#f43f5e";
}
