import { useState, useMemo, useEffect } from "react";
import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer as RechartsResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell as RechartsCell,
  LineChart as RechartsLineChart,
  Line as RechartsLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Calendar,
  Layers,
  HelpCircle,
  Activity,
  Filter,
  DollarSign,
  PieChart as LucidePieChart,
  Grid,
  Sparkles,
  ChevronRight,
  Info,
  Clock,
  ChevronDown,
  AlertTriangle,
  Bell,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Transaction {
  id: string;
  caixaId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
}

interface RentalProperty {
  id: string;
  caixaId: string;
  lfCode: string;
  tenantName: string;
  address: string;
  dueDay: number;
  rentAmount: number;
  waterAmount: number;
  iptuAmount: number;
  garbageAmount: number;
  lightAmount: number;
  fineAmount: number;
  adminFeeAmount: number;
  paidPeriods: string[];
  paymentDates?: Record<string, string>;
}

interface LeadpageDashboardProps {
  transactions: Transaction[];
  activeCaixaId: string;
  activeCaixaName: string;
  monthsList: { value: string; label: string }[];
  filterYear: string;
  filterMonth: string;
  rentals?: RentalProperty[];
}

// Color mapping for category charts
const CATEGORY_HEX_COLORS: { [key: string]: string } = {
  "Vendas": "#10b981",          // emerald-500
  "Salário": "#06b6d4",         // cyan-500
  "Serviços": "#6366f1",        // indigo-500
  "Aluguéis Ativos": "#0ea5e9", // sky-500
  "Investimentos": "#14b8a6",   // teal-500
  "Crédito": "#34d399",         // emerald-400
  "Outras Receitas": "#94a3b8",  // slate-400
  
  "Alimentação": "#f59e0b",                  // amber-500
  "Moradia (Aluguel/IPTU)": "#ef4444",       // red-500
  "Combustível": "#f97316",                  // orange-500
  "Contas de Consumo (Luz/Água)": "#0284c7", // sky-600
  "Impostos & Tributos (IPTU/IR)": "#a855f7",// purple-500/600
  "Financiamento/Carro": "#2563eb",          // blue-600
  "Transporte": "#60a5fa",                   // blue-400
  "Saúde": "#f43f5e",                        // rose-500
  "Lazer": "#ec4899",                        // pink-500
  "Suprimentos": "#fb923c",                  // orange-400
  "Serviços Contratados": "#8b5cf6",         // violet-500
  "Outras Despesas": "#71717a"                // zinc-500
};

const CATEGORIES_ENTRADA = ["Vendas", "Salário", "Serviços", "Aluguéis Ativos", "Investimentos", "Crédito", "Outras Receitas"];
const CATEGORIES_SAIDA = [
  "Alimentação", 
  "Moradia (Aluguel/IPTU)", 
  "Combustível", 
  "Contas de Consumo (Luz/Água)", 
  "Impostos & Tributos (IPTU/IR)", 
  "Financiamento/Carro", 
  "Transporte", 
  "Saúde", 
  "Lazer", 
  "Suprimentos", 
  "Serviços Contratados", 
  "Outras Despesas"
];

export function LeadpageDashboard({
  transactions,
  activeCaixaId,
  activeCaixaName,
  monthsList,
  filterYear,
  filterMonth,
  rentals = []
}: LeadpageDashboardProps) {
  // Local toggles for view preference
  const [caixaFilter, setCaixaFilter] = useState<"active" | "all">("active");
  const [periodScope, setPeriodScope] = useState<"filtered" | "all">("all");
  const [showPrevMonthComparison, setShowPrevMonthComparison] = useState<boolean>(true);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"saida" | "entrada">("saida");



  // --- TEMPORAL CASH FLOW STATES AND CALCULATIONS ---
  const [timeframe, setTimeframe] = useState<"anual" | "mensal" | "semanal" | "diario">("anual");
  
  const [selectedYr, setSelectedYr] = useState<number>(() => {
    const yr = filterYear && filterYear !== "todos" ? parseInt(filterYear) : new Date().getFullYear();
    return isNaN(yr) ? new Date().getFullYear() : yr;
  });
  
  const [selectedMth, setSelectedMth] = useState<string>(() => {
    return filterMonth && filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0");
  });

  const [activeDailyDetail, setActiveDailyDetail] = useState<number | null>(null);

  // States to monitor hover on annual month items
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [monthlyChartTab, setMonthlyChartTab] = useState<"saida" | "entrada">("saida");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Keep synced with parent filters
  useEffect(() => {
    if (filterYear && filterYear !== "todos") {
      const yr = parseInt(filterYear);
      if (!isNaN(yr)) setSelectedYr(yr);
    }
  }, [filterYear]);

  useEffect(() => {
    if (filterMonth && filterMonth !== "todos") {
      setSelectedMth(filterMonth);
    }
  }, [filterMonth]);

  const timelineTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      return true;
    });
  }, [transactions, activeCaixaId, caixaFilter]);

  // Hovered month detailed categories & mini chart data
  const hoveredMonthDataEx = useMemo(() => {
    if (!hoveredMonth) return null;
    const periodStr = `${selectedYr}-${hoveredMonth}`;
    const txs = timelineTransactions.filter(t => t.date.startsWith(periodStr));

    const categoriesMap: Record<string, { name: string; type: "entrada" | "saida"; amount: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    txs.forEach(t => {
      const catKey = `${t.category}__${t.type}`;
      if (!categoriesMap[catKey]) {
        categoriesMap[catKey] = { name: t.category, type: t.type, amount: 0 };
      }
      categoriesMap[catKey].amount += t.amount;
      if (t.type === "entrada") totalIn += t.amount;
      else totalOut += t.amount;
    });

    const categoriesList = Object.values(categoriesMap).sort((a, b) => b.amount - a.amount);
    const entries = categoriesList.filter(c => c.type === "entrada");
    const exits = categoriesList.filter(c => c.type === "saida");

    // Top 5 entries and exits consolidated into data for mini chart
    const chartData = categoriesList.slice(0, 5).map(c => ({
      name: c.name.length > 12 ? c.name.slice(0, 10) + "..." : c.name,
      fullName: c.name,
      valor: c.amount,
      type: c.type,
      color: c.type === "entrada" ? "#10b981" : "#f43f5e"
    }));

    return {
      monthLabel: monthsList.find(m => m.value === hoveredMonth)?.label || hoveredMonth,
      totalIn,
      totalOut,
      saldo: totalIn - totalOut,
      categoriesList,
      entries,
      exits,
      chartData,
      count: txs.length
    };
  }, [timelineTransactions, selectedYr, hoveredMonth, monthsList]);

  // Year choices based on existing data to let them choose
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([new Date().getFullYear()]);
    transactions.forEach(t => {
      if (t.date && t.date.length >= 4) {
        const yr = parseInt(t.date.substring(0, 4));
        if (!isNaN(yr)) yearsSet.add(yr);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // 1. CAIXA ANUAL CALCULATIONS
  const annualAggregation = useMemo(() => {
    const yrTxs = timelineTransactions.filter(t => t.date.startsWith(String(selectedYr)));
    
    const monthlySum = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, "0");
      const labelShort = monthsList.find(m => m.value === monthNum)?.label || monthNum;
      return {
        monthNum,
        label: labelShort.slice(0, 3),
        fullLabel: labelShort,
        entrada: 0,
        saida: 0,
        saldo: 0
      };
    });

    let totalEntrada = 0;
    let totalSaida = 0;

    yrTxs.forEach(t => {
      const parts = t.date.split("-");
      if (parts.length >= 2) {
        const mIndex = parseInt(parts[1]) - 1;
        if (mIndex >= 0 && mIndex < 12) {
          if (t.type === "entrada") {
            monthlySum[mIndex].entrada += t.amount;
            totalEntrada += t.amount;
          } else {
            monthlySum[mIndex].saida += t.amount;
            totalSaida += t.amount;
          }
        }
      }
    });

    monthlySum.forEach(item => {
      item.saldo = item.entrada - item.saida;
    });

    const totalSaldo = totalEntrada - totalSaida;
    const efficiency = totalEntrada > 0 ? (totalSaldo / totalEntrada) * 100 : 0;

    return { monthlySum, totalEntrada, totalSaida, totalSaldo, efficiency };
  }, [timelineTransactions, selectedYr, monthsList]);

  // 2. CAIXA MENSAL CALCULATIONS
  const monthlyAggregation = useMemo(() => {
    const periodStr = `${selectedYr}-${selectedMth}`;
    const mthTxs = timelineTransactions.filter(t => t.date.startsWith(periodStr));

    let totalEntrada = 0;
    let totalSaida = 0;

    mthTxs.forEach(t => {
      if (t.type === "entrada") totalEntrada += t.amount;
      else totalSaida += t.amount;
    });

    const totalSaldo = totalEntrada - totalSaida;
    const efficiency = totalEntrada > 0 ? (totalSaldo / totalEntrada) * 100 : 0;

    const categoryBreakdown = mthTxs.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { name: t.category, entrada: 0, saida: 0, type: t.type };
      }
      if (t.type === "entrada") acc[t.category].entrada += t.amount;
      else acc[t.category].saida += t.amount;
      return acc;
    }, {} as Record<string, { name: string; entrada: number; saida: number; type: "entrada" | "saida" }>);

    const sortedCategories = (Object.values(categoryBreakdown) as Array<{
      name: string;
      entrada: number;
      saida: number;
      type: "entrada" | "saida";
    }>).sort((a, b) => (b.entrada + b.saida) - (a.entrada + a.saida));

    return { totalEntrada, totalSaida, totalSaldo, efficiency, count: mthTxs.length, sortedCategories };
  }, [timelineTransactions, selectedYr, selectedMth]);

  // 3. CAIXA SEMANAL CALCULATIONS
  const weeklyAggregation = useMemo(() => {
    const periodStr = `${selectedYr}-${selectedMth}`;
    const mthTxs = timelineTransactions.filter(t => t.date.startsWith(periodStr));

    const weeks = [
      { id: "W1", label: "Semana 1", days: "01 a 07", entrada: 0, saida: 0, saldo: 0, txsCount: 0 },
      { id: "W2", label: "Semana 2", days: "08 a 14", entrada: 0, saida: 0, saldo: 0, txsCount: 0 },
      { id: "W3", label: "Semana 3", days: "15 a 21", entrada: 0, saida: 0, saldo: 0, txsCount: 0 },
      { id: "W4", label: "Semana 4", days: "22 a 28", entrada: 0, saida: 0, saldo: 0, txsCount: 0 },
      { id: "W5", label: "Semana 5", days: "29 em diante", entrada: 0, saida: 0, saldo: 0, txsCount: 0 },
    ];

    mthTxs.forEach(t => {
      const parts = t.date.split("-");
      if (parts.length >= 3) {
        const day = parseInt(parts[2]);
        let weekIdx = 0;
        if (day >= 1 && day <= 7) weekIdx = 0;
        else if (day >= 8 && day <= 14) weekIdx = 1;
        else if (day >= 15 && day <= 21) weekIdx = 2;
        else if (day >= 22 && day <= 28) weekIdx = 3;
        else weekIdx = 4;

        if (t.type === "entrada") {
          weeks[weekIdx].entrada += t.amount;
        } else {
          weeks[weekIdx].saida += t.amount;
        }
        weeks[weekIdx].txsCount += 1;
      }
    });

    weeks.forEach(w => {
      w.saldo = w.entrada - w.saida;
    });

    return weeks;
  }, [timelineTransactions, selectedYr, selectedMth]);

  // 4. CAIXA DIÁRIO CALCULATIONS
  const dailyAggregation = useMemo(() => {
    const periodStr = `${selectedYr}-${selectedMth}`;
    const mthTxs = timelineTransactions.filter(t => t.date.startsWith(periodStr));

    const yearNum = parseInt(String(selectedYr));
    const monthNum = parseInt(selectedMth);
    const numDays = new Date(yearNum, monthNum, 0).getDate();

    const daysMap: Record<number, { day: number; dateStr: string; entrada: number; saida: number; saldo: number; txs: Transaction[] }> = {};
    for (let d = 1; d <= numDays; d++) {
      const dayStr = String(d).padStart(2, "0");
      daysMap[d] = {
        day: d,
        dateStr: `${periodStr}-${dayStr}`,
        entrada: 0,
        saida: 0,
        saldo: 0,
        txs: []
      };
    }

    mthTxs.forEach(t => {
      const parts = t.date.split("-");
      if (parts.length >= 3) {
        const day = parseInt(parts[2]);
        if (daysMap[day]) {
          if (t.type === "entrada") {
            daysMap[day].entrada += t.amount;
          } else {
            daysMap[day].saida += t.amount;
          }
          daysMap[day].txs.push(t);
        }
      }
    });

    let cumulative = 0;
    const dailyList = Object.values(daysMap).map(d => {
      const net = d.entrada - d.saida;
      cumulative += net;
      return {
        ...d,
        saldo: net,
        cumulative: cumulative
      };
    });

    const activeDays = dailyList.filter(d => d.txs.length > 0);

    return { dailyList, activeDays };
  }, [timelineTransactions, selectedYr, selectedMth]);

  // Hovered day detailed categories inside the month
  const hoveredDayDataEx = useMemo(() => {
    if (hoveredDay === null) return null;
    const dayObj = dailyAggregation.dailyList.find(d => d.day === hoveredDay);
    if (!dayObj || dayObj.txs.length === 0) return null;

    const categoriesMap: Record<string, { name: string; type: "entrada" | "saida"; amount: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    dayObj.txs.forEach(t => {
      const catKey = `${t.category}__${t.type}`;
      if (!categoriesMap[catKey]) {
        categoriesMap[catKey] = { name: t.category, type: t.type, amount: 0 };
      }
      categoriesMap[catKey].amount += t.amount;
      if (t.type === "entrada") totalIn += t.amount;
      else totalOut += t.amount;
    });

    const categoriesList = Object.values(categoriesMap).sort((a, b) => b.amount - a.amount);
    const entries = categoriesList.filter(c => c.type === "entrada");
    const exits = categoriesList.filter(c => c.type === "saida");

    // Top 5 entries and exits consolidated into data for mini chart
    const chartData = categoriesList.slice(0, 5).map(c => ({
      name: c.name.length > 12 ? c.name.slice(0, 10) + "..." : c.name,
      fullName: c.name,
      valor: c.amount,
      type: c.type,
      color: c.type === "entrada" ? "#10b981" : "#f43f5e"
    }));

    return {
      day: hoveredDay,
      totalIn,
      totalOut,
      saldo: totalIn - totalOut,
      categoriesList,
      entries,
      exits,
      chartData,
      count: dayObj.txs.length
    };
  }, [dailyAggregation.dailyList, hoveredDay]);

  // Pick month label helper
  const getSelectedMonthLabel = () => {
    const found = monthsList.find(m => m.value === selectedMth);
    return found ? found.label : selectedMth;
  };

  // Custom tooltips inside recharts that display polished money information
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isComparison = payload[0]?.payload && "PrevTotal" in payload[0].payload;
      const rawData = payload[0]?.payload;

      return (
        <div className="bg-white text-slate-800 p-3.5 rounded-2xl shadow-xl border border-slate-150 text-xs font-sans leading-relaxed backdrop-blur-md">
          <p className="font-extrabold border-b border-slate-100 pb-1 mb-1.5 uppercase text-[9.5px] tracking-widest text-indigo-600">
            {label}
          </p>
          <div className="space-y-1 font-mono text-xs">
            {payload.map((item: any, idx: number) => {
              const baseColor = item.color || item.fill;
              const safeColor = (baseColor === "#ffffff" || baseColor === "#fff" || !baseColor) ? "#4f46e5" : baseColor;
              return (
                <div key={idx} className="flex justify-between items-center gap-6">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: safeColor }}></span>
                    <span className="text-slate-450 font-bold font-sans">{item.name}:</span>
                  </span>
                  <span className="font-black" style={{ color: safeColor }}>
                    {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              );
            })}

            {isComparison && showPrevMonthComparison && periodScope === "filtered" && rawData && (() => {
              const isSaidaTab = activeCategoryTab === "saida";
              const diff = rawData.Total - rawData.PrevTotal;
              // Para despesas (saida), menor é melhor (verde se reduziu, vermelho se aumentou).
              // Para receitas (entrada), maior é melhor (verde se aumentou, vermelho se reduziu).
              const isGood = isSaidaTab ? (diff < 0) : (diff > 0);
              const isNeutral = diff === 0;
              const colorClass = isNeutral ? "text-slate-500" : isGood ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold";

              return (
                <div className="border-t border-slate-100 pt-1.5 mt-1.5 text-[10px] text-slate-550 leading-normal font-sans">
                  <div className="flex justify-between gap-4">
                    <span>Diferença mensal:</span>
                    <span className={`font-bold ${colorClass}`}>
                      {diff > 0 ? "+" : ""}{diff.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Variação:</span>
                    <span className={`font-bold ${colorClass}`}>
                      {rawData.pctChange >= 0 ? "+" : ""}{rawData.pctChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      );
    }
    return null;
  };

  // Process data chronologically by month
  const monthlyData = useMemo(() => {
    const filteredT = transactions.filter(t => {
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      return true;
    });

    const monthsMap: { [key: string]: { entrada: number; saida: number } } = {};

    filteredT.forEach(t => {
      if (!t.date) return;
      const period = t.date.substring(0, 7); // "YYYY-MM"
      if (!monthsMap[period]) {
        monthsMap[period] = { entrada: 0, saida: 0 };
      }
      if (t.type === "entrada") {
        monthsMap[period].entrada += t.amount;
      } else {
        monthsMap[period].saida += t.amount;
      }
    });

    const sortedPeriods = Object.keys(monthsMap).sort();

    return sortedPeriods.map(period => {
      const [year, monthNum] = period.split("-");
      const monthObj = monthsList.find(m => m.value === monthNum);
      const shortLabel = monthObj ? `${monthObj.label.slice(0, 3)}/${year.slice(2)}` : period;
      const fullLabel = monthObj ? `${monthObj.label} de ${year}` : period;
      
      const dataObj = monthsMap[period];
      return {
        period,
        label: shortLabel,
        fullLabel,
        "Receitas (Inflow)": dataObj.entrada,
        "Despesas (Outflow)": dataObj.saida,
        "Saldo Líquido": dataObj.entrada - dataObj.saida
      };
    });
  }, [transactions, activeCaixaId, caixaFilter, monthsList]);

  // Process categories data (including all categories with comparison)
  const categoryChartData = useMemo(() => {
    let refYear = new Date().getFullYear();
    let refMonth = new Date().getMonth() + 1; // 1-12

    if (filterYear !== "todos" && filterMonth !== "todos") {
      refYear = parseInt(filterYear);
      refMonth = parseInt(filterMonth);
    } else {
      const filteredT = transactions.filter(t => {
        if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
        return true;
      });
      if (filteredT.length > 0) {
        const sorted = [...filteredT].sort((a, b) => b.date.localeCompare(a.date));
        const latestDate = sorted[0].date;
        if (latestDate && latestDate.length >= 7) {
          const parts = latestDate.split("-");
          refYear = parseInt(parts[0]);
          refMonth = parseInt(parts[1]);
        }
      }
    }

    let prevYear = refYear;
    let prevMonth = refMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = refYear - 1;
    }

    const prevPeriodStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const currentScopeTxs = transactions.filter(t => {
      // Caixa filter
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      
      // Period filter
      if (periodScope === "filtered") {
        if (filterMonth !== "todos") {
          const m = t.date.split("-")[1];
          if (m !== filterMonth) return false;
        }
        if (filterYear !== "todos") {
          const y = t.date.split("-")[0];
          if (y !== filterYear) return false;
        }
      }
      return true;
    });

    const prevScopeTxs = periodScope === "filtered" ? transactions.filter(t => {
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      if (!t.date || t.date.length < 7) return false;
      return t.date.substring(0, 7) === prevPeriodStr;
    }) : [];

    // Accumulators
    const entradaMap = new Map<string, number>(CATEGORIES_ENTRADA.map(cat => [cat, 0]));
    const saidaMap = new Map<string, number>(CATEGORIES_SAIDA.map(cat => [cat, 0]));

    const prevEntradaMap = new Map<string, number>(CATEGORIES_ENTRADA.map(cat => [cat, 0]));
    const prevSaidaMap = new Map<string, number>(CATEGORIES_SAIDA.map(cat => [cat, 0]));

    currentScopeTxs.forEach(t => {
      if (t.type === "entrada") {
        entradaMap.set(t.category, (entradaMap.get(t.category) || 0) + t.amount);
      } else if (t.type === "saida") {
        saidaMap.set(t.category, (saidaMap.get(t.category) || 0) + t.amount);
      }
    });

    prevScopeTxs.forEach(t => {
      if (t.type === "entrada") {
        prevEntradaMap.set(t.category, (prevEntradaMap.get(t.category) || 0) + t.amount);
      } else if (t.type === "saida") {
        prevSaidaMap.set(t.category, (prevSaidaMap.get(t.category) || 0) + t.amount);
      }
    });

    // Generate complete arrays
    let entradas = CATEGORIES_ENTRADA.map(cat => {
      const total = entradaMap.get(cat) || 0;
      const prevTotal = prevEntradaMap.get(cat) || 0;
      const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? 100 : 0;
      return {
        name: cat,
        "Total": total,
        "PrevTotal": prevTotal,
        "pctChange": pctChange,
        fill: CATEGORY_HEX_COLORS[cat] || "#94a3b8"
      };
    });

    let saidas = CATEGORIES_SAIDA.map(cat => {
      const total = saidaMap.get(cat) || 0;
      const prevTotal = prevSaidaMap.get(cat) || 0;
      const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? 100 : 0;
      return {
        name: cat,
        "Total": total,
        "PrevTotal": prevTotal,
        "pctChange": pctChange,
        fill: CATEGORY_HEX_COLORS[cat] || "#f43f5e"
      };
    });

    // Filter out categories without any launch (0 in current and 0 in previous)
    entradas = entradas.filter(e => e["Total"] > 0 || e["PrevTotal"] > 0);
    saidas = saidas.filter(s => s["Total"] > 0 || s["PrevTotal"] > 0);

    // Sort by highest amount first for beautiful presentation
    entradas.sort((a, b) => b["Total"] - a["Total"]);
    saidas.sort((a, b) => b["Total"] - a["Total"]);

    return { entradas, saidas };
  }, [transactions, activeCaixaId, caixaFilter, periodScope, filterMonth, filterYear]);

  // Overall statistics for the selected scope
  const leadStats = useMemo(() => {
    const filteredT = transactions.filter(t => {
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      return true;
    });

    let totalEntradas = 0;
    let totalSaidas = 0;
    filteredT.forEach(t => {
      if (t.type === "entrada") totalEntradas += t.amount;
      else totalSaidas += t.amount;
    });

    const netBalance = totalEntradas - totalSaidas;
    const efficiency = totalEntradas > 0 ? ((totalEntradas - totalSaidas) / totalEntradas) * 100 : 0;

    return {
      totalEntradas,
      totalSaidas,
      netBalance,
      efficiency,
      count: filteredT.length
    };
  }, [transactions, activeCaixaId, caixaFilter]);

  // Calculation of active month vs previous month stats for comparison
  const comparisonStats = useMemo(() => {
    let refYear = new Date().getFullYear();
    let refMonth = new Date().getMonth() + 1; // 1-12

    if (filterYear !== "todos" && filterMonth !== "todos") {
      refYear = parseInt(filterYear);
      refMonth = parseInt(filterMonth);
    } else {
      const filteredT = transactions.filter(t => {
        if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
        return true;
      });
      if (filteredT.length > 0) {
        const sorted = [...filteredT].sort((a, b) => b.date.localeCompare(a.date));
        const latestDate = sorted[0].date;
        if (latestDate && latestDate.length >= 7) {
          const parts = latestDate.split("-");
          refYear = parseInt(parts[0]);
          refMonth = parseInt(parts[1]);
        }
      }
    }

    let prevYear = refYear;
    let prevMonth = refMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = refYear - 1;
    }

    const refPeriodStr = `${refYear}-${String(refMonth).padStart(2, "0")}`;
    const prevPeriodStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const txsInScope = transactions.filter(t => {
      if (caixaFilter === "active" && t.caixaId !== activeCaixaId) return false;
      return true;
    });

    let refEntradas = 0;
    let refSaidas = 0;
    let prevEntradas = 0;
    let prevSaidas = 0;

    txsInScope.forEach(t => {
      if (!t.date || t.date.length < 7) return;
      const tPeriod = t.date.substring(0, 7);
      if (tPeriod === refPeriodStr) {
        if (t.type === "entrada") refEntradas += t.amount;
        else refSaidas += t.amount;
      } else if (tPeriod === prevPeriodStr) {
        if (t.type === "entrada") prevEntradas += t.amount;
        else prevSaidas += t.amount;
      }
    });

    const refBalance = refEntradas - refSaidas;
    const prevBalance = prevEntradas - prevSaidas;

    const refEfficiency = refEntradas > 0 ? (refBalance / refEntradas) * 100 : 0;
    const prevEfficiency = prevEntradas > 0 ? (prevBalance / prevEntradas) * 150 : 0; // Avoid scale bugs

    const calcPercentageChange = (current: number, previous: number) => {
      if (previous === 0) {
        if (current === 0) return 0;
        return current > 0 ? 100 : -100;
      }
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    const percentageChanges = {
      entradas: calcPercentageChange(refEntradas, prevEntradas),
      saidas: calcPercentageChange(refSaidas, prevSaidas),
      balance: calcPercentageChange(refBalance, prevBalance),
      efficiency: refEfficiency - prevEfficiency
    };

    const monthObjRef = monthsList.find(m => parseInt(m.value) === refMonth);
    const monthObjPrev = monthsList.find(m => parseInt(m.value) === prevMonth);

    return {
      refYear,
      refMonth,
      refLabel: monthObjRef ? `${monthObjRef.label.slice(0, 3)}/${String(refYear).slice(2)}` : refPeriodStr,
      prevLabel: monthObjPrev ? `${monthObjPrev.label.slice(0, 3)}/${String(prevYear).slice(2)}` : prevPeriodStr,
      refEntradas,
      prevEntradas,
      refSaidas,
      prevSaidas,
      refBalance,
      prevBalance,
      refEfficiency,
      prevEfficiency: refEntradas > 0 ? (prevBalance / refEntradas) * 100 : 0, // normalized or true diff
      percentageChanges
    };
  }, [transactions, activeCaixaId, caixaFilter, filterYear, filterMonth, monthsList]);

  const activeMonthLabel = useMemo(() => {
    const monthObj = monthsList.find(m => m.value === filterMonth);
    return monthObj ? `${monthObj.label}/${filterYear}` : filterYear;
  }, [monthsList, filterMonth, filterYear]);



  return (
    <div className="mt-14 pt-8 border-t border-slate-200 select-none pb-8" id="leadpage-advanced-dashboard">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <Activity size={18} className="animate-pulse" />
            </span>
            <h2 className="text-lg font-black tracking-tight text-slate-800">
              Painel Geral de Indicadores & Gráficos
            </h2>
          </div>
          <p className="text-xs text-slate-450 leading-normal max-w-2xl">
            Visão consolidada de todas as competências. Analise o fluxo de caixa histórico e a distribuição entre todas as categorias registradas em tempo real.
          </p>
        </div>

        {/* Dashboard Configuration Controls */}
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start border border-slate-200/50">
          <button
            onClick={() => setCaixaFilter("active")}
            className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
              caixaFilter === "active"
                ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Caixa: {activeCaixaName}
          </button>
          <button
            onClick={() => setCaixaFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
              caixaFilter === "all"
                ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Todos os Caixas
          </button>
        </div>
      </div>



      {/* QUICK METRIC STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Card 1: Receita Acumulada */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Receita Acumulada</span>
              <h4 className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                R$ {leadStats.totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Todo histórico filtrado</p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl flex-shrink-0">
              <TrendingUp size={20} />
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] w-full gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Ref: {comparisonStats.refLabel}</span>
              <span className="font-bold text-slate-700 font-mono text-[11px] truncate">R$ {comparisonStats.refEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col items-end min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Anter: {comparisonStats.prevLabel}</span>
              <span className="font-bold text-slate-600 font-mono text-[11px] truncate flex items-center gap-1">
                R$ {comparisonStats.prevEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className={`text-[10px] font-black ${comparisonStats.percentageChanges.entradas >= 0 ? "text-emerald-600" : "text-rose-600"}`} title="Variação mensal">
                  ({comparisonStats.percentageChanges.entradas >= 0 ? "+" : ""}{comparisonStats.percentageChanges.entradas.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Despesas */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Despesas</span>
              <h4 className="text-xl font-bold text-rose-600 mt-1 font-mono">
                R$ {leadStats.totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Todo histórico filtrado</p>
            </div>
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl flex-shrink-0">
              <TrendingDown size={20} />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] w-full gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Ref: {comparisonStats.refLabel}</span>
              <span className="font-bold text-slate-700 font-mono text-[11px] truncate">R$ {comparisonStats.refSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col items-end min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Anter: {comparisonStats.prevLabel}</span>
              <span className="font-bold text-slate-600 font-mono text-[11px] truncate flex items-center gap-1">
                R$ {comparisonStats.prevSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className={`text-[10px] font-black ${comparisonStats.percentageChanges.saidas <= 0 ? "text-emerald-600" : "text-rose-600"}`} title="Variação despesa">
                  ({comparisonStats.percentageChanges.saidas >= 0 ? "+" : ""}{comparisonStats.percentageChanges.saidas.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Saldo Histórico */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Histórico</span>
              <h4 className={`text-xl font-bold mt-1 font-mono ${leadStats.netBalance >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                R$ {leadStats.netBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Superávit acumulado</p>
            </div>
            <div className={`p-3.5 rounded-xl flex-shrink-0 ${leadStats.netBalance >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-red-50 text-red-650"}`}>
              <DollarSign size={20} />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] w-full gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Ref: {comparisonStats.refLabel}</span>
              <span className={`font-bold font-mono text-[11px] truncate ${comparisonStats.refBalance >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                R$ {comparisonStats.refBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col items-end min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Anter: {comparisonStats.prevLabel}</span>
              <span className="font-bold text-slate-600 font-mono text-[11px] truncate flex items-center gap-1">
                R$ {comparisonStats.prevBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className={`text-[10px] font-black ${comparisonStats.percentageChanges.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`} title="Variação saldo">
                  ({comparisonStats.percentageChanges.balance >= 0 ? "+" : ""}{comparisonStats.percentageChanges.balance.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Margem operacional */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Margem operacional</span>
              <h4 className="text-xl font-extrabold text-slate-800 mt-1 font-mono">
                {leadStats.efficiency.toFixed(1)}%
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Taxa de retenção</p>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
              <Activity size={20} />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] w-full gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Ref: {comparisonStats.refLabel}</span>
              <span className="font-bold text-slate-700 font-mono text-[11px] truncate">
                {comparisonStats.refEntradas > 0 ? ((comparisonStats.refBalance / comparisonStats.refEntradas) * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
            <div className="flex flex-col items-end min-w-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold truncate leading-tight">Anter: {comparisonStats.prevLabel}</span>
              <span className="font-bold text-slate-600 font-mono text-[11px] truncate flex items-center gap-1">
                {comparisonStats.prevEntradas > 0 ? ((comparisonStats.prevBalance / comparisonStats.prevEntradas) * 100).toFixed(1) : "0.0"}%
                {(() => {
                  const currEff = comparisonStats.refEntradas > 0 ? (comparisonStats.refBalance / comparisonStats.refEntradas) * 100 : 0;
                  const prevEff = comparisonStats.prevEntradas > 0 ? (comparisonStats.prevBalance / comparisonStats.prevEntradas) * 100 : 0;
                  const diff = currEff - prevEff;
                  return (
                    <span className={`text-[10px] font-black ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`} title="Diferença de margem em pontos percentuais">
                      ({diff >= 0 ? "+" : ""}{diff.toFixed(1)} pp)
                    </span>
                  );
                })()}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* DETAILED CHARTS SECTION ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT CARD: COMPARATIVO MENSAL (ENTRADAS VS SAIDAS) */}
        <div className="lg:col-span-12 xl:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-50 text-slate-500 rounded-lg">
                  <Calendar size={15} />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Comparativo Mensal Histórico</h3>
                  <p className="text-[11px] text-slate-400 leading-normal">Receitas vs Despesas organizadas por mês de competência</p>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center gap-2 border bg-slate-50/50 px-2.5 py-1.5 rounded-lg border-slate-150 select-none">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
                  Receitas
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-rose-500 rounded-sm"></span>
                  Despesas
                </span>
              </div>
            </div>

            {/* CHART VIEW */}
            <div className="h-72 w-full text-xs font-mono select-none">
              {monthlyData.length > 0 ? (
                <RechartsResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                  >
                    <RechartsCartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <RechartsXAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsYAxis
                      stroke="#94a3b8"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.6 }} />
                    <RechartsBar name="Receitas" dataKey="Receitas (Inflow)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                    <RechartsBar name="Despesas" dataKey="Despesas (Outflow)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                  </RechartsBarChart>
                </RechartsResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2 select-none">
                  <HelpCircle size={24} className="stroke-1 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-650">Aguardando dados de transações</span>
                  <p className="text-[10px] max-w-xs leading-relaxed text-slate-400">Insira algumas movimentações de receitas ou despesas com as respectivas datas para construir o gráfico comparativo.</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3.5 mt-3 text-[11px] text-slate-450 italic flex items-center gap-1 select-none">
            <Info size={11.5} className="text-slate-350" />
            <span>Passe o mouse por cima das colunas para conferir o saldo e valores específicos de cada mês.</span>
          </div>
        </div>

        {/* RIGHT CARD: CATEGORIES EXPENDITURE BREAKDOWN (ALL CATEGORIES) */}
        <div className="lg:col-span-12 xl:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Layers size={15} />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Distribuição por Categoria</h3>
                  <p className="text-[11px] text-slate-450">Listagem de todas as categorias cadastradas</p>
                </div>
              </div>
            </div>

            {/* CATEGORY CONTROLS */}
            <div className="flex items-center justify-between gap-1 mb-4">
              {/* Income/Expense Tab Switcher */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold border border-slate-150">
                <button
                  onClick={() => setActiveCategoryTab("saida")}
                  className={`px-3 py-1 rounded-md transition duration-150 cursor-pointer ${
                    activeCategoryTab === "saida"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Despesas (Todas)
                </button>
                <button
                  onClick={() => setActiveCategoryTab("entrada")}
                  className={`px-3 py-1 rounded-md transition duration-150 cursor-pointer ${
                    activeCategoryTab === "entrada"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Receitas
                </button>
              </div>

              {/* Scope filter: Selected month vs All history */}
              <div className="flex bg-slate-50 border border-slate-200/50 rounded-lg text-[11px] font-semibold select-none">
                <button
                  onClick={() => setPeriodScope("filtered")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    periodScope === "filtered"
                      ? "bg-blue-600/10 text-blue-700 font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title={`Exibir dados limitados ao mês ${filterMonth !== "todos" ? activeMonthLabel : "selecionado"}`}
                >
                  Mês Ativo
                </button>
                <button
                  onClick={() => setPeriodScope("all")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    periodScope === "all"
                      ? "bg-blue-600/10 text-blue-700 font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Analisar faturamento integral através de todas as datas registradas"
                >
                  Tudo
                </button>
              </div>
            </div>

            {/* Previous Month comparison toggle */}
            <div className="flex items-center justify-between text-[11px] mb-3 select-none">
              <span className="text-slate-450 text-[10.5px]">Comparar com o mês anterior:</span>
              <button
                type="button"
                onClick={() => setShowPrevMonthComparison(!showPrevMonthComparison)}
                className={`px-2.5 py-1 rounded-md border font-extrabold h-6 flex items-center justify-center transition cursor-pointer select-none leading-none text-[10.5px] ${
                  !showPrevMonthComparison 
                    ? "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700" 
                    : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/30"
                }`}
              >
                {showPrevMonthComparison ? "Sim (Exibir)" : "Não (Ocultar)"}
              </button>
            </div>

            {/* BAR CHART VIEW */}
            <div className="h-64 w-full text-xs font-mono select-none">
              {(activeCategoryTab === "saida" ? categoryChartData.saidas.length : categoryChartData.entradas.length) > 0 ? (
                <RechartsResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={activeCategoryTab === "saida" ? categoryChartData.saidas : categoryChartData.entradas}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
                  >
                    <RechartsCartesianGrid strokeDasharray="2 2" stroke="#f8fafc" horizontal={false} />
                    <RechartsXAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                    />
                    <RechartsYAxis
                      dataKey="name"
                      type="category"
                      stroke="#64748b"
                      fontSize={9}
                      width={100}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => val.length > 15 ? val.slice(0, 14) + "..." : val}
                    />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", opacity: 0.7 }} />
                    <RechartsBar
                      name="Mês Ativo"
                      dataKey="Total"
                      radius={[0, 4, 4, 0]}
                      barSize={11}
                    >
                      {(activeCategoryTab === "saida" ? categoryChartData.saidas : categoryChartData.entradas).map((entry, index) => (
                        <RechartsCell 
                          key={`cell-${index}`} 
                          fill={entry.fill}
                          stroke={entry.fill}
                          strokeWidth={0.5}
                        />
                      ))}
                    </RechartsBar>
                    {showPrevMonthComparison && periodScope === "filtered" && (
                      <RechartsBar
                        name="Mês Anterior"
                        dataKey="PrevTotal"
                        fill="#94a3b8"
                        fillOpacity={0.35}
                        stroke="#64748b"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        radius={[0, 4, 4, 0]}
                        barSize={7}
                      />
                    )}
                  </RechartsBarChart>
                </RechartsResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-1.5 select-none md:py-12">
                  <HelpCircle size={22} className="stroke-1 text-slate-350" />
                  <span className="text-xs font-bold text-slate-700">Nenhum lançamento no escopo</span>
                  <p className="text-[10px] text-slate-400 max-w-2xs leading-normal">Não foram encontradas despesas/receitas neste período nesta configuração.</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-450 leading-relaxed italic mt-2 flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-500" />
            <span>As categorias estão ordenadas decrescientemente por volume financeiro.</span>
          </div>
        </div>

      </div>

      {/* --- TEMPORAL CASH FLOW SECTION (ANUAL, MENSAL, SEMANAL, DIARIO) --- */}
      <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between" id="temporal-cash-flow-section">
        <div>
          {/* HEADER AND SWITCHER ROW */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-slate-100 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Clock size={18} className="animate-spin-slow" />
              </span>
              <div>
                <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Demonstrativo de Caixa de Fluxos</h3>
                <p className="text-xs text-slate-450">Filtre, analise e monitore faturamento consolidado por ano, mês, semanas ou dias detalhados.</p>
              </div>
            </div>

            {/* CONTROLLS ROW */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Selector Tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-150 shadow-2xs">
                <button
                  type="button"
                  onClick={() => { setTimeframe("anual"); setActiveDailyDetail(null); }}
                  className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
                    timeframe === "anual" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  📅 Anual
                </button>
                <button
                  type="button"
                  onClick={() => { setTimeframe("mensal"); setActiveDailyDetail(null); }}
                  className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
                    timeframe === "mensal" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  📆 Mensal
                </button>
                <button
                  type="button"
                  onClick={() => { setTimeframe("semanal"); setActiveDailyDetail(null); }}
                  className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
                    timeframe === "semanal" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  🔄 Semanal
                </button>
                <button
                  type="button"
                  onClick={() => { setTimeframe("diario"); setActiveDailyDetail(null); }}
                  className={`px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${
                    timeframe === "diario" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  📌 Diário
                </button>
              </div>

              {/* Year Select Input */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 font-semibold shadow-3xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ano:</span>
                <select
                  value={selectedYr}
                  onChange={(e) => { setSelectedYr(parseInt(e.target.value)); setActiveDailyDetail(null); }}
                  className="bg-transparent border-none p-0 focus:outline-hidden font-bold text-slate-700 text-xs cursor-pointer"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              {/* Month Select Input (not visible in annual mode) */}
              {timeframe !== "anual" && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 font-semibold shadow-3xs">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mês:</span>
                  <select
                    value={selectedMth}
                    onChange={(e) => { setSelectedMth(e.target.value); setActiveDailyDetail(null); }}
                    className="bg-transparent border-none p-0 focus:outline-hidden font-bold text-slate-700 text-xs cursor-pointer"
                  >
                    {monthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* TIME CONTAINER INJECTIONS */}

          {/* 1. VIEW ANUAL */}
          {timeframe === "anual" && (
            <div className="space-y-6">
              {/* Year summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                  <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider">Receitas no Ano</span>
                  <div className="text-lg font-black font-mono text-emerald-600 mt-1">
                    R$ {annualAggregation.totalEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                  <span className="text-[10px] text-rose-700 uppercase font-bold tracking-wider">Despesas no Ano</span>
                  <div className="text-lg font-black font-mono text-rose-600 mt-1">
                    R$ {annualAggregation.totalSaida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border ${annualAggregation.totalSaldo >= 0 ? "bg-indigo-50/40 border-indigo-100/50" : "bg-red-50/40 border-red-100/50"}`}>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${annualAggregation.totalSaldo >= 0 ? "text-indigo-700" : "text-red-700"}`}>Saldo Anual Líquido</span>
                  <div className={`text-lg font-black font-mono mt-1 ${annualAggregation.totalSaldo >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                    R$ {annualAggregation.totalSaldo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Aproveitamento Médio</span>
                  <div className="text-lg font-black font-mono text-slate-700 mt-1">
                    {annualAggregation.efficiency.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Months progress list */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {annualAggregation.monthlySum.map((item) => {
                  const hasActivity = item.entrada > 0 || item.saida > 0;
                  return (
                    <div 
                      key={item.monthNum}
                      onMouseEnter={() => {
                        if (hasActivity) {
                          setHoveredMonth(item.monthNum);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredMonth(null);
                      }}
                      className={`p-4 rounded-2xl border transition select-none relative ${
                        hasActivity 
                          ? "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 hover:border-indigo-300 cursor-pointer" 
                          : "bg-slate-50/20 border-slate-100 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100/80 pb-2 mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{item.fullLabel}</span>
                        {item.saldo !== 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                            item.saldo >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {item.saldo >= 0 ? "+" : ""}R$ {item.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Entrada (+):</span>
                          <span className="text-emerald-600 font-bold">R$ {item.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Saída (-):</span>
                          <span className="text-rose-500 font-bold">R$ {item.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Micro progress graph */}
                      {hasActivity && (
                        <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${item.entrada > 0 ? (item.entrada / (item.entrada + item.saida)) * 100 : 0}%` }}
                            className="bg-emerald-500 h-full"
                          />
                          <div 
                            style={{ width: `${item.saida > 0 ? (item.saida / (item.entrada + item.saida)) * 100 : 0}%` }}
                            className="bg-rose-500 h-full"
                          />
                        </div>
                      )}

                      {/* Floating hover detail popover with category limits and chart */}
                      {hoveredMonth === item.monthNum && hoveredMonthDataEx && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10, x: "-50%" }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                          exit={{ opacity: 0, scale: 0.95, y: 10, x: "-50%" }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute left-1/2 bottom-[112%] z-50 w-[330px] sm:w-[420px] bg-white border border-slate-200 text-slate-800 rounded-3xl p-4.5 shadow-2xl pointer-events-none flex flex-col gap-3.5"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-black tracking-tight text-indigo-600 uppercase">
                              📊 {hoveredMonthDataEx.monthLabel} / {selectedYr}
                            </span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">
                              {hoveredMonthDataEx.count} Operações
                            </span>
                          </div>

                          {/* Quick numbers summary row */}
                          <div className="grid grid-cols-3 gap-2 text-center py-1 bg-slate-50/50 rounded-xl p-2 border border-slate-150">
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">Entradas</span>
                              <span className="text-emerald-600 font-black font-mono text-[11px]">
                                R$ {hoveredMonthDataEx.totalIn.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">Saídas</span>
                              <span className="text-rose-500 font-black font-mono text-[11px]">
                                R$ {hoveredMonthDataEx.totalOut.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">Saldo Líquido</span>
                              <span className={`font-black font-mono text-[11px] ${hoveredMonthDataEx.saldo >= 0 ? "text-indigo-600" : "text-rose-500"}`}>
                                R$ {hoveredMonthDataEx.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>

                          {/* Recharts chart inside of the Popover */}
                          {hoveredMonthDataEx.chartData.length > 0 ? (
                            <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-150">
                              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1 pl-1">
                                Top Categorias neste Mês:
                              </span>
                              <div className="h-28 flex items-center justify-center">
                                <RechartsBarChart
                                  width={340}
                                  height={100}
                                  data={hoveredMonthDataEx.chartData}
                                  layout="vertical"
                                  margin={{ top: 2, right: 10, left: 10, bottom: 2 }}
                                >
                                  <RechartsXAxis type="number" hide />
                                  <RechartsYAxis 
                                    type="category" 
                                    dataKey="name" 
                                    stroke="#64748b" 
                                    fontSize={8} 
                                    width={90} 
                                    axisLine={false} 
                                    tickLine={false} 
                                  />
                                  <RechartsBar dataKey="valor" radius={[0, 4, 4, 0]} barSize={8}>
                                    {hoveredMonthDataEx.chartData.map((entry, index) => (
                                      <RechartsCell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </RechartsBar>
                                </RechartsBarChart>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-[10px] text-slate-400 italic">Sem dados estatísticos</div>
                          )}

                          {/* Dual lists of inputs and outbound categories side by side */}
                          <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-100 text-[10px]">
                            {/* Receitas Column */}
                            <div>
                              <span className="font-extrabold text-emerald-600 block pb-1 border-b border-emerald-100 uppercase tracking-wider text-[8px] mb-1.5">
                                Receitas ({hoveredMonthDataEx.entries.length})
                              </span>
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                {hoveredMonthDataEx.entries.length > 0 ? (
                                  hoveredMonthDataEx.entries.map((cat, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-slate-600 font-mono text-[9px]">
                                      <span className="truncate max-w-[95px] text-slate-500 font-bold" title={cat.name}>
                                        {cat.name}
                                      </span>
                                      <span className="font-bold text-emerald-600 text-right">
                                        R$ {cat.amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic">Sem entradas</span>
                                )}
                              </div>
                            </div>

                            {/* Despesas Column */}
                            <div>
                              <span className="font-extrabold text-rose-500 block pb-1 border-b border-rose-100 uppercase tracking-wider text-[8px] mb-1.5">
                                Despesas ({hoveredMonthDataEx.exits.length})
                              </span>
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                {hoveredMonthDataEx.exits.length > 0 ? (
                                  hoveredMonthDataEx.exits.map((cat, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-slate-600 font-mono text-[9px]">
                                      <span className="truncate max-w-[95px] text-slate-500 font-bold" title={cat.name}>
                                        {cat.name}
                                      </span>
                                      <span className="font-bold text-rose-500 text-right">
                                        R$ {cat.amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic">Sem despesas</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Insigths card */}
              <div className="p-4 bg-indigo-50/35 border border-indigo-100/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between text-xs gap-3">
                <span className="font-bold text-indigo-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Visualização consolidada de faturamento anual do ano de {selectedYr}.
                </span>
                <p className="text-slate-500">
                  Consumos e investimentos distribuídos de forma dinâmica baseada no histórico operacional.
                </p>
              </div>
            </div>
          )}

          {/* 2. VIEW MENSAL */}
          {timeframe === "mensal" && (
            <div className="space-y-5">
              {/* Stats overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Inflow</span>
                    <span className="font-bold text-slate-700 font-mono">R$ {monthlyAggregation.totalEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Outflow</span>
                    <span className="font-bold text-slate-700 font-mono">R$ {monthlyAggregation.totalSaida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className={`p-4 border rounded-2xl flex items-center gap-3 ${monthlyAggregation.totalSaldo >= 0 ? "bg-emerald-50/20 border-emerald-100/50" : "bg-rose-50/20 border-rose-100/50"}`}>
                  <div className={`p-2.5 rounded-xl ${monthlyAggregation.totalSaldo >= 0 ? "bg-emerald-100/50 text-emerald-700" : "bg-rose-100/50 text-rose-700"}`}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold uppercase block ${monthlyAggregation.totalSaldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Resultado Balanceado</span>
                    <span className={`font-black font-mono ${monthlyAggregation.totalSaldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>R$ {monthlyAggregation.totalSaldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Grid to place the stats breakdown and category pie chart side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Aproveitamento visual card wrapper */}
                <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-bold text-xs text-slate-700">Aproveitamento e Produtividade Operacional</h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Indicador de conversão líquida: {monthlyAggregation.efficiency.toFixed(1)}%</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-450 font-bold bg-slate-150 px-2 py-1 rounded-md">{monthlyAggregation.count} Operações registradas</span>
                    </div>

                    {/* Progress-bar */}
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-2xs">
                      <div 
                        style={{ width: `${Math.max(0, Math.min(100, monthlyAggregation.efficiency))}%` }}
                        className="bg-indigo-600 h-full"
                      />
                      <div 
                        style={{ width: `${Math.max(0, 100 - Math.max(0, Math.min(100, monthlyAggregation.efficiency)))}%` }}
                        className="bg-slate-300/40 h-full"
                      />
                    </div>
                  </div>

                  {/* Categories break lists */}
                  {monthlyAggregation.sortedCategories.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Classificação de Custo / Proveito no Mês:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                        {monthlyAggregation.sortedCategories.map(cat => (
                          <div key={cat.name} className="flex justify-between items-center p-3 bg-white border border-slate-150 rounded-xl shadow-3xs text-xs">
                            <span className="font-bold text-slate-600 flex items-center gap-1.5 uppercase text-[11px] truncate">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cat.type === "entrada" ? "bg-emerald-500" : "bg-rose-500"}`} />
                              <span className="truncate">{cat.name}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-700 shrink-0 select-all">
                              {cat.type === "entrada" ? "+" : "-"} R$ {(cat.entrada + cat.saida).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[11px] text-slate-400">Nenhuma categoria identificada neste mês.</div>
                  )}
                </div>

                {/* Pie Chart Card for the Month */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 shadow-3xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-4 select-none">
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-3 bg-indigo-500 rounded-xs" />
                          Distribuição das Categorias do Mês
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Análise simultânea do peso de cada categoria em Receitas e Despesas.</p>
                      </div>
                    </div>

                    {(() => {
                      const filteredReceitas = monthlyAggregation.sortedCategories
                        .filter(c => c.type === "entrada")
                        .map(c => ({
                          name: c.name,
                          Total: c.entrada,
                          fill: CATEGORY_HEX_COLORS[c.name] || "#10b981"
                        }))
                        .filter(item => item.Total > 0);

                      const filteredDespesas = monthlyAggregation.sortedCategories
                        .filter(c => c.type === "saida")
                        .map(c => ({
                          name: c.name,
                          Total: c.saida,
                          fill: CATEGORY_HEX_COLORS[c.name] || "#f43f5e"
                        }))
                        .filter(item => item.Total > 0);

                      const totalReceitas = filteredReceitas.reduce((sum, item) => sum + item.Total, 0);
                      const totalDespesas = filteredDespesas.reduce((sum, item) => sum + item.Total, 0);

                      const CreateCustomPieTooltip = (totalSum: number) => {
                        return ({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white text-slate-800 p-3.5 rounded-2xl shadow-xl border border-slate-150 text-xs font-sans leading-relaxed backdrop-blur-md">
                                <p className="font-extrabold border-b border-slate-100 pb-1.5 mb-2 uppercase text-[9.5px] tracking-widest text-indigo-600">
                                  {data.name}
                                </p>
                                <div className="space-y-1 font-mono text-xs">
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="text-slate-450 font-bold font-sans">Valor:</span>
                                    <span className="font-black text-indigo-600">
                                      R$ {data.Total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  {totalSum > 0 && (
                                    <div className="flex justify-between items-center gap-6">
                                      <span className="text-slate-450 font-bold font-sans">Percentual:</span>
                                      <span className="font-bold text-slate-650">
                                        {((data.Total / totalSum) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        };
                      };

                      const ReceitasTooltip = CreateCustomPieTooltip(totalReceitas);
                      const DespesasTooltip = CreateCustomPieTooltip(totalDespesas);

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs select-none">
                          {/* Receitas Donut Column */}
                          <div className="p-4 bg-white/50 border border-slate-150 rounded-xl flex flex-col justify-between">
                            <div>
                              <h5 className="font-bold text-[11px] uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Receitas / Entradas
                              </h5>
                              
                              {filteredReceitas.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="h-[140px] relative flex items-center justify-center">
                                    <RechartsResponsiveContainer width="100%" height="100%">
                                      <RechartsPieChart>
                                        <RechartsTooltip content={<ReceitasTooltip />} />
                                        <RechartsPie
                                          data={filteredReceitas}
                                          dataKey="Total"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          innerRadius={35}
                                          outerRadius={55}
                                          paddingAngle={3}
                                          minAngle={15}
                                        >
                                          {filteredReceitas.map((entry, index) => (
                                            <RechartsCell 
                                              key={`cell-${index}`} 
                                              fill={entry.fill}
                                              stroke="#ffffff"
                                              strokeWidth={1.5}
                                            />
                                          ))}
                                        </RechartsPie>
                                      </RechartsPieChart>
                                    </RechartsResponsiveContainer>
                                    
                                    {/* Centered sum */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                      <span className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-0.5">Total</span>
                                      <span className="text-[11px] font-black text-emerald-600 font-mono">
                                        R$ {totalReceitas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Legend list */}
                                  <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                                    {filteredReceitas.map((item) => {
                                      const realPct = totalReceitas > 0 ? ((item.Total / totalReceitas) * 100).toFixed(1) : "0.0";
                                      return (
                                        <div key={item.name} className="flex items-center justify-between p-1.5 bg-white border border-slate-150 rounded-lg shadow-3xs hover:bg-slate-100/50 transition leading-none">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                                            <span className="text-[10px] font-bold text-slate-600 truncate uppercase">{item.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9.5px]">
                                            <span className="text-slate-450 font-semibold font-sans">({realPct}%)</span>
                                            <span className="font-extrabold text-slate-705">R$ {item.Total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-1 justify-center bg-white/20 rounded-xl border border-dashed border-slate-200">
                                  <HelpCircle size={16} className="text-slate-350" />
                                  <span className="text-[10px]">Nenhuma receita neste mês</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Despesas Donut Column */}
                          <div className="p-4 bg-white/50 border border-slate-150 rounded-xl flex flex-col justify-between">
                            <div>
                              <h5 className="font-bold text-[11px] uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Despesas / Saídas
                              </h5>

                              {filteredDespesas.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="h-[140px] relative flex items-center justify-center">
                                    <RechartsResponsiveContainer width="100%" height="100%">
                                      <RechartsPieChart>
                                        <RechartsTooltip content={<DespesasTooltip />} />
                                        <RechartsPie
                                          data={filteredDespesas}
                                          dataKey="Total"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          innerRadius={35}
                                          outerRadius={55}
                                          paddingAngle={3}
                                          minAngle={15}
                                        >
                                          {filteredDespesas.map((entry, index) => (
                                            <RechartsCell 
                                              key={`cell-${index}`} 
                                              fill={entry.fill}
                                              stroke="#ffffff"
                                              strokeWidth={1.5}
                                            />
                                          ))}
                                        </RechartsPie>
                                      </RechartsPieChart>
                                    </RechartsResponsiveContainer>
                                    
                                    {/* Centered sum */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                      <span className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-0.5">Total</span>
                                      <span className="text-[11px] font-black text-rose-600 font-mono">
                                        R$ {totalDespesas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Legend list */}
                                  <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                                    {filteredDespesas.map((item) => {
                                      const realPct = totalDespesas > 0 ? ((item.Total / totalDespesas) * 100).toFixed(1) : "0.0";
                                      return (
                                        <div key={item.name} className="flex items-center justify-between p-1.5 bg-white border border-slate-150 rounded-lg shadow-3xs hover:bg-slate-100/50 transition leading-none">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                                            <span className="text-[10px] font-bold text-slate-600 truncate uppercase">{item.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9.5px]">
                                            <span className="text-slate-450 font-semibold font-sans">({realPct}%)</span>
                                            <span className="font-extrabold text-slate-705">R$ {item.Total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-1 justify-center bg-white/20 rounded-xl border border-dashed border-slate-200">
                                  <HelpCircle size={16} className="text-slate-350" />
                                  <span className="text-[10px]">Nenhuma despesa neste mês</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. VIEW SEMANAL */}
          {timeframe === "semanal" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 mb-2 font-semibold">
                Divisão semanal do saldo líquido para o mês de <span className="font-bold text-slate-700">{getSelectedMonthLabel()} de {selectedYr}</span>:
              </div>

              <div className="flex flex-col gap-3">
                {weeklyAggregation.map((w, index) => {
                  const hasWActivity = w.entrada > 0 || w.saida > 0;
                  return (
                    <div 
                      key={w.id} 
                      className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition select-none ${
                        hasWActivity
                          ? "bg-white border-slate-200 hover:shadow-xs"
                          : "bg-slate-50/40 border-slate-100 opacity-60"
                      }`}
                    >
                      {/* Left Header */}
                      <div className="flex items-center gap-3">
                        <span className="p-2 font-bold font-mono text-[11px] bg-indigo-50 text-indigo-700 rounded-lg min-w-10 text-center leading-none">
                          S{index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-xs text-slate-700 block">{w.label}</span>
                          <span className="text-[10px] text-slate-400">Período: {w.days}</span>
                        </div>
                      </div>

                      {/* Values info */}
                      <div className="grid grid-cols-3 gap-3 md:gap-7 text-xs font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Entradas</span>
                          <span className="text-emerald-600 font-bold">R$ {w.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Saídas</span>
                          <span className="text-rose-500 font-bold">R$ {w.saida.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Saldo</span>
                          <span className={`font-bold ${w.saldo >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                            R$ {w.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {/* Operations count */}
                      <div className="text-right flex items-center gap-2自 justify-end select-none text-[10px] text-slate-400">
                        <span className="font-bold bg-slate-50 px-2 py-1 rounded-md border border-slate-150">
                          {w.txsCount} {w.txsCount === 1 ? "operação" : "operações"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. VIEW DIARIO */}
          {timeframe === "diario" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 font-semibold mb-3">
                Distribuição diária dinâmica para o mês de <span className="font-bold text-slate-700">{getSelectedMonthLabel()} de {selectedYr}</span>. Clique em um dia relevante para inspecionar os lançamentos e movimentações de caixa:
              </div>

              {/* Grid map of days of the month */}
              <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-10 gap-2 mb-4">
                {dailyAggregation.dailyList.map(item => {
                  const hasDActivity = item.entrada > 0 || item.saida > 0;
                  const isSelected = activeDailyDetail === item.day;
                  return (
                    <button
                      key={item.day}
                      type="button"
                      onClick={() => {
                        if (hasDActivity) {
                          setActiveDailyDetail(isSelected ? null : item.day);
                        }
                      }}
                      onMouseEnter={() => {
                        if (hasDActivity) {
                          setHoveredDay(item.day);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredDay(null);
                      }}
                      disabled={!hasDActivity}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition select-none h-18 text-xs relative ${
                        isSelected 
                          ? "bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-indigo-400" 
                          : hasDActivity
                            ? "bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                            : "bg-slate-50/20 border-slate-100 opacity-30 cursor-not-allowed"
                      }`}
                    >
                      <span className={`font-extrabold text-[11px] ${isSelected ? "text-white" : "text-slate-400"}`}>{String(item.day).padStart(2, "0")}</span>
                      
                      {hasDActivity && (
                        <div className="space-y-0.5 pointer-events-none">
                          <span className={`font-bold font-mono block text-[9px] ${
                            isSelected 
                              ? "text-indigo-100" 
                              : item.saldo >= 0 ? "text-emerald-600" : "text-rose-500"
                          }`}>
                            {item.saldo >= 0 ? "+" : ""}R$ {Math.round(item.saldo)}
                          </span>
                        </div>
                      )}

                      {/* Hover Floating Details Card */}
                      {hoveredDay === item.day && hoveredDayDataEx && (
                        <div
                          style={{ contentVisibility: "auto" }}
                          className="absolute left-1/2 bottom-[115%] -translate-x-1/2 z-50 w-[280px] sm:w-[320px] bg-white border border-slate-200 text-slate-705 rounded-2xl p-4.5 shadow-xl pointer-events-none flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-[10px] font-black tracking-tight text-indigo-600 uppercase">
                              📅 Dia {String(item.day).padStart(2, "0")} / {selectedMth}
                            </span>
                            <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500 font-mono">
                              {hoveredDayDataEx.count} Operações
                            </span>
                          </div>

                          {/* Sum columns */}
                          <div className="grid grid-cols-3 gap-1.5 text-center py-1 bg-slate-50/50 rounded-xl p-2 border border-slate-150">
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-bold uppercase block">Entradas</span>
                              <span className="text-emerald-600 font-black font-mono text-[9.5px]">
                                R$ {hoveredDayDataEx.totalIn.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-bold uppercase block">Saídas</span>
                              <span className="text-rose-500 font-black font-mono text-[9.5px]">
                                R$ {hoveredDayDataEx.totalOut.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7.5px] text-slate-400 font-bold uppercase block">Saldo</span>
                              <span className={`font-black font-mono text-[9.5px] ${hoveredDayDataEx.saldo >= 0 ? "text-indigo-600" : "text-rose-500"}`}>
                                R$ {hoveredDayDataEx.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>

                          {/* Categories List */}
                          {hoveredDayDataEx.categoriesList.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[7.5px] uppercase tracking-wider text-slate-450 font-extrabold block mb-0.5">
                                Divisão de Categorias:
                              </span>
                              <div className="space-y-1 max-h-[110px] overflow-y-auto scrollbar-thin">
                                {hoveredDayDataEx.categoriesList.map((cat, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-slate-600 font-mono text-[9px] bg-slate-50 p-1 rounded border border-slate-100 leading-none">
                                    <span className="truncate max-w-[110px] font-bold text-slate-505 flex items-center gap-1 uppercase text-[8.5px]">
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.type === "entrada" ? "#10b981" : "#f43f5e" }} />
                                      {cat.name}
                                    </span>
                                    <span className={`font-extrabold text-[8.5px] ${cat.type === "entrada" ? "text-emerald-600" : "text-rose-500"}`}>
                                      R$ {cat.amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Daily Proportional Progress Cards (Similar to Annual Month Cards) */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 leading-none">
                  <span className="inline-block w-1.5 h-3 bg-indigo-500 rounded-xs" />
                  Fluxo de Caixa por Dia de Lançamento (Gráficos de Proporção)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dailyAggregation.dailyList.filter(item => item.entrada > 0 || item.saida > 0).map(item => {
                    const hasActivity = item.entrada > 0 || item.saida > 0;
                    const isSelected = activeDailyDetail === item.day;
                    const percentIn = item.entrada > 0 ? (item.entrada / (item.entrada + item.saida)) * 100 : 0;
                    const percentOut = item.saida > 0 ? (item.saida / (item.entrada + item.saida)) * 100 : 0;

                    return (
                      <div 
                        key={item.day}
                        onClick={() => {
                          setActiveDailyDetail(isSelected ? null : item.day);
                        }}
                        className={`p-4 rounded-2xl border transition select-none flex flex-col justify-between cursor-pointer relative ${
                          isSelected 
                            ? "bg-indigo-50/50 border-indigo-400 shadow-xs ring-2 ring-indigo-200" 
                            : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 hover:border-indigo-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-100/80 pb-2 mb-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                              Dia {String(item.day).padStart(2, "0")} / {selectedMth}
                            </span>
                            {item.saldo !== 0 && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                                item.saldo >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {item.saldo >= 0 ? "+" : ""}R$ {item.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 text-[11px] font-mono mb-3">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Entrada (+):</span>
                              <span className="text-emerald-600 font-bold">R$ {item.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Saída (-):</span>
                              <span className="text-rose-500 font-bold">R$ {item.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Proportional visual chart bar */}
                        {hasActivity && (
                          <div className="mt-1 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex" title={`Entrada: ${percentIn.toFixed(0)}% | Saída: ${percentOut.toFixed(0)}%`}>
                            <div 
                              style={{ width: `${percentIn}%` }}
                              className="bg-emerald-500 h-full"
                            />
                            <div 
                              style={{ width: `${percentOut}%` }}
                              className="bg-rose-500 h-full"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dailyAggregation.dailyList.filter(item => item.entrada > 0 || item.saida > 0).length === 0 && (
                    <div className="col-span-full text-center py-6 text-xs text-slate-400 select-none">
                      Nenhum lançamento cadastrado neste período.
                    </div>
                  )}
                </div>
              </div>

              {/* Day inspection output */}
              {activeDailyDetail !== null && (() => {
                const selectedDayObj = dailyAggregation.dailyList.find(d => d.day === activeDailyDetail);
                if (!selectedDayObj || selectedDayObj.txs.length === 0) return null;
                return (
                  <div className="border border-indigo-200 p-4 rounded-2xl bg-indigo-50/30 shadow-3xs mt-3">
                    <div className="flex justify-between items-center pb-2.5 border-b border-indigo-100 mb-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-extrabold">
                        <span className="inline-block w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping" />
                        Inspecionando Lançamentos do Dia {String(activeDailyDetail).padStart(2, "0")}/{selectedMth}/{selectedYr}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveDailyDetail(null)}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2 py-1 rounded-md"
                      >
                        Fechar Visualizador
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedDayObj.txs.map((tx: any) => (
                        <div 
                          key={tx.id} 
                          className="flex items-center justify-between p-3 rounded-xl border bg-white border-slate-150 shadow-3xs text-xs"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700 uppercase tracking-tight text-[11px]">{tx.description}</span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">{tx.category}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`font-bold font-mono ${tx.type === "entrada" ? "text-emerald-600" : "text-rose-600"}`}>
                              {tx.type === "entrada" ? "+" : "-"} R$ {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

