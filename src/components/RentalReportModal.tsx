import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Printer, 
  Building, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  Lock, 
  Sparkles,
  FileText,
  DollarSign,
  TrendingUp,
  Percent
} from "lucide-react";

interface RentalProperty {
  id: string;
  caixaId: string;
  lfCode: string; // Código do Imóvel ex: LF01
  tenantName: string;
  address: string;
  dueDay: number;
  rentAmount: number; // Aluguel
  waterAmount: number; // Água
  iptuAmount: number; // IPTU
  garbageAmount: number; // Lixo
  lightAmount: number; // Luz
  fineAmount: number; // Multa (se houver)
  adminFeeAmount: number; // Taxa de Administração Imobiliária
  adminFeePercent?: number; // Percentual de Administração
  paidPeriods: string[]; // Lista de competências pagas ("YYYY-MM")
  paymentDates?: Record<string, string>; // Mapeia período ("YYYY-MM") para data de recebimento efetivo ("YYYY-MM-DD")
  paymentAmounts?: Record<string, number>;
  paymentAdjustments?: Record<string, RentalPaymentAdjustment>;
  hasDeposit?: boolean;
  depositMonthsCount?: number;
  depositAmount?: number;
  depositStartDate?: string;
  depositInterestRate?: number;
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

interface RentalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rentals: RentalProperty[];
  activeCaixa: { id: string; name: string };
  caixas: Array<{ id: string; name: string }>;
  initialSelectedRentalId?: string | null;
}

// Helpers for months calculation (for compound deposits)
function calculateMonthsDifference(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
  
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthsDiff = endDate.getMonth() - startDate.getMonth();
  const totalMonths = (yearsDiff * 12) + monthsDiff;
  return totalMonths < 0 ? 0 : totalMonths;
}

const MONTHS_MAP: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
};

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRentalExpectedAmount = (rental: RentalProperty) => {
  return rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
};

const getPendingRentalCarryover = (rental: RentalProperty, currentPeriod: string) => {
  return Object.values(rental.paymentAdjustments || {})
    .filter(adj => adj.status === "pending" && adj.difference > 0 && adj.period < currentPeriod)
    .reduce((sum, adj) => sum + adj.difference, 0);
};

const YEARS_LIST = ["2024", "2025", "2026", "2027"];
const MONTHS_LIST = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

export function RentalReportModal({
  isOpen,
  onClose,
  rentals,
  activeCaixa,
  caixas,
  initialSelectedRentalId = null
}: RentalReportModalProps) {
  const todayStr = getLocalDateInputValue();

  // Filters state inside the Modal for ultra customization
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return String(new Date().getMonth() + 1).padStart(2, "0");
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });
  const [scope, setScope] = useState<"caixa" | "consolidado">("consolidado");
  const [filterRentalId, setFilterRentalId] = useState<string>("todos");
  const [contractFilter, setContractFilter] = useState<"todos" | "quitados" | "pendentes" | "com_caucao">("todos");
  
  const [customTitle, setCustomTitle] = useState("Relatório de Cobrança de Aluguéis - Imobiliária");
  const [showAdminFees, setShowAdminFees] = useState(true);
  const [showDepositSummary, setShowDepositSummary] = useState(false);
  const [showSignatures, setShowSignatures] = useState(true);

  const activePeriod = `${selectedYear}-${selectedMonth}`;
  const displayPeriodStr = `${MONTHS_MAP[selectedMonth]} de ${selectedYear}`;

  // Sync initialSelectedRentalId from prop
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedRentalId) {
        setFilterRentalId(initialSelectedRentalId);
      } else {
        setFilterRentalId("todos");
      }
    }
  }, [isOpen, initialSelectedRentalId]);

  // Dynamically update custom title based on chosen contract filter
  useEffect(() => {
    if (filterRentalId === "todos") {
      setCustomTitle("Relatório de Cobrança de Aluguéis - Imobiliária");
    } else {
      const selectedProperty = rentals.find(r => r.id === filterRentalId);
      if (selectedProperty) {
        setCustomTitle(`Relatório de Cobrança: ${selectedProperty.lfCode} - ${selectedProperty.tenantName}`);
      } else {
        setCustomTitle("Relatório Individual de Cobrança de Aluguel");
      }
    }
  }, [filterRentalId, rentals]);

  // Filter rentals based on chosen scope
  const scopedRentals = useMemo(() => {
    let list = rentals;
    if (scope === "caixa") {
      list = rentals.filter(r => r.caixaId === activeCaixa.id);
    }
    
    // Apply status/characteristic filtering
    if (contractFilter === "quitados") {
      list = list.filter(r => r.paidPeriods.includes(activePeriod));
    } else if (contractFilter === "pendentes") {
      list = list.filter(r => !r.paidPeriods.includes(activePeriod));
    } else if (contractFilter === "com_caucao") {
      list = list.filter(r => r.hasDeposit);
    }

    // Filter by specific rental
    if (filterRentalId && filterRentalId !== "todos") {
      list = list.filter(r => r.id === filterRentalId);
    }
    
    return list;
  }, [rentals, scope, activeCaixa.id, activePeriod, contractFilter, filterRentalId]);

  // Calculations
  const stats = useMemo(() => {
    // We always calculate status relative to the current active period
    let relevantRentals = scope === "caixa" 
      ? rentals.filter(r => r.caixaId === activeCaixa.id) 
      : rentals;

    if (filterRentalId && filterRentalId !== "todos") {
      relevantRentals = relevantRentals.filter(r => r.id === filterRentalId);
    }

    const totalCount = relevantRentals.length;
    const paidList = relevantRentals.filter(r => r.paidPeriods.includes(activePeriod));
    const pendingList = relevantRentals.filter(r => !r.paidPeriods.includes(activePeriod));
    
    const paidCount = paidList.length;
    const pendingCount = pendingList.length;

    const rateAdimplencia = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

    // Financial totals
    const totalExpectedLiquid = relevantRentals.reduce((sum, r) => {
      const gross = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount;
      const net = gross - r.adminFeeAmount;
      return sum + net;
    }, 0);

    const totalRealizedLiquid = paidList.reduce((sum, r) => {
      const gross = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount;
      const net = gross - r.adminFeeAmount;
      return sum + net;
    }, 0);

    const totalPendingLiquid = pendingList.reduce((sum, r) => {
      const gross = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount;
      const net = gross - r.adminFeeAmount;
      return sum + net;
    }, 0);

    // Sum of admin fees
    const totalAdminFees = relevantRentals.reduce((sum, r) => sum + r.adminFeeAmount, 0);

    return {
      totalCount,
      paidCount,
      pendingCount,
      rateAdimplencia,
      totalExpectedLiquid,
      totalRealizedLiquid,
      totalPendingLiquid,
      totalAdminFees
    };
  }, [rentals, scope, activeCaixa.id, activePeriod, filterRentalId]);

  // Deposits calculations
  const depositStats = useMemo(() => {
    let relevantRentals = scope === "caixa" 
      ? rentals.filter(r => r.caixaId === activeCaixa.id) 
      : rentals;

    if (filterRentalId && filterRentalId !== "todos") {
      relevantRentals = relevantRentals.filter(r => r.id === filterRentalId);
    }
    
    const withDeposit = relevantRentals.filter(r => r.hasDeposit);
    const sumOriginal = withDeposit.reduce((sum, r) => sum + (r.depositAmount || 0), 0);
    
    const sumToday = withDeposit.reduce((sum, r) => {
      if (!r.depositAmount) return sum;
      const months = calculateMonthsDifference(r.depositStartDate || todayStr, todayStr);
      const interestRate = r.depositInterestRate || 0.5;
      const compoundFactor = Math.pow(1 + (interestRate / 100), months);
      return sum + (r.depositAmount * compoundFactor);
    }, 0);

    return {
      count: withDeposit.length,
      sumOriginal,
      sumToday,
      accruedInterest: sumToday - sumOriginal
    };
  }, [rentals, scope, activeCaixa.id, todayStr, filterRentalId]);

  const rentalRows = useMemo(() => {
    const today = new Date(`${todayStr}T12:00:00`);
    const maxDays = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();

    return scopedRentals
      .map(rental => {
        const isPaid = rental.paidPeriods.includes(activePeriod);
        const actualDueDay = Math.min(rental.dueDay, maxDays);
        const dueDateStr = `${selectedYear}-${selectedMonth}-${String(actualDueDay).padStart(2, "0")}`;
        const dueDate = new Date(`${dueDateStr}T12:00:00`);
        const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const grossAmount = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount;
        const netAmount = getRentalExpectedAmount(rental);
        const paymentDate = rental.paymentDates?.[activePeriod] || "";
        const receivedAmount = rental.paymentAmounts?.[activePeriod] ?? (isPaid ? netAmount : 0);
        const adjustment = rental.paymentAdjustments?.[activePeriod];
        const carryoverAmount = getPendingRentalCarryover(rental, activePeriod);
        const currentShortfall = adjustment?.status === "pending" && (adjustment?.difference || 0) > 0 ? adjustment.difference : 0;
        const amountToCollect = isPaid ? carryoverAmount + currentShortfall : netAmount + carryoverAmount;

        let statusLabel = "A vencer";
        let statusTone = "slate";
        let sortBucket = 2;

        if (isPaid) {
          statusLabel = "Recebido";
          statusTone = "emerald";
          sortBucket = 3;
        } else if (daysDiff > 0) {
          statusLabel = `${daysDiff} ${daysDiff === 1 ? "dia" : "dias"} em atraso`;
          statusTone = "rose";
          sortBucket = 0;
        } else if (daysDiff === 0) {
          statusLabel = "Vence hoje";
          statusTone = "amber";
          sortBucket = 1;
        } else {
          statusLabel = `Vence em ${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? "dia" : "dias"}`;
          statusTone = "sky";
          sortBucket = 2;
        }

        return {
          rental,
          isPaid,
          dueDateStr,
          daysDiff,
          grossAmount,
          netAmount,
          paymentDate,
          receivedAmount,
          adjustment,
          carryoverAmount,
          currentShortfall,
          amountToCollect,
          statusLabel,
          statusTone,
          sortBucket
        };
      })
      .sort((a, b) => {
        if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
        if (!a.isPaid && !b.isPaid) return b.daysDiff - a.daysDiff;
        return a.rental.lfCode.localeCompare(b.rental.lfCode, "pt-BR", { numeric: true });
      });
  }, [scopedRentals, activePeriod, selectedYear, selectedMonth, todayStr]);

  const paidRows = rentalRows.filter(row => row.isPaid);
  const pendingRows = rentalRows.filter(row => !row.isPaid);
  const collectionRows = rentalRows.filter(row => row.amountToCollect > 0 && (!row.isPaid || row.carryoverAmount > 0 || row.currentShortfall > 0));
  const expectedReceivedTotal = paidRows.reduce((sum, row) => sum + row.netAmount, 0);
  const receivedTotal = paidRows.reduce((sum, row) => sum + row.receivedAmount, 0);
  const receivedDifferenceTotal = paidRows.reduce((sum, row) => sum + ((row.adjustment?.difference || 0) > 0 ? row.adjustment?.difference || 0 : 0), 0);
  const pendingTotal = collectionRows.reduce((sum, row) => sum + row.amountToCollect, 0);
  const carryoverTotal = rentalRows.reduce((sum, row) => sum + row.carryoverAmount, 0);

  const handlePrint = () => {
    window.print();
  };

  const getCaixaName = (id?: string) => {
    const found = caixas.find(c => c.id === id);
    return found ? found.name : "N/A";
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (!isOpen) return null;

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

          body > #root > div > *:not(:has(#print-area-rentals)) {
            display: none !important;
          }

          body *:not(:has(#print-area-rentals)):not(#print-area-rentals):not(#print-area-rentals *) {
            display: none !important;
          }

          body *:has(#print-area-rentals) {
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
          #print-area-rentals, #print-area-rentals * {
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

          #print-area-rentals {
            position: static !important;
            width: 297mm !important;
            max-width: 297mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: #0f172a !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          
          .no-print {
            display: none !important;
          }

          #print-area-rentals {
            font-size: 9px !important;
          }

          #print-area-rentals table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          #print-area-rentals thead {
            display: table-header-group !important;
          }

          #print-area-rentals th,
          #print-area-rentals td {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
            vertical-align: top !important;
          }

          #print-area-rentals .truncate {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            max-width: none !important;
          }

          #print-area-rentals .overflow-hidden,
          #print-area-rentals .overflow-x-auto,
          #print-area-rentals .overflow-y-auto {
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
            size: A4 landscape;
            margin: 0;
          }
        }
      `}} />

      <div className="w-full max-w-none bg-slate-905 bg-slate-900 sm:rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row h-[calc(100vh-1rem)] md:h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sidebar Controls (No Print) */}
        <div className="no-print w-full md:w-85 bg-slate-950 p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 overflow-y-auto shrink-0 select-none max-h-[42vh] md:max-h-none">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-400 font-extrabold text-sm uppercase tracking-wider">
                <Building size={16} />
                <span>Impressão LF</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold bg-slate-900/70 border border-slate-800 px-2 py-0.5 rounded-lg">Imóveis PDF</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal font-sans">
              Configure as opções abaixo para gerar e visualizar a folha de relatório de imóveis em tempo real.
            </p>

            {/* Scope selection */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] text-slate-450 uppercase font-bold block">Escopo do Relatório</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScope("caixa")}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${
                    scope === "caixa" 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Caixa Ativo
                </button>
                <button
                  type="button"
                  onClick={() => setScope("consolidado")}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${
                    scope === "consolidado" 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Consolidado
                </button>
              </div>
            </div>

            {/* Property selection */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-slate-450 uppercase font-bold block">Filtrar por Contrato</label>
              <select
                value={filterRentalId}
                onChange={(e) => setFilterRentalId(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500/50 font-sans"
              >
                <option value="todos">Todos os contratos (Completo)</option>
                {rentals
                  .filter(r => scope === "consolidado" || r.caixaId === activeCaixa.id)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.lfCode} - {r.tenantName}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Period Selector */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 uppercase font-bold block">Ano Competência</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500/50"
                >
                  {YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 uppercase font-bold block">Mês Vencimento</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500/50"
                >
                  {MONTHS_LIST.map(m => (
                    <option key={m} value={m}>{MONTHS_MAP[m]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom report description */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-450 uppercase font-bold block">Título Personalizado</label>
              <textarea
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Título do Relatório em PDF"
                rows={2}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500/50 leading-relaxed font-sans"
              />
            </div>

            {/* Row filters */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-450 uppercase font-bold block">Filtrar Imóveis na Tabela</label>
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value as any)}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500/50 font-sans"
              >
                <option value="todos">Todos ({scope === "caixa" ? "do caixa" : "todos os imóveis"})</option>
                <option value="quitados">Apenas Quitados na Competência</option>
                <option value="pendentes">Apenas Pendentes / Em Aberto</option>
                <option value="com_caucao">Apenas Contratos com Caução</option>
              </select>
            </div>

            {/* Toggle components layout options */}
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <span className="text-[10px] text-slate-450 uppercase font-bold block mb-1">Configurações de Exibição</span>
              
              <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAdminFees}
                  onChange={(e) => setShowAdminFees(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-905 accent-indigo-600 focus:ring-0 focus:ring-offset-0 text-indigo-600"
                />
                <span>Mostrar taxas de administração</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDepositSummary}
                  onChange={(e) => setShowDepositSummary(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-905 accent-indigo-600 focus:ring-0 focus:ring-offset-0 text-indigo-600"
                />
                <span>Mostrar termo de cauções ativas</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-905 accent-indigo-600 focus:ring-0 focus:ring-offset-0 text-indigo-600"
                />
                <span>Adicionar assinaturas de validação</span>
              </label>
            </div>

          </div>

          <div className="space-y-2 pt-4 border-t border-slate-800/80">
            <button
              onClick={handlePrint}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-lg cursor-pointer select-none"
            >
              <Printer size={15} />
              <span>Imprimir / Gerar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white py-2 px-4 rounded-xl text-xs font-bold transition border border-slate-800 cursor-pointer select-none text-center"
            >
              Fechar Visualização
            </button>
          </div>

        </div>

        {/* Paper Sheet Preview Content Panel (Prints to exact dimensions) */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-8 overflow-auto flex justify-start 2xl:justify-center items-start border-slate-800 min-h-[58vh] md:min-h-0">
          
          <div 
            id="print-area-rentals"
            className="w-[297mm] min-w-[297mm] max-w-none bg-white text-slate-900 p-[6mm] shadow-2xl rounded-2xl border border-slate-200/50 min-h-[210mm] font-sans leading-normal"
          >
            
            {/* Header Content */}
            <div>
              <div className="flex justify-between items-start border-b-[2.5px] border-slate-800 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-indigo-900 mb-1">
                    <span className="bg-slate-900 text-white px-2 py-1.5 rounded-lg font-black text-xs font-mono select-none leading-none">LF</span>
                    <span className="text-[10px] uppercase font-extrabold tracking-widest font-mono">Gestão de Ativos Imobiliários</span>
                  </div>
                  <h1 className="text-base font-black text-slate-900 leading-snug">
                    {customTitle}
                  </h1>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-1">
                    APURAÇÃO FINANCEIRA DE {displayPeriodStr} • {scope === "consolidado" ? "Todos os Imóveis" : `Filtrado p/ Caixa: ${activeCaixa.name}`}
                  </p>
                </div>
                
                <div className="text-right text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <span className="font-sans font-bold text-slate-700">Competência: {selectedMonth}/{selectedYear}</span>
                  <span>Emissão: {new Date(`${todayStr}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                  <span className="text-[9px] text-slate-400">Pág. 1 de 1</span>
                </div>
              </div>

              {/* Stat Boxes */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 border border-slate-150 p-2.5 rounded-xl mb-3 font-sans">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Ativos Analisados</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-slate-800">{rentalRows.length}</span>
                    <span className="text-[9px] text-slate-450">imóveis</span>
                  </div>
                  <span className="text-[9px] text-slate-500 block leading-tight">Escopo {scope === "consolidado" ? "Consolidado" : "Parcial"}</span>
                </div>

                <div className="space-y-0.5 border-l border-slate-200/60 pl-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Quitados x Pendentes</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-black text-emerald-600">{paidRows.length}</span>
                    <span className="text-[10px] text-slate-300">/</span>
                    <span className="text-sm font-black text-amber-600">{pendingRows.length}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 block font-bold leading-tight">Adimplência: <strong className="text-indigo-650">{rentalRows.length > 0 ? ((paidRows.length / rentalRows.length) * 100).toFixed(0) : "0"}%</strong></span>
                </div>

                <div className="space-y-0.5 border-l border-slate-200/60 pl-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Montante Recebido Líquido</span>
                  <div className="text-sm font-black text-emerald-600">{formatCurrency(receivedTotal)}</div>
                  <span className="text-[9px] text-slate-500 block leading-none">Esperado: {formatCurrency(expectedReceivedTotal)}</span>
                </div>

                <div className="space-y-0.5 border-l border-slate-200/60 pl-3">
                  <span className="text-[9px] uppercase font-bold text-slate-450 block tracking-tight font-semibold text-amber-700">Total Pendente</span>
                  <div className="text-sm font-black text-amber-600">{formatCurrency(pendingTotal)}</div>
                  <span className="text-[9px] text-slate-500 block leading-none">Inclui diferenças anteriores: {formatCurrency(carryoverTotal)}</span>
                </div>
              </div>

              {/* Dedicated rent collection report */}
              <div className="grid grid-cols-2 gap-2.5 mb-3 font-sans">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-700">Recebidos na competência</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <strong className="text-lg text-emerald-700">{paidRows.length}</strong>
                    <span className="text-[10px] text-emerald-800 font-bold">{formatCurrency(receivedTotal)}</span>
                  </div>
                  {receivedDifferenceTotal > 0 && (
                    <span className="text-[9px] text-amber-800 font-bold">Diferença a cobrar: {formatCurrency(receivedDifferenceTotal)}</span>
                  )}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-amber-800">A cobrar / não recebidos</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <strong className="text-lg text-amber-800">{collectionRows.length}</strong>
                    <span className="text-[10px] text-amber-900 font-bold">{formatCurrency(pendingTotal)}</span>
                  </div>
                </div>
              </div>

              <section className="border border-emerald-200 rounded-xl overflow-hidden mb-3 page-break-inside">
                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-200 flex items-center justify-between">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-800">1. Aluguéis já recebidos</h2>
                  <span className="text-[9px] font-bold text-emerald-700">{formatCurrency(receivedTotal)}</span>
                </div>
                <table className="w-full text-left border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-white text-slate-500 uppercase font-black border-b border-emerald-100">
                      <th className="p-2 w-12 text-center">Cód.</th>
                      <th className="p-2">Inquilino / Endereço</th>
                      <th className="p-2 w-16 text-center">Venc.</th>
                      <th className="p-2 w-20 text-center">Repasse</th>
                      <th className="p-2 w-24 text-right">Esperado</th>
                      <th className="p-2 w-24 text-right">Recebido</th>
                      <th className="p-2 w-22 text-right">Diferença</th>
                      <th className="p-2 w-24 text-center">Prazo / Multa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/70">
                    {paidRows.length > 0 ? (
                      paidRows.map(row => (
                        <tr key={row.rental.id} className="bg-emerald-50/15">
                          <td className="p-2 text-center font-black text-slate-800">{row.rental.lfCode}</td>
                          <td className="p-2 leading-snug">
                            <span className="block font-bold text-slate-900">{row.rental.tenantName}</span>
                            <span className="block text-[8px] text-slate-500">{row.rental.address}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{row.dueDateStr.split("-").reverse().join("/")}</td>
                          <td className="p-2 text-center font-mono">
                            {row.paymentDate ? new Date(`${row.paymentDate}T12:00:00`).toLocaleDateString("pt-BR") : "Baixado"}
                          </td>
                          <td className="p-2 text-right font-bold text-slate-800 font-mono">{formatCurrency(row.netAmount)}</td>
                          <td className="p-2 text-right font-black text-emerald-800 font-mono">{formatCurrency(row.receivedAmount)}</td>
                          <td className={`p-2 text-right font-black font-mono ${
                            (row.adjustment?.difference || 0) > 0 ? "text-amber-800" : (row.adjustment?.difference || 0) < 0 ? "text-sky-700" : "text-slate-400"
                          }`}>
                            {(row.adjustment?.difference || 0) > 0
                              ? formatCurrency(row.adjustment?.difference || 0)
                              : (row.adjustment?.difference || 0) < 0
                                ? `+ ${formatCurrency(Math.abs(row.adjustment?.difference || 0))}`
                                : "-"}
                          </td>
                          <td className="p-2 text-center">
                            <div className="space-y-1">
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black uppercase text-[8px]">
                                {row.adjustment?.daysAfterDue && row.adjustment.daysAfterDue > 0
                                  ? `${row.adjustment.daysAfterDue}d atraso`
                                  : row.adjustment?.daysAfterDue && row.adjustment.daysAfterDue < 0
                                    ? `${Math.abs(row.adjustment.daysAfterDue)}d adiantado`
                                    : "No prazo"}
                              </span>
                              {row.adjustment?.lateFeeStatus === "suggested" && (
                                <span className="block text-[7.5px] font-bold text-amber-800">Avaliar multa</span>
                              )}
                              {row.adjustment?.lateFeeStatus === "waived" && (
                                <span className="block text-[7.5px] font-bold text-slate-500">Atraso aliviado</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                          Nenhum aluguel foi marcado como recebido nesta competência.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="border border-amber-200 rounded-xl overflow-hidden mb-3">
                <div className="bg-amber-50 px-3 py-2 border-b border-amber-200 flex items-center justify-between">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-900">2. Aluguéis a cobrar da imobiliária</h2>
                  <span className="text-[9px] font-bold text-amber-900">{formatCurrency(pendingTotal)}</span>
                </div>
                <table className="w-full text-left border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-white text-slate-500 uppercase font-black border-b border-amber-100">
                      <th className="p-2 w-12 text-center">Cód.</th>
                      <th className="p-2">Inquilino / Endereço</th>
                      <th className="p-2 w-16 text-center">Venc.</th>
                      <th className="p-2 w-24 text-right">Valor a cobrar</th>
                      <th className="p-2 w-28 text-center">Status</th>
                      <th className="p-2 w-28">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/70">
                    {collectionRows.length > 0 ? (
                      collectionRows.map(row => (
                        <tr key={row.rental.id} className={row.daysDiff > 0 ? "bg-rose-50/30" : row.daysDiff === 0 ? "bg-amber-50/40" : "bg-white"}>
                          <td className="p-2 text-center font-black text-slate-800">{row.rental.lfCode}</td>
                          <td className="p-2 leading-snug">
                            <span className="block font-bold text-slate-900">{row.rental.tenantName}</span>
                            <span className="block text-[8px] text-slate-500">{row.rental.address}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{row.dueDateStr.split("-").reverse().join("/")}</td>
                          <td className="p-2 text-right font-black text-slate-900 font-mono">
                            <div>{formatCurrency(row.amountToCollect)}</div>
                            {row.carryoverAmount > 0 && (
                              <span className="block text-[7.5px] text-amber-700 font-bold">
                                inclui {formatCurrency(row.carryoverAmount)} anterior
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-md font-black uppercase text-[8px] ${
                              row.currentShortfall > 0 || row.carryoverAmount > 0
                                ? "bg-amber-100 text-amber-900"
                                : row.statusTone === "rose"
                                ? "bg-rose-100 text-rose-800"
                                : row.statusTone === "amber"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-sky-100 text-sky-800"
                            }`}>
                              {row.currentShortfall > 0
                                ? "Diferença pendente"
                                : row.carryoverAmount > 0
                                  ? "Saldo anterior"
                                  : row.statusLabel}
                            </span>
                          </td>
                          <td className="p-2 text-[8px] text-slate-600">
                            {row.currentShortfall > 0
                              ? "Diferença do repasse atual"
                              : row.carryoverAmount > 0
                                ? "Diferença transferida do mês anterior"
                                : row.daysDiff > 2
                                  ? `Passou ${row.daysDiff - 2}d da tolerância; avaliar multa`
                                  : row.daysDiff > 0 ? "Dentro da tolerância de 2 dias" : row.daysDiff === 0 ? "Cobrar hoje" : "Acompanhar vencimento"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-emerald-700 font-bold">
                          Não há aluguéis pendentes para cobrar nesta competência.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {/* Gauções term summary table if enabled */}
              {showDepositSummary && depositStats.count > 0 && (
                <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-2.5 mb-3 font-sans text-[10px]">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-amber-200/60 pb-1.5 mb-2 uppercase text-[9px]">
                    <Lock size={12} className="text-amber-600" />
                    <span>Relação de Garantias Financeiras Conservadas (Cauções) • Resumos Gerais</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-2 pt-0.5 font-mono text-[9px]">
                    <div>
                      <span className="text-[8.5px] text-slate-500 block font-sans font-bold">Total Custódia Original</span>
                      <strong className="text-slate-700 text-[10.5px]">{formatCurrency(depositStats.sumOriginal)}</strong>
                    </div>
                    <div>
                      <span className="text-[8.5px] text-slate-500 block font-sans font-bold">Total Acumulado c/ juros poupança</span>
                      <strong className="text-slate-800 text-[10.5px]">{formatCurrency(depositStats.sumToday)}</strong>
                    </div>
                    <div>
                      <span className="text-[8.5px] text-slate-500 block font-sans font-bold">Rendimento Estimado Conservado</span>
                      <strong className="text-emerald-700 text-[10.5px]">{formatCurrency(depositStats.accruedInterest)}</strong>
                    </div>
                  </div>

                  <table className="w-full text-left text-[9px] border-t border-amber-200/50 pt-2 font-sans mt-2">
                    <thead>
                      <tr className="text-slate-450 font-bold uppercase text-[8px] tracking-tight">
                        <th>Imóvel</th>
                        <th>Inquilino</th>
                        <th>Início Caução</th>
                        <th className="text-center">Juros/mês</th>
                        <th className="text-right">Original</th>
                        <th className="text-right">Estimativa Corrigida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/40 text-slate-650">
                      {rentals
                        .filter(r => r.hasDeposit && (scope === "consolidado" || r.caixaId === activeCaixa.id))
                        .map(r => {
                          const original = r.depositAmount || 0;
                          const months = calculateMonthsDifference(r.depositStartDate || todayStr, todayStr);
                          const rate = r.depositInterestRate || 0.5;
                          const todayVal = original * Math.pow(1 + (rate / 100), months);
                          
                          return (
                            <tr key={r.id} className="hover:bg-amber-100/10">
                              <td className="p-1 font-extrabold text-slate-800">{r.lfCode}</td>
                              <td className="p-1 font-bold">{r.tenantName}</td>
                              <td className="p-1">{r.depositStartDate ? new Date(r.depositStartDate + "T12:00:00").toLocaleDateString("pt-BR") : "N/D"}</td>
                              <td className="p-1 text-center font-mono">{rate}%</td>
                              <td className="p-1 text-right font-mono">{formatCurrency(original).replace("R$", "")}</td>
                              <td className="p-1 text-right font-bold font-mono text-emerald-805">{formatCurrency(todayVal).replace("R$", "")}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  
                  <p className="text-[8px] text-slate-400 font-sans italic mt-2 leading-relaxed">
                    * Os valores capitalizados representam uma estimativa matemática baseada em taxas de base de poupança compostas mensalmente. A devolução ao locatário no encerramento contratual deve seguir vistoria e a atualização monetária legal em vigor na data da restituição efetiva.
                  </p>
                </div>
              )}

              {/* Audit trail watermark / code description */}
              <div className="mt-1.5 text-[8px] text-slate-400 leading-normal border-t border-slate-150 pt-1.5 font-mono uppercase bg-white select-none">
                <span className="font-bold">CONCILIAÇÃO INTEGRADA LF:</span> O presente relatório consolida todas as faturas em aberto e quitações registradas na base do livro-caixa ativo corporativo. Erros ou discrepâncias devem ser comunicados ao setor administrativo antes de qualquer recolhimento tributário.
              </div>
            </div>

            {/* Validation signatures */}
            {showSignatures && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between gap-12 font-sans select-none">
                <div className="flex-1 text-center flex flex-col items-center">
                  <div className="h-0.5 w-full bg-slate-300 max-w-[200px]" />
                  <span className="text-[10px] font-black text-slate-850 mt-1 uppercase block leading-tight">Responsável Admin Imobiliário</span>
                  <span className="text-[8.5px] text-slate-400 tracking-wider">Holding LF Imóveis Ltda.</span>
                </div>
                
                <div className="flex-1 text-center flex flex-col items-center">
                  <div className="h-0.5 w-full bg-slate-300 max-w-[200px]" />
                  <span className="text-[10px] font-black text-slate-850 mt-1 uppercase block leading-tight">Controladoria Financeira</span>
                  <span className="text-[8.5px] text-slate-400 tracking-wider">Assinatura autorizada e auditável</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
