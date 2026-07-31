import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building,
  Calculator,
  CheckCircle,
  FileText,
  PieChart,
  Printer,
  X
} from "lucide-react";

interface Transaction {
  id: string;
  caixaId?: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  date: string;
  category: string;
}

interface FixedTemplate {
  id: string;
  caixaId?: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  dueDay: number;
  status: "ativo" | "inativo";
}

interface RentalPaymentAdjustment {
  period: string;
  expectedAmount: number;
  receivedAmount: number;
  difference: number;
  status: "pending" | "forgiven" | "charged";
  dueDate: string;
  graceDate: string;
  receivedDate: string;
  daysAfterDue: number;
  daysAfterGrace: number;
  lateFeeStatus: "none" | "suggested" | "waived" | "charged";
  createdAt: string;
  note?: string;
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
  adminFeeAmount: number;
  adminFeePercent?: number;
  paidPeriods: string[];
  paymentDates?: Record<string, string>;
  paymentAmounts?: Record<string, number>;
  paymentAdjustments?: Record<string, RentalPaymentAdjustment>;
  hasDeposit?: boolean;
  depositMonthsCount?: number;
  depositAmount?: number;
  depositStartDate?: string;
  depositInterestRate?: number;
}

interface Category {
  id: string;
  name: string;
  type: "entrada" | "saida";
  color?: string;
}

interface AccountantReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  fixedTemplates: FixedTemplate[];
  rentals: RentalProperty[];
  categories: Category[];
  activeCaixa: { id: string; name: string };
  caixas: Array<{ id: string; name: string }>;
}

type PeriodMode = "mensal" | "anual" | "personalizado";
type ScopeMode = "caixa" | "consolidado";

const MONTHS_LIST = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" }
];

const CHART_COLORS = [
  "#4f46e5",
  "#0f766e",
  "#2563eb",
  "#9333ea",
  "#ea580c",
  "#be123c",
  "#0891b2",
  "#64748b",
  "#16a34a",
  "#ca8a04"
];

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2
  });
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatPeriod = (period: string) => {
  const [year, month] = period.split("-");
  const monthName = MONTHS_LIST.find(m => m.value === month)?.label || month;
  return `${monthName}/${year}`;
};

const getRentalExpectedAmount = (rental: RentalProperty) => {
  return rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
};

const getPeriodKeyFromDate = (date: string) => date.slice(0, 7);

export function AccountantReportModal({
  isOpen,
  onClose,
  transactions,
  fixedTemplates,
  rentals,
  categories,
  activeCaixa,
  caixas
}: AccountantReportModalProps) {
  const today = new Date();
  const todayStr = getLocalDateInputValue(today);
  const [scope, setScope] = useState<ScopeMode>("consolidado");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("anual");
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [customStartDate, setCustomStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [customTitle, setCustomTitle] = useState("Dossiê Contábil e Organizador IRPF");
  const [excludedExpenseCategories, setExcludedExpenseCategories] = useState<string[]>([]);
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeFixedAccounts, setIncludeFixedAccounts] = useState(true);
  const [includeRentals, setIncludeRentals] = useState(true);
  const [includeTaxChecklist, setIncludeTaxChecklist] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const yearsList = useMemo(() => {
    const years = new Set<string>([String(today.getFullYear()), String(today.getFullYear() - 1), String(today.getFullYear() + 1)]);
    transactions.forEach(t => {
      if (t.date?.length >= 4) years.add(t.date.slice(0, 4));
    });
    rentals.forEach(rental => {
      rental.paidPeriods?.forEach(period => years.add(period.slice(0, 4)));
      Object.keys(rental.paymentAdjustments || {}).forEach(period => years.add(period.slice(0, 4)));
    });
    return Array.from(years).filter(Boolean).sort((a, b) => Number(b) - Number(a));
  }, [rentals, today, transactions]);

  const expenseCategoryNames = useMemo(() => {
    const list = new Set<string>();
    categories.filter(c => c.type === "saida").forEach(c => list.add(c.name));
    transactions.filter(t => t.type === "saida" && t.category).forEach(t => list.add(t.category));
    fixedTemplates.filter(t => t.type === "saida" && t.category).forEach(t => list.add(t.category));
    return Array.from(list).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, fixedTemplates, transactions]);

  const periodInfo = useMemo(() => {
    if (periodMode === "mensal") {
      const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
      const monthLabel = MONTHS_LIST.find(m => m.value === selectedMonth)?.label || selectedMonth;
      return {
        startDate: `${selectedYear}-${selectedMonth}-01`,
        endDate: `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`,
        label: `${monthLabel} de ${selectedYear}`,
        startPeriod: `${selectedYear}-${selectedMonth}`,
        endPeriod: `${selectedYear}-${selectedMonth}`
      };
    }

    if (periodMode === "personalizado") {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `${formatDate(customStartDate)} a ${formatDate(customEndDate)}`,
        startPeriod: customStartDate.slice(0, 7),
        endPeriod: customEndDate.slice(0, 7)
      };
    }

    return {
      startDate: `${selectedYear}-01-01`,
      endDate: `${selectedYear}-12-31`,
      label: `Ano-calendário ${selectedYear}`,
      startPeriod: `${selectedYear}-01`,
      endPeriod: `${selectedYear}-12`
    };
  }, [customEndDate, customStartDate, periodMode, selectedMonth, selectedYear]);

  const isDateInRange = (date: string) => {
    if (!date) return false;
    const normalized = date.slice(0, 10);
    return normalized >= periodInfo.startDate && normalized <= periodInfo.endDate;
  };

  const isPeriodInRange = (period: string) => {
    return period >= periodInfo.startPeriod && period <= periodInfo.endPeriod;
  };

  const isExpenseCategoryIncluded = (category: string) => !excludedExpenseCategories.includes(category);

  const reportData = useMemo(() => {
    const scopeMatches = (caixaId?: string) => scope === "consolidado" || caixaId === activeCaixa.id;
    const inPeriodTxs = transactions
      .filter(t => scopeMatches(t.caixaId))
      .filter(t => isDateInRange(t.date));

    const incomeTxs = inPeriodTxs.filter(t => t.type === "entrada");
    const allExpenseTxs = inPeriodTxs.filter(t => t.type === "saida");
    const expenseTxs = allExpenseTxs.filter(t => isExpenseCategoryIncluded(t.category));

    const incomeTotal = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
    const ignoredExpenseTotal = allExpenseTxs
      .filter(t => !isExpenseCategoryIncluded(t.category))
      .reduce((sum, t) => sum + t.amount, 0);

    const summarizeByCategory = (items: Transaction[]) => {
      const grouped = new Map<string, { name: string; total: number; count: number; color: string }>();
      items.forEach(t => {
        const current = grouped.get(t.category) || {
          name: t.category || "Sem categoria",
          total: 0,
          count: 0,
          color: categories.find(c => c.name === t.category)?.color || ""
        };
        current.total += t.amount;
        current.count += 1;
        grouped.set(current.name, current);
      });

      const total = items.reduce((sum, t) => sum + t.amount, 0);
      return Array.from(grouped.values())
        .map((item, index) => ({
          ...item,
          percentage: total > 0 ? Math.round((item.total / total) * 1000) / 10 : 0,
          chartColor: CHART_COLORS[index % CHART_COLORS.length]
        }))
        .sort((a, b) => b.total - a.total);
    };

    const expenseCategories = summarizeByCategory(expenseTxs);
    const incomeCategories = summarizeByCategory(incomeTxs);

    const flowGrouped = new Map<string, { period: string; entrada: number; saida: number }>();
    inPeriodTxs.forEach(t => {
      if (t.type === "saida" && !isExpenseCategoryIncluded(t.category)) return;
      const period = getPeriodKeyFromDate(t.date);
      const current = flowGrouped.get(period) || { period, entrada: 0, saida: 0 };
      if (t.type === "entrada") current.entrada += t.amount;
      if (t.type === "saida") current.saida += t.amount;
      flowGrouped.set(period, current);
    });

    const monthlyFlow = Array.from(flowGrouped.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(row => ({
        ...row,
        saldo: row.entrada - row.saida
      }));

    const fixedRows = fixedTemplates
      .filter(tpl => scopeMatches(tpl.caixaId))
      .filter(tpl => tpl.type === "entrada" || isExpenseCategoryIncluded(tpl.category))
      .sort((a, b) => a.dueDay - b.dueDay || a.description.localeCompare(b.description, "pt-BR"));

    const rentalRows = rentals
      .filter(rental => scopeMatches(rental.caixaId))
      .flatMap(rental => {
        const periodSet = new Set<string>([
          ...(rental.paidPeriods || []),
          ...Object.keys(rental.paymentAmounts || {}),
          ...Object.keys(rental.paymentAdjustments || {})
        ]);

        if (periodMode === "mensal") {
          periodSet.add(`${selectedYear}-${selectedMonth}`);
        }

        return Array.from(periodSet)
          .filter(period => isPeriodInRange(period))
          .sort()
          .map(period => {
            const adjustment = rental.paymentAdjustments?.[period];
            const expectedAmount = adjustment?.expectedAmount ?? getRentalExpectedAmount(rental);
            const isPaid = rental.paidPeriods?.includes(period) || Boolean(adjustment);
            const receivedAmount = adjustment?.receivedAmount ?? rental.paymentAmounts?.[period] ?? (isPaid ? expectedAmount : 0);
            const difference = adjustment?.difference ?? Math.max(expectedAmount - receivedAmount, 0);
            const pendingDifference = adjustment?.status === "pending" && difference > 0 ? difference : 0;
            const paymentDate = adjustment?.receivedDate || rental.paymentDates?.[period] || "";
            const lateStatus = !isPaid
              ? "Em aberto"
              : adjustment?.daysAfterGrace && adjustment.daysAfterGrace > 0
                ? adjustment.lateFeeStatus === "waived"
                  ? "Atraso aliviado"
                  : "Avaliar multa"
                : adjustment?.daysAfterDue && adjustment.daysAfterDue > 0
                  ? "Dentro da tolerância"
                  : "No prazo";

            return {
              rental,
              period,
              expectedAmount,
              receivedAmount,
              difference,
              pendingDifference,
              isPaid,
              paymentDate,
              daysAfterDue: adjustment?.daysAfterDue || 0,
              daysAfterGrace: adjustment?.daysAfterGrace || 0,
              statusLabel: isPaid ? "Recebido" : "Pendente",
              lateStatus
            };
          });
      });

    const rentalExpectedTotal = rentalRows.reduce((sum, row) => sum + row.expectedAmount, 0);
    const rentalReceivedTotal = rentalRows.reduce((sum, row) => sum + row.receivedAmount, 0);
    const rentalPendingTotal = rentalRows.reduce((sum, row) => sum + (!row.isPaid ? row.expectedAmount : row.pendingDifference), 0);
    const rentalLateAlerts = rentalRows.filter(row => row.daysAfterGrace > 0 && row.lateStatus === "Avaliar multa").length;

    return {
      inPeriodTxs,
      incomeTxs,
      expenseTxs,
      incomeTotal,
      expenseTotal,
      ignoredExpenseTotal,
      netTotal: incomeTotal - expenseTotal,
      expenseCategories,
      incomeCategories,
      monthlyFlow,
      fixedRows,
      rentalRows,
      rentalExpectedTotal,
      rentalReceivedTotal,
      rentalPendingTotal,
      rentalLateAlerts
    };
  }, [
    activeCaixa.id,
    categories,
    excludedExpenseCategories,
    fixedTemplates,
    periodInfo,
    periodMode,
    rentals,
    scope,
    selectedMonth,
    selectedYear,
    transactions
  ]);

  if (!isOpen) return null;

  const selectedExpenseCount = expenseCategoryNames.length - excludedExpenseCategories.length;
  const maxExpenseCategoryTotal = Math.max(...reportData.expenseCategories.map(item => item.total), 0);
  const maxMonthlyTotal = Math.max(...reportData.monthlyFlow.map(item => Math.max(item.entrada, item.saida)), 0);
  const reportScopeLabel = scope === "consolidado" ? `Consolidado (${caixas.length} caixas)` : activeCaixa.name;
  const detailedTransactions = [...reportData.inPeriodTxs]
    .filter(t => t.type === "entrada" || isExpenseCategoryIncluded(t.category))
    .sort((a, b) => b.date.localeCompare(a.date));

  const toggleExpenseCategory = (category: string) => {
    setExcludedExpenseCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(item => item !== category);
      }
      return [...prev, category];
    });
  };

  return (
    <div className="accountant-modal-shell fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-start justify-start 2xl:justify-center p-3 md:p-6 overflow-auto">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          html,
          body,
          #root {
            background: white !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          body > #root > div > *:not(:has(#print-accountant-report)),
          body *:not(:has(#print-accountant-report)):not(#print-accountant-report):not(#print-accountant-report *) {
            display: none !important;
          }

          body *:has(#print-accountant-report) {
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

          #print-accountant-report,
          #print-accountant-report * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .accountant-modal-shell,
          .accountant-report-shell {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: 0 !important;
          }

          #print-accountant-report {
            position: static !important;
            width: 297mm !important;
            max-width: 297mm !important;
            min-height: 210mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            color: #0f172a !important;
            background: white !important;
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }

          .accountant-no-print {
            display: none !important;
          }

          .accountant-paper {
            width: 297mm !important;
            max-width: 297mm !important;
            min-height: 210mm !important;
          }

          .accountant-section {
            break-inside: auto;
            page-break-inside: auto;
          }

          .accountant-card,
          .accountant-chart-box {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #print-accountant-report table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          #print-accountant-report thead {
            display: table-header-group;
          }

          #print-accountant-report tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #print-accountant-report th,
          #print-accountant-report td {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            overflow: visible !important;
          }

          #print-accountant-report .overflow-x-auto,
          #print-accountant-report .overflow-y-auto,
          #print-accountant-report .overflow-hidden {
            overflow: visible !important;
          }

          #print-accountant-report svg {
            display: block !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="accountant-report-shell w-max max-w-none flex flex-col xl:flex-row gap-4">
        <aside className="accountant-no-print w-full xl:w-[330px] shrink-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 h-fit max-h-[42vh] xl:max-h-none overflow-y-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500">Relatório PDF</p>
              <h2 className="text-lg font-black text-slate-900">Contábil / IR</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              aria-label="Fechar relatório contábil"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Título</span>
              <input
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("consolidado")}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                  scope === "consolidado" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Consolidado
              </button>
              <button
                type="button"
                onClick={() => setScope("caixa")}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                  scope === "caixa" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Caixa ativo
              </button>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Período</span>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {(["mensal", "anual", "personalizado"] as PeriodMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPeriodMode(mode)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-black capitalize ${
                      periodMode === mode ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {periodMode !== "personalizado" ? (
              <div className="grid grid-cols-2 gap-2">
                {periodMode === "mensal" && (
                  <label>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Mês</span>
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                    >
                      {MONTHS_LIST.map(month => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={periodMode === "anual" ? "col-span-2" : ""}>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Ano</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                  >
                    {yearsList.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Início</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                  />
                </label>
                <label>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Fim</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                  />
                </label>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Seções do PDF</span>
                <span className="text-[10px] font-bold text-slate-400">A4 paisagem</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-700">
                {[
                  ["Resumo executivo", includeExecutiveSummary, setIncludeExecutiveSummary],
                  ["Gráficos e comparativos", includeCharts, setIncludeCharts],
                  ["Extrato detalhado", includeTransactions, setIncludeTransactions],
                  ["Contas fixas", includeFixedAccounts, setIncludeFixedAccounts],
                  ["Aluguéis e repasses", includeRentals, setIncludeRentals],
                  ["Checklist IR/contador", includeTaxChecklist, setIncludeTaxChecklist],
                  ["Assinaturas", includeSignatures, setIncludeSignatures]
                ].map(([label, checked, setter]) => (
                  <label key={String(label)} className="flex items-center gap-2 rounded-xl bg-white border border-slate-100 px-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(event) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold">{String(label)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Despesas que entram</span>
                  <p className="text-[11px] text-slate-500">{selectedExpenseCount} de {expenseCategoryNames.length} categorias incluídas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExcludedExpenseCategories([])}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800"
                >
                  Todas
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                {expenseCategoryNames.map(category => (
                  <label key={category} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={isExpenseCategoryIncluded(category)}
                      onChange={() => toggleExpenseCategory(category)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-semibold text-slate-600">{category}</span>
                  </label>
                ))}
                {expenseCategoryNames.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Cadastre despesas para selecionar categorias.</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-800 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-900/20 hover:from-slate-800 hover:to-indigo-700 flex items-center justify-center gap-2"
            >
              <Printer size={17} />
              Imprimir / Salvar PDF
            </button>
          </div>
        </aside>

        <main id="print-accountant-report" className="accountant-paper w-[297mm] min-w-[297mm] max-w-none bg-white rounded-2xl shadow-2xl border border-slate-200 p-[8mm]">
          <header className="accountant-section flex flex-col md:flex-row md:items-start md:justify-between gap-5 border-b border-slate-200 pb-5 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700">
                <FileText size={13} />
                Dossiê financeiro
              </div>
              <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-950">{customTitle || "Dossiê Contábil e Organizador IRPF"}</h1>
              <p className="mt-2 text-sm text-slate-600 max-w-3xl">
                Relatório profissional para conferência financeira, preparação de documentos contábeis e organização prévia da declaração de imposto de renda.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 min-w-[250px]">
              <p><strong>Período:</strong> {periodInfo.label}</p>
              <p><strong>Escopo:</strong> {reportScopeLabel}</p>
              <p><strong>Emitido em:</strong> {formatDate(todayStr)}</p>
              <p><strong>Caixa ativo:</strong> {activeCaixa.name}</p>
            </div>
          </header>

          {includeExecutiveSummary && (
            <section className="accountant-section mb-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="accountant-card rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Entradas</p>
                  <p className="text-2xl font-black text-emerald-800 mt-2">{formatCurrency(reportData.incomeTotal)}</p>
                  <p className="text-xs text-emerald-700/80 mt-1">{reportData.incomeTxs.length} lançamentos no período</p>
                </div>
                <div className="accountant-card rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-rose-700">Despesas selecionadas</p>
                  <p className="text-2xl font-black text-rose-800 mt-2">{formatCurrency(reportData.expenseTotal)}</p>
                  <p className="text-xs text-rose-700/80 mt-1">{reportData.expenseTxs.length} lançamentos incluídos</p>
                </div>
                <div className={`accountant-card rounded-2xl border p-4 ${reportData.netTotal >= 0 ? "border-indigo-100 bg-indigo-50" : "border-amber-100 bg-amber-50"}`}>
                  <p className={`text-[10px] uppercase tracking-widest font-black ${reportData.netTotal >= 0 ? "text-indigo-700" : "text-amber-700"}`}>Saldo apurado</p>
                  <p className={`text-2xl font-black mt-2 ${reportData.netTotal >= 0 ? "text-indigo-800" : "text-amber-800"}`}>{formatCurrency(reportData.netTotal)}</p>
                  <p className="text-xs text-slate-600 mt-1">Resultado com filtros atuais</p>
                </div>
                <div className="accountant-card rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-600">Aluguéis / repasses</p>
                  <p className="text-2xl font-black text-slate-900 mt-2">{formatCurrency(reportData.rentalReceivedTotal)}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(reportData.rentalPendingTotal)} pendente/a cobrar</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2 text-slate-800 font-black text-sm">
                    <Calculator size={17} className="text-indigo-600" />
                    Conferência contábil
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Entradas, saídas, despesas excluídas do dossiê e saldo foram calculados pelo período e escopo escolhidos.
                  </p>
                  {reportData.ignoredExpenseTotal > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-2 py-1">
                      {formatCurrency(reportData.ignoredExpenseTotal)} em despesas ficaram fora por filtro de categoria.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2 text-slate-800 font-black text-sm">
                    <Building size={17} className="text-teal-600" />
                    Imobiliária
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O relatório separa esperado, recebido, diferença de repasse e alertas de atraso considerando a tolerância operacional de 2 dias.
                  </p>
                  {reportData.rentalLateAlerts > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-2 py-1">
                      {reportData.rentalLateAlerts} repasse(s) pedem avaliação de multa.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2 text-slate-800 font-black text-sm">
                    <CheckCircle size={17} className="text-emerald-600" />
                    Pronto para análise
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Leve este PDF ao contador junto com informes, comprovantes e documentos fiscais originais para validação.
                  </p>
                </div>
              </div>
            </section>
          )}

          {includeCharts && (
            <section className="accountant-section mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 size={19} className="text-indigo-600" />
                  Gráficos e Comparativos
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold">Base: categorias incluídas no relatório</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="accountant-chart-box rounded-2xl border border-slate-200 p-4 bg-white">
                  <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                    <PieChart size={16} className="text-rose-600" />
                    Despesas por categoria
                  </h3>
                  <div className="space-y-3">
                    {reportData.expenseCategories.slice(0, 10).map((item) => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between gap-3 text-xs mb-1">
                          <span className="font-bold text-slate-700">{item.name}</span>
                          <span className="font-mono font-black text-slate-800">{formatCurrency(item.total)} · {item.percentage}%</span>
                        </div>
                        <svg className="h-3 w-full" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                          <rect x="0" y="0" width="100" height="10" rx="5" fill="#e2e8f0" />
                          <rect
                            x="0"
                            y="0"
                            width={maxExpenseCategoryTotal > 0 ? Math.max((item.total / maxExpenseCategoryTotal) * 100, 3) : 0}
                            height="10"
                            rx="5"
                            fill={item.chartColor}
                          />
                        </svg>
                      </div>
                    ))}
                    {reportData.expenseCategories.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Nenhuma despesa incluída no período.</p>
                    )}
                  </div>
                </div>

                <div className="accountant-chart-box rounded-2xl border border-slate-200 p-4 bg-white">
                  <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-600" />
                    Fluxo mensal
                  </h3>
                  <div className="space-y-3">
                    {reportData.monthlyFlow.map(item => (
                      <div key={item.period} className="grid grid-cols-[78px_1fr_92px] gap-3 items-center text-xs">
                        <span className="font-black text-slate-600">{formatPeriod(item.period)}</span>
                        <div className="space-y-1">
                          <svg className="h-2.5 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-label="Entradas do mês">
                            <rect x="0" y="0" width="100" height="8" rx="4" fill="#d1fae5" />
                            <rect
                              x="0"
                              y="0"
                              width={maxMonthlyTotal > 0 ? Math.max((item.entrada / maxMonthlyTotal) * 100, 2) : 0}
                              height="8"
                              rx="4"
                              fill="#10b981"
                            />
                          </svg>
                          <svg className="h-2.5 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-label="Saídas do mês">
                            <rect x="0" y="0" width="100" height="8" rx="4" fill="#ffe4e6" />
                            <rect
                              x="0"
                              y="0"
                              width={maxMonthlyTotal > 0 ? Math.max((item.saida / maxMonthlyTotal) * 100, 2) : 0}
                              height="8"
                              rx="4"
                              fill="#f43f5e"
                            />
                          </svg>
                        </div>
                        <span className={`text-right font-black ${item.saldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(item.saldo)}</span>
                      </div>
                    ))}
                    {reportData.monthlyFlow.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Sem movimentação financeira no período.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="accountant-section mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-wide">Resumo de despesas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-[44%]">Categoria</th>
                      <th className="px-3 py-2 text-right w-[24%]">Total</th>
                      <th className="px-3 py-2 text-center w-[16%]">Qtde</th>
                      <th className="px-3 py-2 text-right w-[16%]">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.expenseCategories.map(item => (
                      <tr key={item.name}>
                        <td className="px-3 py-2 font-bold text-slate-700">{item.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{item.count}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{item.percentage}%</td>
                      </tr>
                    ))}
                    {reportData.expenseCategories.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-400 italic">Nenhuma despesa selecionada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-emerald-700 text-white px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-wide">Resumo de entradas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-[44%]">Categoria</th>
                      <th className="px-3 py-2 text-right w-[24%]">Total</th>
                      <th className="px-3 py-2 text-center w-[16%]">Qtde</th>
                      <th className="px-3 py-2 text-right w-[16%]">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.incomeCategories.map(item => (
                      <tr key={item.name}>
                        <td className="px-3 py-2 font-bold text-slate-700">{item.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{item.count}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{item.percentage}%</td>
                      </tr>
                    ))}
                    {reportData.incomeCategories.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-400 italic">Nenhuma entrada registrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {includeRentals && (
            <section className="accountant-section mb-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-indigo-900 text-white px-4 py-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-wide">Aluguéis, repasses e diferenças a cobrar</h2>
                <span className="text-[11px] font-bold text-indigo-100">Tolerância de repasse: 2 dias após vencimento</span>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200 bg-indigo-50 text-xs">
                <div className="p-3">
                  <p className="font-black text-indigo-700 uppercase">Esperado</p>
                  <p className="text-lg font-black text-indigo-950">{formatCurrency(reportData.rentalExpectedTotal)}</p>
                </div>
                <div className="p-3 border-l border-indigo-100">
                  <p className="font-black text-emerald-700 uppercase">Recebido</p>
                  <p className="text-lg font-black text-emerald-800">{formatCurrency(reportData.rentalReceivedTotal)}</p>
                </div>
                <div className="p-3 border-l border-indigo-100">
                  <p className="font-black text-rose-700 uppercase">Pendente / cobrar</p>
                  <p className="text-lg font-black text-rose-800">{formatCurrency(reportData.rentalPendingTotal)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-[8%]">LF</th>
                      <th className="px-3 py-2 text-left w-[21%]">Inquilino</th>
                      <th className="px-3 py-2 text-left w-[10%]">Compet.</th>
                      <th className="px-3 py-2 text-right w-[13%]">Esperado</th>
                      <th className="px-3 py-2 text-right w-[13%]">Recebido</th>
                      <th className="px-3 py-2 text-right w-[12%]">Diferença</th>
                      <th className="px-3 py-2 text-left w-[23%]">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.rentalRows.map(row => (
                      <tr key={`${row.rental.id}-${row.period}`}>
                        <td className="px-3 py-2 font-black text-indigo-700">{row.rental.lfCode}</td>
                        <td className="px-3 py-2">
                          <p className="font-bold text-slate-800">{row.rental.tenantName}</p>
                          <p className="text-slate-400">{row.rental.address}</p>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">{formatPeriod(row.period)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-700">{formatCurrency(row.expectedAmount)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{row.isPaid ? formatCurrency(row.receivedAmount) : "-"}</td>
                        <td className={`px-3 py-2 text-right font-mono font-black ${row.difference > 0 ? "text-rose-700" : "text-slate-400"}`}>{row.difference > 0 ? formatCurrency(row.difference) : "-"}</td>
                        <td className="px-3 py-2">
                          <p className={`font-black ${row.isPaid ? "text-emerald-700" : "text-rose-700"}`}>{row.statusLabel}</p>
                          <p className="text-slate-500">
                            {row.isPaid ? `Pago em ${formatDate(row.paymentDate)} · ${row.lateStatus}` : "Ainda não recebido no período"}
                          </p>
                          {row.daysAfterGrace > 0 && (
                            <p className="mt-1 text-[10px] text-rose-700 font-bold">Ultrapassou a tolerância em {row.daysAfterGrace} dia(s).</p>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reportData.rentalRows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400 italic">Nenhum repasse de aluguel encontrado no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {includeFixedAccounts && (
            <section className="accountant-section mb-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-wide">Contas fixas e modelos recorrentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-[42%]">Descrição</th>
                      <th className="px-3 py-2 text-left w-[18%]">Categoria</th>
                      <th className="px-3 py-2 text-center w-[11%]">Tipo</th>
                      <th className="px-3 py-2 text-center w-[11%]">Dia</th>
                      <th className="px-3 py-2 text-right w-[18%]">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.fixedRows.map(row => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-bold text-slate-800">{row.description}</td>
                        <td className="px-3 py-2 text-slate-600">{row.category}</td>
                        <td className={`px-3 py-2 text-center font-black ${row.type === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{row.type === "entrada" ? "Entrada" : "Saída"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">Dia {row.dueDay}</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-slate-800">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                    {reportData.fixedRows.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-5 text-center text-slate-400 italic">Nenhuma conta fixa incluída.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {includeTaxChecklist && (
            <section className="accountant-section mb-6 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/70 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-700" />
                <h2 className="text-sm font-black uppercase tracking-wide text-amber-900">Checklist para contador / IRPF</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 text-xs text-amber-950">
                {[
                  "Conferir informes de rendimentos de bancos, empresas, aposentadoria, pró-labore, salários e aplicações.",
                  "Separar comprovantes de aluguel, recibos da imobiliária, taxas de administração, IPTU, condomínio e diferenças de repasse.",
                  "Anexar despesas médicas, educação, previdência, pensão, dependentes e demais documentos aceitos apenas quando houver comprovante formal.",
                  "Verificar Carnê-Leão/DARF quando houver recebimentos sujeitos a recolhimento mensal, especialmente aluguéis de pessoa física.",
                  "Revisar bens, direitos e dívidas: imóveis, veículos, financiamentos, empréstimos, saldos bancários e aplicações em 31/12.",
                  "Validar com o contador quais categorias deste relatório entram como dedutíveis, custo, controle patrimonial ou apenas organização financeira."
                ].map(item => (
                  <div key={item} className="flex gap-2 rounded-xl border border-amber-200 bg-white/70 p-3">
                    <CheckCircle size={15} className="text-amber-700 mt-0.5 shrink-0" />
                    <p className="leading-relaxed font-semibold">{item}</p>
                  </div>
                ))}
              </div>
              <p className="px-4 pb-4 text-[11px] text-amber-800 leading-relaxed">
                Observação: este relatório organiza informações financeiras para análise. A classificação fiscal final deve ser validada no programa da Receita Federal e/ou por profissional contábil.
              </p>
            </section>
          )}

          {includeTransactions && (
            <section className="accountant-section mb-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-wide">Extrato detalhado do período</h2>
                <span className="text-[11px] font-bold text-slate-300">{detailedTransactions.length} lançamento(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-[10%]">Data</th>
                      <th className="px-3 py-2 text-left w-[34%]">Descrição</th>
                      <th className="px-3 py-2 text-left w-[20%]">Categoria</th>
                      <th className="px-3 py-2 text-center w-[12%]">Tipo</th>
                      <th className="px-3 py-2 text-right w-[12%]">Entrada</th>
                      <th className="px-3 py-2 text-right w-[12%]">Saída</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailedTransactions.map(row => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-mono text-slate-600">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.description}</td>
                        <td className="px-3 py-2 text-slate-600">{row.category}</td>
                        <td className={`px-3 py-2 text-center font-black ${row.type === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{row.type === "entrada" ? "Entrada" : "Saída"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{row.type === "entrada" ? formatCurrency(row.amount) : "-"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">{row.type === "saida" ? formatCurrency(row.amount) : "-"}</td>
                      </tr>
                    ))}
                    {detailedTransactions.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400 italic">Nenhum lançamento encontrado com os filtros atuais.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {includeSignatures && (
            <footer className="accountant-section pt-8 grid grid-cols-2 gap-12 text-xs text-slate-600">
              <div className="border-t border-slate-300 pt-3">
                <p className="font-black text-slate-900">Responsável pelo caixa</p>
                <p>Assinatura e conferência</p>
              </div>
              <div className="border-t border-slate-300 pt-3">
                <p className="font-black text-slate-900">Contador / Conferente</p>
                <p>Análise documental e fiscal</p>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
