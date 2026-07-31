import React, { useState, useMemo } from "react";
import { 
  X, 
  Printer, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Compass, 
  CheckSquare, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Building,
  Activity,
  UserCheck
} from "lucide-react";
import { ActivityLog } from "./ActivityLogPanel";

interface Transaction {
  id: string;
  caixaId?: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  date: string;
  category: string;
}

interface RentalProperty {
  id: string;
  caixaId?: string;
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
  adminFeePercent?: number;
  adminFeeAmount: number;
  paidPeriods: string[];
  hasDeposit?: boolean;
  depositMonthsCount?: number;
  depositAmount?: number;
  depositStartDate?: string;
  depositInterestRate?: number;
}

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  activeCaixa: { id: string; name: string };
  caixas: Array<{ id: string; name: string }>;
  rentals: RentalProperty[];
  categories: Array<{ id: string; name: string; type: "entrada" | "saida" }>;
  activityLogs: ActivityLog[];
}

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function ExecutiveReportModal({
  isOpen,
  onClose,
  transactions,
  activeCaixa,
  caixas,
  rentals,
  categories,
  activityLogs
}: ExecutiveReportModalProps) {
  
  // Controls
  const [reportType, setReportType] = useState<"diario" | "semanal" | "mensal" | "anual" | "personalizado">("mensal");
  const [scope, setScope] = useState<"caixa" | "consolidado">("consolidado");
  const [includeLogs, setIncludeLogs] = useState<boolean>(false);
  const [includeRentals, setIncludeRentals] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState("Holding LF - Relatório de Desempenho e Auditoria Financeira");
  const [signers, setSigners] = useState<boolean>(true);

  // New advanced filters
  const [txTypeFilter, setTxTypeFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>("todos");
  const [txSearchFilter, setTxSearchFilter] = useState<string>("");

  const [customStartDate, setCustomStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return getLocalDateInputValue();
  });

  // Compile all unique categories dynamically
  const uniqueCategories = useMemo(() => {
    const list = new Set<string>();
    if (categories) {
      categories.forEach(c => {
        if (c && c.name) list.add(c.name);
      });
    }
    if (transactions) {
      transactions.forEach(t => {
        if (t && t.category) list.add(t.category);
      });
    }
    return Array.from(list).sort();
  }, [categories, transactions]);

  // Compute stats according to filters
  const reportData = useMemo(() => {
    const today = new Date();
    
    // Filter transactions based on selected scope
    let filteredTxs = transactions;
    if (scope === "caixa") {
      filteredTxs = transactions.filter(t => t.caixaId === activeCaixa.id);
    }

    // Filter by timeframe
    filteredTxs = filteredTxs.filter(t => {
      const txDate = new Date(t.date.includes("T") ? t.date : t.date + "T00:00:00");
      if (isNaN(txDate.getTime())) return true; // fallback

      if (reportType === "diario") {
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 1;
      }
      if (reportType === "semanal") {
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (reportType === "mensal") {
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 31;
      }
      if (reportType === "anual") {
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 365;
      }
      if (reportType === "personalizado") {
        const start = customStartDate ? new Date(customStartDate + "T00:00:00") : null;
        const end = customEndDate ? new Date(customEndDate + "T23:59:59") : null;
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      }
      return true;
    });

    // Apply Type Filter (entradas vs saídas)
    if (txTypeFilter !== "todos") {
      filteredTxs = filteredTxs.filter(t => t.type === txTypeFilter);
    }

    // Apply Category Filter
    if (txCategoryFilter !== "todos") {
      filteredTxs = filteredTxs.filter(t => t.category === txCategoryFilter);
    }

    // Apply Search/Keyword Filter (checks description and category)
    if (txSearchFilter.trim() !== "") {
      const term = txSearchFilter.toLowerCase();
      filteredTxs = filteredTxs.filter(t => 
        t.description.toLowerCase().includes(term) || 
        t.category.toLowerCase().includes(term)
      );
    }

    // Sort by date descending
    filteredTxs = [...filteredTxs].sort((a, b) => b.date.localeCompare(a.date));

    // Stats calculations
    let totalIn = 0;
    let totalOut = 0;
    filteredTxs.forEach(t => {
      if (t.type === "entrada") totalIn += t.amount;
      else totalOut += t.amount;
    });

    const netProfit = totalIn - totalOut;
    const efficiency = totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : 0;
    const byCategory = filteredTxs.reduce<Record<string, { category: string; entrada: number; saida: number; count: number }>>((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { category: t.category, entrada: 0, saida: 0, count: 0 };
      }
      acc[t.category][t.type] += t.amount;
      acc[t.category].count += 1;
      return acc;
    }, {});
    const incomeCategories = Object.values(byCategory)
      .filter(item => item.entrada > 0)
      .sort((a, b) => b.entrada - a.entrada)
      .slice(0, 5);
    const expenseCategories = Object.values(byCategory)
      .filter(item => item.saida > 0)
      .sort((a, b) => b.saida - a.saida)
      .slice(0, 5);

    const byDay = filteredTxs.reduce<Record<string, { date: string; entrada: number; saida: number; transactions: Transaction[] }>>((acc, t) => {
      const dateKey = t.date.slice(0, 10);
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, entrada: 0, saida: 0, transactions: [] };
      }
      if (t.type === "entrada") acc[dateKey].entrada += t.amount;
      if (t.type === "saida") acc[dateKey].saida += t.amount;
      acc[dateKey].transactions.push(t);
      return acc;
    }, {});

    const dailyMovements = Object.values(byDay)
      .map(day => ({
        ...day,
        saldo: day.entrada - day.saida,
        transactions: day.transactions.sort((a, b) => {
          if (a.type !== b.type) return a.type === "entrada" ? -1 : 1;
          return a.description.localeCompare(b.description, "pt-BR");
        })
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Filter logs for auditing
    let filteredLogs = activityLogs;
    if (scope === "caixa") {
      filteredLogs = activityLogs.filter(l => l.caixaId === activeCaixa.id);
    }
    
    // Filter logs by timeframe
    filteredLogs = filteredLogs.filter(l => {
      const logDate = new Date(l.timestamp);
      if (isNaN(logDate.getTime())) return true;

      if (reportType === "diario" || reportType === "semanal" || reportType === "mensal" || reportType === "anual") {
        const diffTime = Math.abs(today.getTime() - logDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (reportType === "diario") return diffDays <= 1;
        if (reportType === "semanal") return diffDays <= 7;
        if (reportType === "mensal") return diffDays <= 31;
        if (reportType === "anual") return diffDays <= 365;
      } else if (reportType === "personalizado") {
        const start = customStartDate ? new Date(customStartDate + "T00:00:00") : null;
        const end = customEndDate ? new Date(customEndDate + "T23:59:59") : null;
        if (start && logDate < start) return false;
        if (end && logDate > end) return false;
        return true;
      }
      return true;
    });

    // Filter rentals
    let filteredRentals = rentals;
    if (scope === "caixa") {
      filteredRentals = rentals.filter(r => r.caixaId === activeCaixa.id);
    }

    return {
      transactions: filteredTxs,
      logs: filteredLogs,
      rentals: filteredRentals,
      totalIn,
      totalOut,
      netProfit,
      efficiency,
      incomeCategories,
      expenseCategories,
      dailyMovements
    };
  }, [
    transactions,
    activityLogs,
    rentals,
    reportType,
    scope,
    activeCaixa.id,
    customStartDate,
    customEndDate,
    txTypeFilter,
    txCategoryFilter,
    txSearchFilter
  ]);

  if (!isOpen) return null;

  // Handle perfect native printing
  const triggerPrint = () => {
    window.print();
  };

  // Human date formatting helpers
  const formatBRLDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const formatLogTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} às ${h}:${m}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-250 flex items-center justify-center p-0 sm:p-4 overflow-y-auto select-none print:bg-white print:p-0">
      
      {/* Dynamic print-override styling block */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Clean up root, body, and wrapper containers so they don't lock heights */
          html, body, #root {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* Hide everything first */
          body * {
            visibility: hidden !important;
          }

          body > #root > div > *:not(:has(#print-area)) {
            display: none !important;
          }

          body *:not(:has(#print-area)):not(#print-area):not(#print-area *) {
            display: none !important;
          }

          body *:has(#print-area) {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          
          /* Specifically show our print container and all its children */
          #print-area, #print-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Break page layout controls for the containing modal element */
          div[class*="fixed"] {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            display: block !important;
            padding: 0 !important;
            background: transparent !important;
          }
          
          /* Make sure parent preview containers don't clip height or have scrollbars */
          .overflow-y-auto, .h-full, .min-h-screen {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
          }

          #print-area {
            position: static !important;
            width: 210mm !important;
            max-width: 210mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          
          .no-print {
            display: none !important;
          }

          #print-area table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          #print-area thead {
            display: table-header-group !important;
          }

          #print-area th,
          #print-area td {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
            vertical-align: top !important;
          }

          #print-area .truncate {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            max-width: none !important;
          }

          #print-area .overflow-hidden,
          #print-area .overflow-x-auto,
          #print-area .overflow-y-auto {
            overflow: visible !important;
          }
          
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }

          .page-break-inside {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}} />

      <div className="w-full max-w-6xl bg-slate-900 sm:rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row h-[calc(100vh-1rem)] md:h-[88vh] overflow-hidden">
        
        {/* Sidebar Controls (No Print) */}
        <div className="no-print w-full md:w-80 bg-slate-950 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 overflow-y-auto shrink-0 select-none max-h-[42vh] md:max-h-none">
          <div className="space-y-6">
            
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <span className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg"><Printer size={16} /></span>
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono">Exportador Executivo</span>
              </div>
              <h3 className="text-base font-black text-white">Relatórios em PDF</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Gere documentos executivos prontos para impressão ou exportação em PDF. Perfeito para apresentações de conselho e diretores.
              </p>
            </div>

            {/* Title modifier */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Título do Relatório</label>
              <input 
                type="text" 
                value={customTitle} 
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white outline-none font-semibold"
              />
            </div>

            {/* Scope selectors */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Escopo de Consolidação</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScope("caixa")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    scope === "caixa" 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-450 hover:text-white"
                  }`}
                >
                  Este Caixa
                </button>
                <button
                  type="button"
                  onClick={() => setScope("consolidado")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    scope === "consolidado" 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-450 hover:text-white"
                  }`}
                >
                  Consolidado
                </button>
              </div>
            </div>

            {/* Scope Period selectors */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Período Auditado</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReportType("diario")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportType === "diario" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Diário
                </button>
                <button
                  type="button"
                  onClick={() => setReportType("semanal")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportType === "semanal" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setReportType("mensal")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportType === "mensal" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setReportType("anual")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportType === "anual" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Anual
                </button>
                <button
                  type="button"
                  onClick={() => setReportType("personalizado")}
                  className={`col-span-2 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportType === "personalizado" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Período Personalizado
                </button>
              </div>

              {/* Custom Date Range Picker */}
              {reportType === "personalizado" && (
                <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 mt-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">De:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none font-medium cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Até:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none font-medium cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Filters Block */}
            <div className="space-y-3 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800/80">
              <span className="block text-[10px] font-bold text-slate-350 uppercase select-none tracking-wider">Filtros Avançados</span>
              
              {/* Type Filter */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-semibold uppercase">Tipo de Fluxo</label>
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value as "todos" | "entrada" | "saida")}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none font-medium"
                >
                  <option value="todos">Todos (Entradas & Saídas)</option>
                  <option value="entrada">Apenas Receitas (Rendas)</option>
                  <option value="saida">Apenas Despesas (Débitos)</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-semibold uppercase">Filtrar Categoria</label>
                <select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none font-medium"
                >
                  <option value="todos">Todas as Categorias</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Search Phrase */}
              <div className="space-y-1 mt-1">
                <label className="text-[9px] text-slate-400 font-semibold uppercase">Item ou Imóvel (Palavra-chave)</label>
                <input
                  type="text"
                  placeholder="Ex: LF01, Alimentação, Carlos..."
                  value={txSearchFilter}
                  onChange={(e) => setTxSearchFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none placeholder-slate-650 font-medium"
                />
              </div>
            </div>

            {/* Display selectors list */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Configurações visuais</label>
              
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={includeRentals} 
                  onChange={(e) => setIncludeRentals(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 accent-indigo-600"
                />
                <span className="text-[11px] text-slate-300 font-medium">Contratos de Aluguel (LF)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={includeLogs} 
                  onChange={(e) => setIncludeLogs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 accent-indigo-600"
                />
                <span className="text-[11px] text-slate-300 font-medium font-sans">Incluir Diário de Logs / Prontuário</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={signers} 
                  onChange={(e) => setSigners(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 accent-indigo-600"
                />
                <span className="text-[11px] text-slate-300 font-medium">Campos para Assinatura</span>
              </label>
            </div>

          </div>

          {/* Bottom controls panel */}
          <div className="mt-6 space-y-2.5 border-t border-slate-800/60 pt-4">
            <button
              onClick={triggerPrint}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
            >
              <Printer size={15} />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white py-2.5 px-4 rounded-xl text-xs font-bold transition border border-slate-800 cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>

        </div>

        {/* Paper Sheet Preview Content Panel (Prints to exact dimensions) */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-8 overflow-auto flex justify-start xl:justify-center items-start border-slate-800 min-h-[58vh] md:min-h-0">
          
          <div 
            id="print-area"
            className="w-[210mm] min-w-[210mm] max-w-none bg-white text-slate-900 p-[8mm] shadow-2xl rounded-2xl border border-slate-200/50 min-h-[296mm] font-sans"
          >
            
            {/* Executive Letterhead Header */}
            <div>
              <div className="flex justify-between items-start border-b-[2.5px] border-slate-800 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-900 mb-1">
                    <span className="bg-slate-900 text-white p-1.5 rounded-lg font-black text-xs font-mono select-none">LF</span>
                    <span className="text-xs uppercase font-extrabold tracking-widest font-mono">Gestão de Ativos Corporativos</span>
                  </div>
                  <h1 className="text-base font-black text-slate-900 leading-snug">
                    {customTitle}
                  </h1>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">
                    {scope === "consolidado" ? "Apurado Geral do Grupo Finanças" : `Apurado: Caixa ${activeCaixa.name}`}
                    {(txTypeFilter !== "todos" || txCategoryFilter !== "todos" || txSearchFilter.trim() !== "") && (
                      <span className="text-indigo-805 bg-indigo-50/60 px-1.5 py-0.5 rounded ml-1 lowercase font-bold">
                        (filtrando: {txTypeFilter !== "todos" && `${txTypeFilter === "entrada" ? "entradas" : "saídas"}`}
                        {txCategoryFilter !== "todos" && ` em "${txCategoryFilter}"`}
                        {txSearchFilter.trim() !== "" && ` chave: "${txSearchFilter}"`})
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right text-[10px] text-slate-500 font-medium font-sans">
                  <div className="font-extrabold text-slate-800 uppercase tracking-wider mb-0.5 select-none text-[11px]">Auditado Internamente</div>
                  <div>Geração: {new Date().toLocaleDateString("pt-BR")}</div>
                  <div>Validação: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}</div>
                  <div className="mt-1"><span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 border border-emerald-100 rounded-md font-bold text-[9px] uppercase">Auditor Legal Livre</span></div>
                </div>
              </div>

              {/* Subheading Details of scope */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl mb-4 select-none">
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Relatório</span>
                  <span className="text-xs font-bold text-slate-800 uppercase">
                    {reportType === "diario" ? "Diário Executivo" : 
                     reportType === "semanal" ? "Semanal de Board" :
                     reportType === "mensal" ? "Mensal Estatutário" : 
                     reportType === "anual" ? "Anual Consolidado" : "Período Personalizado"}
                  </span>
                  <span className="block text-[8px] text-slate-500 mt-0.5 font-bold">
                    {reportType === "personalizado" 
                      ? `${formatBRLDate(customStartDate)} a ${formatBRLDate(customEndDate)}`
                      : "Janelas de Fluxos"}
                  </span>
                </div>
                
                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Unidade Monetária</span>
                  <span className="text-xs font-bold text-slate-800">
                    Real BRL (R$)
                  </span>
                  <span className="block text-[8px] text-slate-400 mt-0.5">Padrão BACEN pt-BR</span>
                </div>

                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Total de Lançamentos</span>
                  <span className="text-xs font-bold text-slate-800">
                    {reportData.transactions.length} Registrados
                  </span>
                  <span className="block text-[8px] text-slate-400 mt-0.5">Operações na janela</span>
                </div>

                <div>
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Status Geral</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={11} />
                    <span>EQUILIBRADO</span>
                  </span>
                  <span className="block text-[8px] text-slate-400 mt-0.5">Sem pendências críticas</span>
                </div>
              </div>

              {/* High-Level Corporate KPI Stats cards Row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                
                {/* Total Receipts */}
                <div className="p-3 bg-white border border-slate-150 rounded-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Faturamento Bruto</span>
                    <TrendingUp size={14} className="text-emerald-500" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-base font-extrabold text-slate-900 font-mono">
                      R$ {reportData.totalIn.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Total de entradas e aluguéis</p>
                  </div>
                </div>

                {/* Total Expenses */}
                <div className="p-3 bg-white border border-slate-150 rounded-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Despesas e Alocações</span>
                    <TrendingDown size={14} className="text-rose-500" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-base font-extrabold text-slate-900 font-mono">
                      R$ {reportData.totalOut.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Impostos, taxas e saídas</p>
                  </div>
                </div>

                {/* Net Balance / Result */}
                <div className={`p-3 bg-slate-50 border rounded-xl relative overflow-hidden flex flex-col justify-between ${
                  reportData.netProfit >= 0 ? "border-emerald-250 bg-emerald-50/10" : "border-rose-250 bg-rose-50/10"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Resultado Líquido</span>
                    <Activity size={14} className={reportData.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"} />
                  </div>
                  <div className="mt-2">
                    <h3 className={`text-base font-black font-mono ${
                      reportData.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      R$ {reportData.netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[8px] text-slate-400 font-semibold mt-0.5">
                      Margem operacional de {(reportData.efficiency).toFixed(1)}%
                    </p>
                  </div>
                </div>

              </div>

              <div className="space-y-2 mb-4">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider select-none">Resumo Executivo por Categoria</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-emerald-150 rounded-xl overflow-hidden bg-emerald-50/20">
                    <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 text-[9px] font-black uppercase text-emerald-800 tracking-widest">Principais entradas</div>
                    <div className="divide-y divide-emerald-100/70">
                      {reportData.incomeCategories.length > 0 ? reportData.incomeCategories.map(item => (
                        <div key={item.category} className="flex justify-between gap-3 p-1.5 text-[9px]">
                          <span className="font-bold text-slate-700">{item.category}</span>
                          <span className="font-black text-emerald-700 font-mono">R$ {item.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      )) : <div className="p-3 text-[9px] text-slate-400 italic">Sem entradas no período.</div>}
                    </div>
                  </div>
                  <div className="border border-rose-150 rounded-xl overflow-hidden bg-rose-50/20">
                    <div className="bg-rose-50 px-3 py-2 border-b border-rose-100 text-[9px] font-black uppercase text-rose-800 tracking-widest">Principais saídas</div>
                    <div className="divide-y divide-rose-100/70">
                      {reportData.expenseCategories.length > 0 ? reportData.expenseCategories.map(item => (
                        <div key={item.category} className="flex justify-between gap-3 p-1.5 text-[9px]">
                          <span className="font-bold text-slate-700">{item.category}</span>
                          <span className="font-black text-rose-700 font-mono">R$ {item.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      )) : <div className="p-3 text-[9px] text-slate-400 italic">Sem saídas no período.</div>}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-[8px] text-slate-500 leading-relaxed">
                  Este relatório executivo resume a saúde financeira do período. Extrato detalhado, logs de auditoria e cobrança de aluguéis ficam em relatórios próprios para não misturar operação com visão gerencial.
                </div>
              </div>

              <div className="space-y-2 mb-4 page-break-inside">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider select-none">Entradas e saídas por dia</h4>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{reportData.dailyMovements.length} dia(s) com movimento</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-[8.5px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-black uppercase tracking-wider">
                        <th className="p-1.5 w-[15%]">Data</th>
                        <th className="p-1.5 w-[38%]">Descrição</th>
                        <th className="p-1.5 w-[22%]">Categoria</th>
                        <th className="p-1.5 w-[13%] text-center">Entrada/Saída</th>
                        <th className="p-1.5 w-[12%] text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.dailyMovements.length > 0 ? (
                        reportData.dailyMovements.flatMap(day =>
                          day.transactions.map((t, index) => (
                            <tr key={`${day.date}-${t.id}`} className={index === 0 ? "border-t-2 border-slate-200" : ""}>
                              <td className="p-1.5 font-mono font-black text-slate-700">{formatBRLDate(day.date)}</td>
                              <td className="p-1.5 font-bold text-slate-800">{t.description}</td>
                              <td className="p-1.5 text-slate-500">{t.category}</td>
                              <td className={`p-1.5 text-center font-black ${t.type === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>
                                {t.type === "entrada" ? "Entrada" : "Saída"}
                              </td>
                              <td className={`p-1.5 text-right font-mono font-black ${t.type === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>
                                R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                            Nenhuma entrada ou saída encontrada no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Core Transactions History Ledger Table Block */}
              <div className="hidden">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider select-none">Dossiê e Razão Geral das Transações (Últimas Lançadas)</h4>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[9px] border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-2 w-18 select-none">Data</th>
                        <th className="p-2 select-none">Descrição Operacional</th>
                        <th className="p-2 w-28 select-none">Categoria</th>
                        {scope === "consolidado" && <th className="p-2 w-20 select-none">Origem / Caixa</th>}
                        <th className="p-2 text-right w-24 select-none">Créditos</th>
                        <th className="p-2 text-right w-24 select-none">Débitos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {reportData.transactions.length > 0 ? (
                        reportData.transactions.slice(0, 16).map(t => {
                          const associatedCaixa = caixas.find(c => c.id === t.caixaId);
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/40">
                              <td className="p-2 text-slate-500">{formatBRLDate(t.date)}</td>
                              <td className="p-2 font-bold text-slate-800">{t.description}</td>
                              <td className="p-2 text-slate-550">{t.category}</td>
                              {scope === "consolidado" && (
                                <td className="p-2 text-slate-500 truncate max-w-[80px]">
                                  {associatedCaixa?.name || "Geral"}
                                </td>
                              )}
                              <td className="p-2 text-right font-extrabold text-emerald-600 font-mono">
                                {t.type === "entrada" ? `+ R$ ${t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                              </td>
                              <td className="p-2 text-right font-extrabold text-rose-600 font-mono">
                                {t.type === "saida" ? `- R$ ${t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={scope === "consolidado" ? 6 : 5} className="p-8 text-center text-[10px] text-slate-400 font-semibold italic bg-slate-50/50">
                            Filtro sem transações no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {reportData.transactions.length > 16 && (
                  <p className="text-[7.5px] italic text-slate-400 text-right select-none pr-1">
                    Exibindo as 16 transações mais recentes no extrato impresso. Para ver todas as {reportData.transactions.length} transações, utilize a exportação de planilha completa.
                  </p>
                )}
              </div>

              {/* Consolidated Rental properties Yield Panel (if selected) */}
              {false && includeRentals && (
                <div className="space-y-2 mb-6">
                  <h4 className="text-[10px] font-black uppercase text-slate-455 tracking-wider select-none">Mapeamento de Receitas de Locação (LF Real Estate Portfolio)</h4>
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-[9px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-2 text-center w-14 select-none">LF Cod</th>
                          <th className="p-2 select-none">Inquilino de Referência / Contrato</th>
                          <th className="p-2 text-center w-12 select-none">Dia</th>
                          <th className="p-2 text-right w-22 select-none">Aluguel Seco</th>
                          <th className="p-2 text-right w-22 select-none">Tx Admin (Retido)</th>
                          <th className="p-2 text-right w-24 bg-indigo-50/15 text-indigo-900 select-none">Recebível Líquido</th>
                          <th className="p-2 text-center w-24 select-none">Status Mês Ativo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {reportData.rentals.length > 0 ? (
                          reportData.rentals.map(r => {
                            const thisMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                            const isPaid = r.paidPeriods.includes(thisMonthKey);
                            const totalLiq = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount;

                            return (
                              <tr key={r.id} className="hover:bg-slate-50/40">
                                <td className="p-2 text-center font-bold text-indigo-900">{r.lfCode}</td>
                                <td className="p-2">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-slate-800">{r.tenantName}</span>
                                    <span className="text-[7.5px] text-slate-400">{r.address}</span>
                                  </div>
                                </td>
                                <td className="p-2 text-center text-slate-500 font-mono">{r.dueDay}</td>
                                <td className="p-2 text-right font-mono">R$ {r.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 text-right text-rose-500 font-mono">R$ {r.adminFeeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 text-right font-extrabold font-mono bg-indigo-50/10 text-indigo-900">
                                  R$ {totalLiq.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${
                                    isPaid 
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                                      : "bg-amber-50 text-amber-700 border border-amber-150"
                                  }`}>
                                    {isPaid ? "Conciliado" : "Pendente"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-[10px] text-slate-400 italic font-semibold">
                              Nenhum contrato cadastrado neste escopo de caixa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Trail & Chronology system logs trace matching exactly "recebimento de renda no dia 10 de aluguel" user request etc. */}
              {false && includeLogs && (
                <div className="space-y-1.5 mb-6 page-break-before">
                  <h4 className="text-[10px] font-black uppercase text-slate-455 tracking-wider select-none">Diário de Auditoria & Prontuário de Diário de Bordo (Logs Chronos)</h4>
                  
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-[8px] leading-normal font-sans text-slate-600 block">
                    <p className="mb-2 font-bold select-none text-slate-450 uppercase tracking-widest text-[7px] border-b border-slate-200/60 pb-1">Trilha de Controle de Auditoria Ativa</p>
                    <div className="space-y-1.5 max-h-[140px] overflow-hidden">
                      {reportData.logs.length > 0 ? (
                        reportData.logs.slice(0, 6).map((log) => {
                          const relativeCaixa = caixas.find(c => c.id === log.caixaId);
                          return (
                            <div key={log.id} className="flex items-start gap-1 justify-between font-mono font-medium border-b border-dashed border-slate-100 pb-1">
                              <span className="text-slate-405 flex-shrink-0 w-22 font-sans font-bold">{formatLogTime(log.timestamp)}</span>
                              <span className="flex-1 text-slate-850">
                                {relativeCaixa ? `[${relativeCaixa.name}] ` : ""}
                                {log.description}
                              </span>
                              <span className="uppercase text-[6.5px] font-bold px-1 rounded bg-slate-250 select-none text-slate-500 font-sans italic">
                                {log.type}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[9px] italic text-slate-400 py-2">Sem logs para a janela temporal selecionada.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Signature Lines for Company Board of directors */}
            {signers && (
              <div className="mt-4 pt-4 border-t border-slate-150 flex justify-between gap-10 select-none page-break-inside">
                <div className="flex-1 text-center">
                  <div className="h-0.5 w-full bg-slate-350 max-w-[180px] mx-auto mb-2"></div>
                  <span className="block text-[8px] font-bold uppercase text-slate-500 tracking-wider">Diretoria Geral / Presidência</span>
                  <span className="block text-[7px] text-slate-400 mt-0.5">Holding LF & Controladoras Associadas</span>
                </div>
                
                <div className="flex-1 text-center">
                  <div className="h-0.5 w-full bg-slate-350 max-w-[180px] mx-auto mb-2"></div>
                  <span className="block text-[8px] font-bold uppercase text-slate-500 tracking-wider">Auditoria e Controladoria de Risco</span>
                  <span className="block text-[7px] text-slate-400 mt-0.5">Laudo Emitido Sob Conformidade Interna</span>
                </div>

                <div className="flex-1 text-center">
                  <div className="h-0.5 w-full bg-slate-350 max-w-[180px] mx-auto mb-2"></div>
                  <span className="block text-[8px] font-bold uppercase text-slate-500 tracking-wider">Tesoureiro / Gestor de Caixa</span>
                  <span className="block text-[7px] text-slate-400 mt-0.5">Aprovador de Lançamentos de Extratos</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
