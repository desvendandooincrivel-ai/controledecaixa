import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Lock, 
  Calendar, 
  TrendingUp, 
  Coins, 
  HelpCircle, 
  ArrowRight,
  Info,
  DollarSign,
  Undo
} from "lucide-react";

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
  adminFeePercent?: number;
  paidPeriods: string[];
  
  hasDeposit?: boolean;
  depositMonthsCount?: number;
  depositAmount?: number;
  depositStartDate?: string;
  depositInterestRate?: number;
  depositCorrectionMode?: "fixed" | "bcb";
}

interface DepositDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rental: RentalProperty | null;
  onUpdateRentalDeposit: (updatedRental: RentalProperty) => void;
  onRefundDeposit: (rental: RentalProperty, refundAmount: number) => void;
  sgsRates: Record<string, number>;
  sgsLoading: boolean;
  sgsError: string | null;
}

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseCurrencyInput = (value: string | number | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  let normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[R$]/g, "");

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Helper: Parse a local date string "YYYY-MM-DD" safely without DST shift issues
export function parseLocalDate(dStr: string): Date {
  const [year, month, day] = dStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

// Helper: Calculate the date of the next monthly anniversary milestone
export function getNextAnniversaryDate(startDateStr: string, monthsElapsed: number): Date {
  const [year, month, day] = startDateStr.split("-").map(Number);
  const targetMonth = (month - 1) + monthsElapsed;
  
  // Calculate max days of the target month to prevent overflow wrapping (e.g. 31st of Jan -> 31st of Feb doesn't exist, cap at 28)
  const temp = new Date(year, targetMonth, 1);
  const maxDaysInMonth = new Date(year, targetMonth + 1, 0).getDate();
  const actualDay = Math.min(day, maxDaysInMonth);
  
  return new Date(year, targetMonth, actualDay, 12, 0, 0);
}

// Helper: Calculate full months elapsed between start and end dates according to birthday anniversary model
export function calculateMonthsDifference(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  
  // Regra 7: Para depósitos nos dias 29, 30 ou 31, considerar a data-base como dia 1º do mês seguinte
  const [y, m, d] = startDateStr.split("-").map(Number);
  let adjStartDateStr = startDateStr;
  if (d >= 29) {
    const temp = new Date(y, m, 1, 12, 0, 0);
    adjStartDateStr = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-01`;
  }
  
  const start = parseLocalDate(adjStartDateStr);
  const end = parseLocalDate(endDateStr);
  if (end < start) return 0;
  
  let months = 0;
  while (true) {
    const nextAnniversary = getNextAnniversaryDate(adjStartDateStr, months + 1);
    if (nextAnniversary > end) {
      break;
    }
    months++;
  }
  return months;
}

export interface AnniversaryPeriod {
  index: number;
  startDate: string;
  endDate: string;
  rate: number;
  initialValue: number;
  finalValue: number;
  interestEarned: number;
  isResidual?: boolean;
}

// Helper: Generate list of monthly periods for auditing/visualizing
export function generateAnniversaryPeriods(
  startDateStr: string,
  endDateStr: string,
  baseAmount: number,
  monthlyRate: number,
  correctionMode: "fixed" | "bcb" = "fixed",
  sgsRates: Record<string, number> = {}
): AnniversaryPeriod[] {
  if (!startDateStr || !endDateStr || baseAmount <= 0) return [];
  
  const end = parseLocalDate(endDateStr);
  const start = parseLocalDate(startDateStr);
  if (end < start) return [];
  
  // Regra 7: Para depósitos nos dias 29, 30 ou 31, considerar a data-base como dia 1º do mês seguinte
  const [y, m, d] = startDateStr.split("-").map(Number);
  let adjY = y;
  let adjM = m;
  let adjD = d;
  if (d >= 29) {
    const temp = new Date(y, m, 1, 12, 0, 0);
    adjY = temp.getFullYear();
    adjM = temp.getMonth() + 1;
    adjD = 1;
  }
  
  const adjStartDateStr = `${adjY}-${String(adjM).padStart(2, "0")}-${String(adjD).padStart(2, "0")}`;
  
  const periods: AnniversaryPeriod[] = [];
  let currentVal = baseAmount;
  let months = 0;
  
  while (true) {
    const nextAnniversary = getNextAnniversaryDate(adjStartDateStr, months + 1);
    if (nextAnniversary > end) {
      break;
    }
    
    const prevAnniversary = getNextAnniversaryDate(adjStartDateStr, months);
    const prevStr = prevAnniversary.toISOString().split("T")[0];
    const nextStr = nextAnniversary.toISOString().split("T")[0];
    
    // Get rate based on correctionMode
    let rate = monthlyRate;
    if (correctionMode === "bcb") {
      // Format prevAnniversary to look up DD/MM/YYYY in sgsRates
      const dayStr = String(prevAnniversary.getDate()).padStart(2, "0");
      const mStr = String(prevAnniversary.getMonth() + 1).padStart(2, "0");
      const yStr = prevAnniversary.getFullYear();
      const lookupKey = `${dayStr}/${mStr}/${yStr}`;
      rate = sgsRates && sgsRates[lookupKey] !== undefined ? sgsRates[lookupKey] : 0.5;
    }
    
    const interest = currentVal * (rate / 100);
    const finalVal = currentVal + interest;
    
    periods.push({
      index: months + 1,
      startDate: prevStr,
      endDate: nextStr,
      rate: rate,
      initialValue: currentVal,
      finalValue: finalVal,
      interestEarned: interest
    });
    
    currentVal = finalVal;
    months++;
  }
  
  // Add residual period if any
  const lastAnniversary = getNextAnniversaryDate(adjStartDateStr, months);
  const lastAnniversaryStr = lastAnniversary.toISOString().split("T")[0];
  
  if (lastAnniversaryStr !== endDateStr) {
    periods.push({
      index: months + 1,
      startDate: lastAnniversaryStr,
      endDate: endDateStr,
      rate: 0,
      initialValue: currentVal,
      finalValue: currentVal,
      interestEarned: 0,
      isResidual: true
    });
  }
  
  return periods;
}

// Helper date period displayer Ex: "Janeiro de 2026"
export function formatPeriodBRL(period: string): string {
  if (!period) return "";
  const parts = period.split("-");
  if (parts.length < 2) return period;
  const [year, month] = parts;
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const mIdx = parseInt(month, 10) - 1;
  return `${monthNames[mIdx] || month} de ${year}`;
}

export function DepositDetailModal({
  isOpen,
  onClose,
  rental,
  onUpdateRentalDeposit,
  onRefundDeposit,
  sgsRates,
  sgsLoading,
  sgsError
}: DepositDetailModalProps) {
  // Edit Mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editHasDeposit, setEditHasDeposit] = useState(!!rental?.hasDeposit);
  const [editMonthsNum, setEditMonthsNum] = useState<number>(rental?.depositMonthsCount || 3);
  const [editAmountStr, setEditAmountStr] = useState(rental?.depositAmount?.toString() || "");
  const [editStartDate, setEditStartDate] = useState(rental?.depositStartDate || getLocalDateInputValue());
  const [editRateStr, setEditRateStr] = useState(rental?.depositInterestRate?.toString() || "0.5");
  const [editCorrectionMode, setEditCorrectionMode] = useState<"fixed" | "bcb">(rental?.depositCorrectionMode || "fixed");

  // Simulation parameters for preview
  const [simulatetDate, setSimulationDate] = useState(() => {
    return getLocalDateInputValue();
  });

  useEffect(() => {
    if (!isOpen || !rental) return;
    setIsEditing(false);
    setEditHasDeposit(!!rental.hasDeposit);
    setEditMonthsNum(rental.depositMonthsCount || 3);
    setEditAmountStr(rental.depositAmount?.toString() || "");
    setEditStartDate(rental.depositStartDate || getLocalDateInputValue());
    setEditRateStr(rental.depositInterestRate?.toString() || "0.5");
    setEditCorrectionMode(rental.depositCorrectionMode || "fixed");
    setSimulationDate(getLocalDateInputValue());
  }, [isOpen, rental?.id]);

  const baseAmount = rental?.depositAmount || 0;
  const monthlyRateBase = rental?.depositInterestRate !== undefined ? rental.depositInterestRate : 0.5;
  const startDateText = rental?.depositStartDate || getLocalDateInputValue();
  const correctionMode = rental?.depositCorrectionMode || "fixed";

  // Dynamic simulation computations (poupança compounding matching exact anniversaries)
  const periods = useMemo(() => {
    return generateAnniversaryPeriods(
      startDateText, 
      simulatetDate, 
      baseAmount, 
      monthlyRateBase,
      correctionMode,
      sgsRates
    );
  }, [baseAmount, monthlyRateBase, startDateText, simulatetDate, correctionMode, sgsRates]);

  const simulationData = useMemo(() => {
    const fullMonthsPeriods = periods.filter(p => !p.isResidual);
    const months = fullMonthsPeriods.length;
    
    // Find final accumulated active value
    const finalActivePeriod = periods[periods.length - 1];
    const adjustedTotal = finalActivePeriod ? finalActivePeriod.finalValue : baseAmount;
    const gainedInterest = adjustedTotal - baseAmount;
    const compoundFactor = baseAmount > 0 ? (adjustedTotal / baseAmount) : 1;

    return {
      months,
      compoundFactor,
      adjustedTotal: parseFloat(adjustedTotal.toFixed(2)),
      gainedInterest: parseFloat(gainedInterest.toFixed(2))
    };
  }, [periods, baseAmount]);

  const handleSaveEdit = () => {
    if (!rental) return;

    const amt = parseCurrencyInput(editAmountStr);
    const rate = parseCurrencyInput(editRateStr);

    const updated: RentalProperty = {
      ...rental,
      hasDeposit: editHasDeposit,
      depositMonthsCount: editHasDeposit ? editMonthsNum : undefined,
      depositAmount: editHasDeposit ? amt : undefined,
      depositStartDate: editHasDeposit ? editStartDate : undefined,
      depositInterestRate: editHasDeposit ? rate : undefined,
      depositCorrectionMode: editHasDeposit ? editCorrectionMode : undefined
    };

    onUpdateRentalDeposit(updated);
    setIsEditing(false);
  };

  const handleRefundAction = () => {
    if (!rental) return;
    if (confirm(`Confirmar devolução total da caução reajustada no valor de R$ ${simulationData.adjustedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para o inquilino ${rental.tenantName}?\n\nIsso criará automaticamente uma transação de SAÍDA do caixa.`)) {
      onRefundDeposit(rental, simulationData.adjustedTotal);
      onClose();
    }
  };

  if (!isOpen || !rental) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
      />

      {/* Modal Dialog */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden relative z-10 p-6 flex flex-col font-sans max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
            <Lock size={16} />
          </span>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Ficha de Garantia por Caução</h3>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">{rental.lfCode} — Contrato Ativo</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl mb-4 text-xs">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-450 font-medium">Inquilino:</span>
            <span className="font-bold text-slate-800">{rental.tenantName}</span>
          </div>
          <div className="flex justify-between pt-1.5 align-middle">
            <span className="text-slate-450 font-medium">Imóvel:</span>
            <span className="font-semibold text-slate-705 text-right truncate max-w-[280px]" title={rental.address}>{rental.address}</span>
          </div>
        </div>

        {isEditing ? (
          /* EDIT DEPOSIT CONFIG FORM */
          <div className="space-y-4 border-t border-slate-100 pt-4 text-xs">
            <h4 className="font-bold text-slate-700 uppercase tracking-wide text-[10px] mb-2 select-none">Configurações da Caução</h4>
            
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 my-2 select-none">
              <input
                type="checkbox"
                checked={editHasDeposit}
                onChange={(e) => {
                  const check = e.target.checked;
                  setEditHasDeposit(check);
                  if (check && !editAmountStr) {
                    setEditAmountStr((rental.rentAmount * editMonthsNum).toString());
                  }
                }}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 cursor-pointer"
              />
              <span>Ativar Caução para este Contrato</span>
            </label>

            {editHasDeposit && (
              <div className="grid grid-cols-1 gap-3">
                {/* Method selection toggle block */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">Metodologia de Ajuste</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditCorrectionMode("fixed")}
                      className={`py-2 px-3 border rounded-xl text-center select-none cursor-pointer transition flex flex-col justify-center items-center ${
                        editCorrectionMode === "fixed"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-750 font-extrabold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                      }`}
                    >
                      <span className="text-xs">📈 Taxa Fixa Mensal</span>
                      <span className="text-[8px] opacity-80 font-normal font-sans">Média fixa manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCorrectionMode("bcb")}
                      className={`py-2 px-3 border rounded-xl text-center select-none cursor-pointer transition flex flex-col justify-center items-center ${
                        editCorrectionMode === "bcb"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-750 font-extrabold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                      }`}
                    >
                      <span className="text-xs">🏦 BCB Oficial (Poupança)</span>
                      <span className="text-[8px] opacity-80 font-normal font-sans">Histórico SGS Série 195</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Qtd. de Meses Referência</label>
                    <select
                      value={editMonthsNum}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setEditMonthsNum(m);
                        if (m > 0) {
                          setEditAmountStr((rental.rentAmount * m).toString());
                        }
                      }}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                    >
                      {[1, 2, 3, 4, 5, 6].map(x => (
                        <option key={x} value={x}>{x} {x === 1 ? "Mês de aluguel" : "Meses de aluguel"}</option>
                      ))}
                      <option value={0}>Valor Customizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Data que depositou</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-medium text-[11px] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor Caucionado Inicial (R$)</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={editAmountStr}
                      onChange={(e) => setEditAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {editCorrectionMode === "bcb" ? "Index Poupança (Via BCB)" : "Index Poupança (% ao mês)"}
                    </label>
                    {editCorrectionMode === "bcb" ? (
                      <div className="w-full bg-emerald-50 border border-emerald-150 rounded-lg p-2 text-[10px] font-extrabold text-emerald-850 h-[34px] flex items-center justify-center text-center font-sans">
                        {sgsLoading ? "Carregando taxas..." : sgsError ? "Conexão Offline (0.5% Fallback)" : "BCB SGS 195 Ativo Online"}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editRateStr}
                        onChange={(e) => setEditRateStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        ) : (
          /* DETAILS DISPLAY AND SIMULATOR */
          <div className="space-y-4">
            
            {/* Standard Deposit Parameters */}
            {!rental.hasDeposit ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <HelpCircle size={32} className="mx-auto text-slate-350 stroke-1 mb-2" />
                <p className="text-xs font-bold text-slate-700">Este contrato não possui caução de garantia vinculada.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditHasDeposit(true);
                    setEditMonthsNum(3);
                    setEditAmountStr((rental.rentAmount * 3).toString());
                    setIsEditing(true);
                  }}
                  className="mt-3 text-xs bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-extrabold px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  Configurar Caução Agora
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Caução Original</span>
                    <h5 className="text-lg font-extrabold text-slate-800 mt-1 font-mono">
                      R$ {rental.depositAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h5>
                    {rental.depositMonthsCount ? (
                      <span className="text-[10px] text-slate-450 block mt-0.5 font-sans">({rental.depositMonthsCount} meses de aluguel)</span>
                    ) : (
                      <span className="text-[10px] text-slate-450 block mt-0.5 font-sans">(Valor customizado)</span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Parâmetros Custódia</span>
                    <div className="mt-1 text-slate-800 text-[11px] leading-relaxed">
                      <div className="flex items-center gap-1 font-medium mt-0.5">
                        <Calendar size={11} className="text-indigo-500" />
                        <span>Recibo: {new Date(startDateText + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-emerald-600 mt-0.5">
                        <TrendingUp size={11} />
                        <span>Poupança: +{monthlyRateBase}% / mês</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compound Interest Simulator Slider / Controller */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2 select-none">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Simulador poupança em tempo real</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">Regra de Aniversário</span>
                  </div>

                  <div className="space-y-3 mt-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <label className="font-bold text-slate-600">Simular data de resgate/devolução:</label>
                        <span className="font-mono font-bold text-indigo-700">{formatPeriodBRL(simulatetDate.substring(0, 7))}</span>
                      </div>
                      <input
                        type="date"
                        value={simulatetDate}
                        onChange={(e) => setSimulationDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-medium cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-3xs text-center font-mono">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Meses elapsados</span>
                        <span className="text-[11px] font-bold text-slate-850">{simulationData.months} {simulationData.months === 1 ? "mês" : "meses"}</span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Rend. Acumulado</span>
                        <span className="text-[11px] font-bold text-emerald-600">
                          +{((simulationData.compoundFactor - 1) * 100).toFixed(4)}%
                        </span>
                      </div>

                      <div className="bg-amber-50 rounded-lg py-1 border border-amber-100">
                        <span className="text-[9px] font-extrabold text-amber-800 uppercase block mb-0.5">Rendimento</span>
                        <span className="text-[11px] font-extrabold text-amber-950">
                          + R$ {simulationData.gainedInterest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Month-by-Month Anniversary Credits Table */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Extrato de Rentabilidade (Mês a Mês)</span>
                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md">Auditoria</span>
                  </div>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {periods.length === 0 ? (
                      <p className="text-center py-4 text-slate-450 text-[10px] italic">Sem períodos calculados.</p>
                    ) : (
                      periods.map((p, pIdx) => (
                        <div 
                          key={pIdx}
                          className={`p-2 rounded-xl text-[11px] flex justify-between items-center ${
                            p.isResidual 
                              ? "bg-slate-100/60 border border-slate-200/50 text-slate-400" 
                              : "bg-white border border-slate-100 text-slate-705 shadow-3xs"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`font-bold h-4 px-1 rounded-sm text-[8.5px] flex items-center justify-center ${
                                p.isResidual ? "bg-slate-200 text-slate-600" : "bg-indigo-50 text-indigo-700"
                              }`}>
                                {p.isResidual ? "P.R." : `Mês ${p.index}`}
                              </span>
                              <span className="font-semibold text-slate-650">
                                {new Date(p.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                                <span className="mx-1 text-slate-350">→</span>
                                {new Date(p.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            </div>
                            {p.isResidual ? (
                              <span className="text-[9.5px] italic text-slate-400 font-sans">
                                Período residual (não atingiu a data-base de {new Date(getNextAnniversaryDate(startDateText, p.index).toISOString().split("T")[0] + "T12:00:00").toLocaleDateString("pt-BR")})
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-slate-400 font-medium">
                                Base: R$ {p.initialValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>

                          <div className="text-right flex flex-col font-mono text-[11px]">
                            <span className={`font-bold ${p.isResidual ? 'text-slate-400' : 'text-emerald-600'}`}>
                              {p.isResidual ? "0,00%" : `+${p.rate.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 4 })}%`}
                            </span>
                            <span className={p.isResidual ? 'text-[10px] text-slate-400 font-medium' : 'text-slate-650 font-bold'}>
                              R$ {p.finalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="mt-2 text-[9.5px] text-slate-450 leading-relaxed italic">
                    * Os rendimentos ocorrem apenas no dia de aniversário do depósito. Como as aplicações se encerram apenas nas datas-base correspondentes, períodos residuais menores que 1 mês completo recebem rendimento de <strong>0,00%</strong>.
                  </p>
                </div>

                {/* Final Calculation Banner Output */}
                <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border border-slate-800 text-indigo-50 p-4 rounded-2xl flex flex-col gap-2 shadow-md relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 select-none opacity-10">
                    <Coins size={120} />
                  </div>
                  
                  <div className="flex items-center justify-between z-10">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold tracking-wider uppercase opacity-90 text-indigo-300 block">Est. Devolução (Aproximado)</span>
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-extrabold text-[8px] rounded-xs animate-pulse">VALOR ESTIMADO</span>
                      </div>
                      <h4 className="text-xl font-extrabold text-emerald-450 font-mono tracking-wide">
                        R$ {simulationData.adjustedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </h4>
                      <p className="text-[9.5px] italic text-slate-350 leading-tight font-sans">
                        Base original: R$ {rental.depositAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} + R$ {simulationData.gainedInterest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de rendimentos
                      </p>
                    </div>
                    <Coins size={32} className="text-emerald-450 stroke-[1.25] opacity-90 z-10" />
                  </div>
                </div>

                {/* Alert Warning Notes & Explanations on BCB matching */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col gap-2 text-[10px] text-amber-900 leading-normal">
                  <div className="flex items-start gap-1.5">
                    <Info size={13} className="flex-shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-950">
                        {rental.depositCorrectionMode === "bcb"
                          ? "Cálculo Oficial BCB (Série SGS 195) Ativado"
                          : "Por que o valor pode variar da Poupança real?"}
                      </p>
                      <p className="text-amber-900/95 leading-normal">
                        {rental.depositCorrectionMode === "bcb" ? (
                          <>
                            Este contrato está configurado no modo <strong>BCB Oficial</strong>. O aplicativo consulta a série histórica <strong>SGS 195</strong> da poupança para aplicar os fatores acumulados exatos do período de cada aniversário, seguindo os aniversários mensais completos e as políticas de fuso da data-base da poupança.
                          </>
                        ) : (
                          <>
                            A poupança oficial do Banco Central (BCB) utiliza taxas mensais variáveis corrigidas pela <strong>TR (Taxa Referencial)</strong>. Este simulador calcula o reajuste com uma taxa média fixa (padrão de 0.5% ao mês).
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {rental.depositCorrectionMode !== "bcb" && (
                    <div className="bg-white/80 border border-amber-150 rounded-lg p-2 text-[9.5px] text-slate-700 space-y-1">
                      <span className="font-bold text-slate-850 block">Como aproximar ou igualar o valor oficial do BCB?</span>
                      <p className="leading-normal">
                        Caso o cálculo oficial do banco ou imobiliária seja diferente, você pode <strong>editar os parâmetros da caução</strong> e selecionar o modo <strong>"BCB Oficial"</strong> para carregar a correção oficial do Banco Central.
                      </p>
                    </div>
                  )}
                  
                  <p className="text-[9px] italic text-slate-500 text-right font-medium">
                    {rental.depositCorrectionMode === "bcb" 
                      ? "* Valores obtidos diretamente de api.bcb.gov.br. Cálculos efetuados com base nas regras do Banco Central do Brasil."
                      : "* Use esta simulação para planejamento preliminar. Consulte o banco custodiante para o extrato oficial definitivo."}
                  </p>
                </div>

                {/* Bottom Row Controls */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditHasDeposit(!!rental.hasDeposit);
                      setEditMonthsNum(rental.depositMonthsCount || 3);
                      setEditAmountStr(rental.depositAmount?.toString() || "");
                      setEditStartDate(rental.depositStartDate || getLocalDateInputValue());
                      setEditRateStr(rental.depositInterestRate?.toString() || "0.5");
                      setEditCorrectionMode(rental.depositCorrectionMode || "fixed");
                      setIsEditing(true);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-850 font-bold underline cursor-pointer pr-3"
                  >
                    Editar parâmetros da caução
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      onClick={handleRefundAction}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Undo size={13} />
                      <span>Devolver Caução</span>
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
