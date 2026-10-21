import React, { useState, useMemo } from "react";
import {
  CreditCard as CreditCardIcon,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  Receipt,
  X,
  Sparkles,
  Info,
  Check,
  Clock,
  Layers
} from "lucide-react";
import { getCreditCardCycleForPurchase } from "../utils/creditCardCycle";

export interface CreditCard {
  id: string;
  caixaId?: string;
  name: string;
  closingDay: number; // Dia em que o cartão vira (fechamento)
  dueDay: number; // Dia do vencimento da fatura
  color: string;
  limit?: number;
}

export type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "outros";

export interface Transaction {
  id: string;
  caixaId: string;
  date: string;
  purchaseDate?: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  paymentMethod?: PaymentMethod;
  cardId?: string;
  installments?: { current: number; total: number };
  invoicePeriod?: string;
  isCardInvoicePayment?: boolean;
  invoicePaid?: boolean;
  invoicePaymentTxId?: string;
}

interface CreditCardsManagerProps {
  creditCards: CreditCard[];
  onSaveCard: (card: CreditCard) => void;
  onDeleteCard: (cardId: string) => void;
  transactions: Transaction[];
  activeCaixaId: string;
  filterMonth: string;
  filterYear: string;
  monthsList: { value: string; label: string }[];
  onPostInvoiceToLedger: (
    card: CreditCard,
    amount: number,
    paymentDate: string,
    periodLabel: string,
    paymentMethod?: PaymentMethod,
    invoicePeriod?: string
  ) => void;
}

export const PRESET_COLORS = [
  { name: "Roxo Nubank", bg: "bg-gradient-to-br from-purple-700 to-purple-900", border: "border-purple-500", text: "text-purple-300", hex: "#7e22ce" },
  { name: "Azul Marinho", bg: "bg-gradient-to-br from-blue-700 to-indigo-950", border: "border-blue-500", text: "text-blue-300", hex: "#1d4ed8" },
  { name: "Verde Esmeralda", bg: "bg-gradient-to-br from-emerald-700 to-teal-950", border: "border-emerald-500", text: "text-emerald-300", hex: "#047857" },
  { name: "Laranja Inter", bg: "bg-gradient-to-br from-orange-600 to-amber-900", border: "border-orange-500", text: "text-orange-300", hex: "#ea580c" },
  { name: "Grafite / Black", bg: "bg-gradient-to-br from-zinc-800 to-zinc-950", border: "border-zinc-600", text: "text-zinc-300", hex: "#27272a" },
  { name: "Dourado Gold", bg: "bg-gradient-to-br from-amber-600 to-yellow-800", border: "border-amber-400", text: "text-amber-200", hex: "#d97706" },
  { name: "Rubi Carmim", bg: "bg-gradient-to-br from-rose-700 to-red-950", border: "border-rose-500", text: "text-rose-300", hex: "#be123c" },
];

export const CreditCardsManager: React.FC<CreditCardsManagerProps> = ({
  creditCards,
  onSaveCard,
  onDeleteCard,
  transactions,
  activeCaixaId,
  filterMonth,
  filterYear,
  monthsList,
  onPostInvoiceToLedger,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Form states for create / edit card
  const [formName, setFormName] = useState("");
  const [formClosingDay, setFormClosingDay] = useState<number>(15);
  const [formDueDay, setFormDueDay] = useState<number>(25);
  const [formLimitStr, setFormLimitStr] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].hex);

  // Selected card for detailed invoice inspection
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Active invoice tab per card: "current" (fatura do mês) ou "next" (próxima fatura pós-virada)
  const [cardInvoiceTab, setCardInvoiceTab] = useState<{ [cardId: string]: "current" | "next" }>({});

  // Settle invoice modal state
  const [settlingModal, setSettlingModal] = useState<{
    card: CreditCard;
    period: string;
    periodLabel: string;
    totalAmount: number;
    amountInput: string;
    paymentDate: string;
    paymentMethod: PaymentMethod;
  } | null>(null);

  const activeYearNum = filterYear !== "todos" ? parseInt(filterYear, 10) : new Date().getFullYear();
  const activeMonthNum = filterMonth !== "todos" ? parseInt(filterMonth, 10) : new Date().getMonth() + 1;
  const activeMonthStr = String(activeMonthNum).padStart(2, "0");

  const currentMonthLabel = useMemo(() => {
    const found = monthsList.find(m => parseInt(m.value, 10) === activeMonthNum);
    return found ? `${found.label} de ${activeYearNum}` : `${activeMonthStr}/${activeYearNum}`;
  }, [monthsList, activeMonthNum, activeYearNum, activeMonthStr]);

  const openNewCardModal = () => {
    setEditingCard(null);
    setFormName("");
    setFormClosingDay(15);
    setFormDueDay(25);
    setFormLimitStr("");
    setFormColor(PRESET_COLORS[0].hex);
    setIsModalOpen(true);
  };

  const openEditCardModal = (card: CreditCard) => {
    setEditingCard(card);
    setFormName(card.name);
    setFormClosingDay(card.closingDay);
    setFormDueDay(card.dueDay);
    setFormLimitStr(card.limit ? card.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
    setFormColor(card.color || PRESET_COLORS[0].hex);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Por favor, digite o nome do cartão.");
      return;
    }

    let parsedLimit: number | undefined = undefined;
    if (formLimitStr.trim()) {
      const clean = formLimitStr.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(clean);
      if (!isNaN(num) && num > 0) parsedLimit = num;
    }

    const cardToSave: CreditCard = {
      id: editingCard ? editingCard.id : `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      caixaId: activeCaixaId,
      name: formName.trim(),
      closingDay: Math.max(1, Math.min(31, formClosingDay)),
      dueDay: Math.max(1, Math.min(31, formDueDay)),
      limit: parsedLimit,
      color: formColor
    };

    onSaveCard(cardToSave);
    setIsModalOpen(false);
  };

  /**
   * Calcula as faturas do cartão:
   * 1. Fatura da competência selecionada (ex: Outubro/2026)
   * 2. Próxima fatura em aberto pós-virada (ex: Novembro/2026)
   */
  const getCardInvoicesData = (card: CreditCard) => {
    const cDay = card.closingDay;
    const dDay = card.dueDay;

    // --- 1. FATURA ATUAL (Competência do Mês Selecionado) ---
    const curPeriod = `${activeYearNum}-${activeMonthStr}`;
    let prevYear = activeYearNum;
    let prevMonth = activeMonthNum - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const maxDaysPrev = new Date(prevYear, prevMonth, 0).getDate();
    const actualStartDay = Math.min(cDay + 1, maxDaysPrev);
    const curCycleStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(actualStartDay).padStart(2, "0")}`;

    const maxDaysCur = new Date(activeYearNum, activeMonthNum, 0).getDate();
    const actualEndDay = Math.min(cDay, maxDaysCur);
    const curCycleEndDate = `${activeYearNum}-${activeMonthStr}-${String(actualEndDay).padStart(2, "0")}`;

    const maxDaysDue = new Date(activeYearNum, activeMonthNum, 0).getDate();
    const actualDueDay = Math.min(dDay, maxDaysDue);
    const curDueDateStr = `${activeYearNum}-${activeMonthStr}-${String(actualDueDay).padStart(2, "0")}`;
    const curCycleRangeStr = `${String(actualStartDay).padStart(2, "0")}/${String(prevMonth).padStart(2, "0")} até ${String(actualEndDay).padStart(2, "0")}/${activeMonthStr}`;

    // --- 2. PRÓXIMA FATURA (Competência Seguinte / Pós-Virada) ---
    let nextYear = activeYearNum;
    let nextMonth = activeMonthNum + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextMonthStr = String(nextMonth).padStart(2, "0");
    const nextPeriod = `${nextYear}-${nextMonthStr}`;

    const actualNextStartDay = Math.min(cDay + 1, maxDaysCur);
    const nextCycleStartDate = `${activeYearNum}-${activeMonthStr}-${String(actualNextStartDay).padStart(2, "0")}`;

    const maxDaysNext = new Date(nextYear, nextMonth, 0).getDate();
    const actualNextEndDay = Math.min(cDay, maxDaysNext);
    const nextCycleEndDate = `${nextYear}-${nextMonthStr}-${String(actualNextEndDay).padStart(2, "0")}`;

    const actualNextDueDay = Math.min(dDay, maxDaysNext);
    const nextDueDateStr = `${nextYear}-${nextMonthStr}-${String(actualNextDueDay).padStart(2, "0")}`;
    const nextCycleRangeStr = `${String(actualNextStartDay).padStart(2, "0")}/${activeMonthStr} até ${String(actualNextEndDay).padStart(2, "0")}/${nextMonthStr}`;

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const nextPeriodLabel = `${monthNames[nextMonth - 1]} de ${nextYear}`;

    // Filtrar compras para cada fatura
    const curTxs: Transaction[] = [];
    const nextTxs: Transaction[] = [];

    transactions.forEach(t => {
      if (t.type !== "saida") return;
      if (t.isCardInvoicePayment) return; // Pagamento de fatura nunca entra como compra!
      const isLinkedToCard = t.cardId === card.id || (t.paymentMethod === "cartao_credito" && (!t.cardId || t.cardId === card.id));
      if (!isLinkedToCard) return;

      // Se a transação já tem invoicePeriod explícito:
      if (t.invoicePeriod) {
        if (t.invoicePeriod === curPeriod) {
          curTxs.push(t);
        } else if (t.invoicePeriod === nextPeriod) {
          nextTxs.push(t);
        }
        return;
      }

      // Legado: calcular pelo ciclo de datas da compra
      const checkDate = t.purchaseDate || t.date;
      if (checkDate >= curCycleStartDate && checkDate <= curCycleEndDate) {
        curTxs.push(t);
      } else if (checkDate >= nextCycleStartDate && checkDate <= nextCycleEndDate) {
        nextTxs.push(t);
      }
    });

    const curTotal = curTxs.reduce((acc, t) => acc + t.amount, 0);
    const nextTotal = nextTxs.reduce((acc, t) => acc + t.amount, 0);

    // Verificar se já existe lançamento de pagamento no caixa para a fatura atual
    const curPaidTx = transactions.find(t =>
      t.caixaId === activeCaixaId &&
      t.type === "saida" &&
      (t.isCardInvoicePayment || t.description.toLowerCase().includes("fatura")) &&
      (t.cardId === card.id || t.description.toLowerCase().includes(card.name.toLowerCase())) &&
      (t.invoicePeriod === curPeriod || t.description.includes(curPeriod) || t.date.startsWith(curPeriod))
    );

    // Verificar se já existe lançamento de pagamento no caixa para a próxima fatura
    const nextPaidTx = transactions.find(t =>
      t.caixaId === activeCaixaId &&
      t.type === "saida" &&
      (t.isCardInvoicePayment || t.description.toLowerCase().includes("fatura")) &&
      (t.cardId === card.id || t.description.toLowerCase().includes(card.name.toLowerCase())) &&
      (t.invoicePeriod === nextPeriod || t.description.includes(nextPeriod) || t.date.startsWith(nextPeriod))
    );

    return {
      current: {
        period: curPeriod,
        periodLabel: currentMonthLabel,
        cycleRangeStr: curCycleRangeStr,
        dueDateStr: curDueDateStr,
        actualDueDay,
        txs: curTxs,
        total: curTotal,
        isPaid: !!curPaidTx,
        paidTx: curPaidTx
      },
      next: {
        period: nextPeriod,
        periodLabel: nextPeriodLabel,
        cycleRangeStr: nextCycleRangeStr,
        dueDateStr: nextDueDateStr,
        actualDueDay: actualNextDueDay,
        txs: nextTxs,
        total: nextTotal,
        isPaid: !!nextPaidTx,
        paidTx: nextPaidTx
      }
    };
  };

  const activeCards = creditCards.filter(c => !c.caixaId || c.caixaId === activeCaixaId);

  const handleOpenSettlingModal = (card: CreditCard, inv: any) => {
    setSettlingModal({
      card,
      period: inv.period,
      periodLabel: inv.periodLabel,
      totalAmount: inv.total,
      amountInput: inv.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "pix"
    });
  };

  const handleConfirmSettling = () => {
    if (!settlingModal) return;
    const clean = settlingModal.amountInput.replace(/\./g, "").replace(",", ".");
    const parsedAmount = parseFloat(clean);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Por favor, informe um valor válido para o pagamento da fatura.");
      return;
    }
    if (!settlingModal.paymentDate) {
      alert("Por favor, selecione a data do pagamento.");
      return;
    }

    onPostInvoiceToLedger(
      settlingModal.card,
      parsedAmount,
      settlingModal.paymentDate,
      settlingModal.periodLabel,
      settlingModal.paymentMethod,
      settlingModal.period
    );

    setSettlingModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <CreditCardIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">
                Cartões de Crédito & Faturas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Competência de referência: <strong className="text-indigo-600">{currentMonthLabel}</strong>
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewCardModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus size={16} />
          <span>Cadastrar Cartão</span>
        </button>
      </div>

      {/* Cards List or Empty State */}
      {activeCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-250 p-12 text-center flex flex-col items-center justify-center">
          <div className="p-4 bg-indigo-50 text-indigo-500 rounded-2xl mb-3">
            <CreditCardIcon size={36} className="stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Nenhum cartão de crédito cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
            Cadastre seus cartões informando o <strong>dia de virada (fechamento)</strong> e o <strong>dia de vencimento</strong>. As compras feitas no cartão serão agrupadas na fatura correta de forma 100% automática!
          </p>
          <button
            type="button"
            onClick={openNewCardModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Cadastrar Meu Primeiro Cartão</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCards.map(card => {
            const invoices = getCardInvoicesData(card);
            const activeTab = cardInvoiceTab[card.id] || "current";
            const currentInv = activeTab === "current" ? invoices.current : invoices.next;
            const colorPreset = PRESET_COLORS.find(p => p.hex.toLowerCase() === (card.color || "").toLowerCase()) || PRESET_COLORS[0];
            const isSelected = selectedCardId === card.id;

            return (
              <div
                key={card.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-md ${
                  isSelected ? "ring-2 ring-indigo-600 border-indigo-500" : "border-slate-200/80"
                }`}
              >
                {/* Visual Card banner */}
                <div className={`${colorPreset.bg} p-5 text-white relative overflow-hidden`}>
                  <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                  <div className="absolute right-10 bottom-0 translate-y-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-2">
                      <CreditCardIcon size={20} className="text-white/80" />
                      <span className="font-bold text-sm tracking-wide">{card.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditCardModal(card)}
                        className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                        title="Editar cartão"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCard(card.id)}
                        className="p-1.5 text-white/70 hover:text-rose-300 hover:bg-white/10 rounded-lg transition cursor-pointer"
                        title="Excluir cartão"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Card dates info */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/15 text-[11px] relative z-10">
                    <div>
                      <span className="text-white/70 block text-[10px] uppercase font-bold tracking-wider">Vira dia</span>
                      <span className="font-extrabold text-sm text-white">Dia {card.closingDay}</span>
                      <span className="text-[9px] text-white/60 block mt-0.5">Fechamento da fatura</span>
                    </div>
                    <div>
                      <span className="text-white/70 block text-[10px] uppercase font-bold tracking-wider">Vence dia</span>
                      <span className="font-extrabold text-sm text-white">Dia {card.dueDay}</span>
                      <span className="text-[9px] text-white/60 block mt-0.5">Vencimento da fatura</span>
                    </div>
                  </div>
                </div>

                {/* Sub-selector: Fatura Atual vs Próxima Fatura */}
                <div className="bg-slate-100/90 p-1.5 border-b border-slate-200/80 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCardInvoiceTab(prev => ({ ...prev, [card.id]: "current" }))}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      activeTab === "current"
                        ? "bg-white text-indigo-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Calendar size={12} />
                    <span>Fatura {activeMonthStr}/{String(activeYearNum).slice(2)}</span>
                    {invoices.current.isPaid && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Quitada" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCardInvoiceTab(prev => ({ ...prev, [card.id]: "next" }))}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      activeTab === "next"
                        ? "bg-white text-purple-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Layers size={12} />
                    <span>Próxima Fatura</span>
                    {invoices.next.txs.length > 0 && (
                      <span className="text-[9px] px-1 py-0.2 rounded-full bg-purple-100 text-purple-800 font-mono">
                        {invoices.next.txs.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Invoice Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {activeTab === "current" ? (
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-700">Fatura de {currentInv.periodLabel}:</span>
                        <span className="text-[10px] font-mono text-slate-400">Ciclo: {currentInv.cycleRangeStr}</span>
                      </div>
                    ) : (
                      <div className="bg-purple-50/70 border border-purple-200/70 rounded-xl p-2.5 mb-2 text-xs text-purple-900">
                        <div className="flex items-center justify-between font-bold text-[11px] mb-0.5">
                          <span>Próxima Fatura ({currentInv.periodLabel})</span>
                          <span className="text-[10px] font-mono text-purple-700">Ciclo: {currentInv.cycleRangeStr}</span>
                        </div>
                        <p className="text-[10px] text-purple-750 leading-tight">
                          ⚡ Compras a partir do dia <strong>{card.closingDay + 1}</strong> entram nesta fatura com vencimento em <strong>{currentInv.dueDateStr.split("-").reverse().join("/")}</strong>.
                        </p>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <h4 className="text-2xl font-black font-mono text-slate-800">
                          R$ {currentInv.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {currentInv.txs.length} {currentInv.txs.length === 1 ? "compra lançada" : "compras lançadas"}
                        </span>
                      </div>

                      {currentInv.isPaid ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <CheckCircle2 size={12} /> Fatura Paga no Caixa
                          </span>
                          {currentInv.paidTx && (
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                              Pago em {currentInv.paidTx.date.split("-").reverse().join("/")} via {currentInv.paidTx.paymentMethod?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={11} /> Em Aberto
                        </span>
                      )}
                    </div>

                    {card.limit && card.limit > 0 && (
                      <div className="mt-3 text-[11px] text-slate-500">
                        <div className="flex justify-between text-[10px] font-medium mb-1">
                          <span>Limite: R$ {card.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          <span>Disponível: R$ {Math.max(0, card.limit - currentInv.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (currentInv.total / card.limit) > 0.85 ? "bg-rose-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${Math.min(100, (currentInv.total / card.limit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                      className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      <Receipt size={14} />
                      <span>{isSelected ? "Ocultar Detalhes da Fatura" : `Ver ${currentInv.txs.length} Compras desta Fatura`}</span>
                    </button>

                    {currentInv.total > 0 && !currentInv.isPaid && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettlingModal(card, currentInv)}
                        className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        title="Registrar pagamento desta fatura e debitar saída do caixa"
                      >
                        <CheckCircle2 size={14} />
                        <span>Dar Baixa e Lançar no Caixa (R$ {currentInv.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed transactions list for selected card */}
                {isSelected && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                        Compras vinculadas a esta fatura ({currentInv.periodLabel}):
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {currentInv.txs.length} lançamento(s)
                      </span>
                    </div>

                    {currentInv.txs.length === 0 ? (
                      <p className="text-slate-400 italic py-2 text-center text-[11px]">
                        Nenhuma compra registrada para este cartão neste ciclo de fechamento.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {currentInv.txs.map(tx => (
                          <div
                            key={tx.id}
                            className="bg-white p-2 rounded-lg border border-slate-200/60 flex items-center justify-between shadow-3xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 block truncate">{tx.description}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Data da compra: {(tx.purchaseDate || tx.date).split("-").reverse().join("/")} • {tx.category}
                                {tx.installments && ` (Parcela ${tx.installments.current}/${tx.installments.total})`}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-rose-600 whitespace-nowrap">
                              R$ {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Baixa / Pagamento da Fatura no Caixa */}
      {settlingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Header Fixo */}
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Quitar Fatura no Caixa
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Cartão: {settlingModal.card.name} • {settlingModal.periodLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettlingModal(null)}
                className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Rolável */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cartão:</span>
                  <span className="font-bold text-slate-800">{settlingModal.card.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fatura Referência:</span>
                  <span className="font-bold text-slate-800">{settlingModal.periodLabel}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200/60 pt-1 mt-1 font-semibold">
                  <span className="text-emerald-900 font-bold">Valor Total Calculado:</span>
                  <span className="text-emerald-700 font-mono font-black text-sm">
                    R$ {settlingModal.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Valor Efetivamente Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Pago da Fatura (R$):
                </label>
                <input
                  type="text"
                  value={settlingModal.amountInput}
                  onChange={e => setSettlingModal({ ...settlingModal, amountInput: e.target.value })}
                  className="w-full text-sm font-bold font-mono px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  placeholder="0,00"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Este valor será debitado do caixa como pagamento da fatura consolidada.
                </span>
              </div>

              {/* Data do Pagamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data em que a Fatura foi Paga:
                </label>
                <input
                  type="date"
                  value={settlingModal.paymentDate}
                  onChange={e => setSettlingModal({ ...settlingModal, paymentDate: e.target.value })}
                  className="w-full text-xs font-mono font-bold px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  required
                />
              </div>

              {/* Forma de Pagamento da Fatura */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Forma de Pagamento Utilizada para Pagar a Fatura:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "pix", label: "PIX", icon: "⚡" },
                    { id: "dinheiro", label: "Dinheiro", icon: "💵" },
                    { id: "cartao_debito", label: "Débito em Conta", icon: "💳" },
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSettlingModal({ ...settlingModal, paymentMethod: method.id as PaymentMethod })}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                        settlingModal.paymentMethod === method.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span>{method.icon}</span>
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Fixo */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSettlingModal(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-650 bg-white border border-slate-250 hover:bg-slate-100 rounded-xl transition cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSettling}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer text-center"
              >
                Confirmar e Lançar no Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cadastrar / Editar Cartão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Header Fixo */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <CreditCardIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {editingCard ? "Editar Cartão de Crédito" : "Novo Cartão de Crédito"}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Defina o dia de virada da fatura e o vencimento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Rolável */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Nome do Cartão */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome / Identificação do Cartão:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank Roxinho, Visa Itaú, Mastercard Black..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Dias de Fechamento e Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dia que Vira (Fechamento):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={formClosingDay}
                      onChange={e => setFormClosingDay(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs font-bold font-mono px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">dia</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Compras após este dia caem no próximo mês.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dia de Vencimento:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={formDueDay}
                      onChange={e => setFormDueDay(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs font-bold font-mono px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">dia</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Data em que a fatura deve ser paga.
                  </span>
                </div>
              </div>

              {/* Limite Opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Limite Total do Cartão (Opcional):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={formLimitStr}
                    onChange={e => setFormLimitStr(e.target.value)}
                    className="w-full text-xs font-bold font-mono pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Cor Visual do Cartão */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Cor do Cartão:
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(preset => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setFormColor(preset.hex)}
                      className={`h-7 w-7 rounded-full transition-transform cursor-pointer flex items-center justify-center shadow-xs ${preset.bg} ${
                        formColor.toLowerCase() === preset.hex.toLowerCase()
                          ? "ring-2 ring-offset-2 ring-indigo-600 scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      title={preset.name}
                    >
                      {formColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  {editingCard ? "Salvar Alterações" : "Cadastrar Cartão"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
