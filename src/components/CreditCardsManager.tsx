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
  Info
} from "lucide-react";

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
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  paymentMethod?: PaymentMethod;
  cardId?: string;
  installments?: { current: number; total: number };
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
  onPostInvoiceToLedger: (card: CreditCard, amount: number, dueDate: string, periodLabel: string) => void;
}

const PRESET_COLORS = [
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

  // Form states
  const [formName, setFormName] = useState("");
  const [formClosingDay, setFormClosingDay] = useState<number>(25);
  const [formDueDay, setFormDueDay] = useState<number>(5);
  const [formLimitStr, setFormLimitStr] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].hex);

  // Selected card for detailed invoice inspection
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const activeYearNum = filterYear !== "todos" ? parseInt(filterYear) : new Date().getFullYear();
  const activeMonthNum = filterMonth !== "todos" ? parseInt(filterMonth) : new Date().getMonth() + 1;
  const activeMonthStr = String(activeMonthNum).padStart(2, "0");

  const currentMonthLabel = useMemo(() => {
    const found = monthsList.find(m => parseInt(m.value) === activeMonthNum);
    return found ? `${found.label} de ${activeYearNum}` : `${activeMonthStr}/${activeYearNum}`;
  }, [monthsList, activeMonthNum, activeYearNum, activeMonthStr]);

  const openNewCardModal = () => {
    setEditingCard(null);
    setFormName("");
    setFormClosingDay(25);
    setFormDueDay(5);
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

  // Helper: check if a transaction date falls into the card invoice for activeMonth/activeYear
  // Rule for invoice of activeMonth/activeYear:
  // If card closes on day C:
  // Purchases from day (C + 1) of previous month to day C of current month belong to current month's invoice!
  // Purchases AFTER day C roll into the next month's invoice!
  const getCardInvoiceTransactions = (card: CreditCard) => {
    const cDay = card.closingDay;

    // Previous month calculation
    let prevYear = activeYearNum;
    let prevMonth = activeMonthNum - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    // Start date (inclusive): previous month day (cDay + 1)
    const maxDaysPrev = new Date(prevYear, prevMonth, 0).getDate();
    const actualStartDay = Math.min(cDay + 1, maxDaysPrev);
    const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(actualStartDay).padStart(2, "0")}`;

    // End date (inclusive): current month day cDay
    const maxDaysCur = new Date(activeYearNum, activeMonthNum, 0).getDate();
    const actualEndDay = Math.min(cDay, maxDaysCur);
    const endDateStr = `${activeYearNum}-${activeMonthStr}-${String(actualEndDay).padStart(2, "0")}`;

    // Filter transactions linked to this card
    const cardTxs = transactions.filter(t => {
      if (t.type !== "saida") return false;
      const isLinkedToCard = t.cardId === card.id || (t.paymentMethod === "cartao_credito" && (!t.cardId || t.cardId === card.id));
      if (!isLinkedToCard) return false;

      // Check if transaction date is within this invoice cycle
      return t.date >= startDateStr && t.date <= endDateStr;
    });

    const totalAmount = cardTxs.reduce((acc, t) => acc + t.amount, 0);

    // Formatted cycle range
    const cycleRangeStr = `${String(actualStartDay).padStart(2, "0")}/${String(prevMonth).padStart(2, "0")} até ${String(actualEndDay).padStart(2, "0")}/${activeMonthStr}`;

    // Due date of invoice
    const maxDaysDue = new Date(activeYearNum, activeMonthNum, 0).getDate();
    const actualDueDay = Math.min(card.dueDay, maxDaysDue);
    const dueDateStr = `${activeYearNum}-${activeMonthStr}-${String(actualDueDay).padStart(2, "0")}`;

    // Check if an invoice transaction already exists for this card in this month
    const isAlreadyPosted = transactions.some(t => 
      t.caixaId === activeCaixaId &&
      t.type === "saida" &&
      t.description.toLowerCase().includes("fatura") &&
      t.description.toLowerCase().includes(card.name.toLowerCase()) &&
      t.date.startsWith(`${activeYearNum}-${activeMonthStr}`)
    );

    return {
      cardTxs,
      totalAmount,
      cycleRangeStr,
      dueDateStr,
      actualDueDay,
      actualEndDay,
      isAlreadyPosted
    };
  };

  const activeCards = creditCards.filter(c => !c.caixaId || c.caixaId === activeCaixaId);

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
                Competência de análise: <strong className="text-indigo-600">{currentMonthLabel}</strong>
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
            Cadastre seus cartões de crédito informando o <strong>dia que o cartão vira (fechamento)</strong> e o <strong>dia de vencimento</strong>. As compras feitas no cartão serão agrupadas na fatura correta de forma 100% automática!
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
            const invoice = getCardInvoiceTransactions(card);
            const colorPreset = PRESET_COLORS.find(p => p.hex.toLowerCase() === (card.color || "").toLowerCase()) || PRESET_COLORS[0];
            const isSelected = selectedCardId === card.id;

            return (
              <div
                key={card.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-md ${
                  isSelected ? "ring-2 ring-indigo-600 border-indigo-500" : "border-slate-200/80"
                }`}
              >
                {/* Visual Card simulation banner */}
                <div className={`${colorPreset.bg} p-5 text-white relative overflow-hidden`}>
                  {/* Background circles */}
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

                {/* Invoice Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Fatura do Mês ({currentMonthLabel}):</span>
                      <span className="text-[10px] font-mono text-slate-400">Ciclo: {invoice.cycleRangeStr}</span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <h4 className="text-2xl font-black font-mono text-slate-800">
                        R$ {invoice.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </h4>

                      {invoice.isAlreadyPosted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Lançada no Caixa
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Em Aberto
                        </span>
                      )}
                    </div>

                    {card.limit && card.limit > 0 && (
                      <div className="mt-3 text-[11px] text-slate-500">
                        <div className="flex justify-between text-[10px] font-medium mb-1">
                          <span>Limite: R$ {card.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          <span>Disponível: R$ {Math.max(0, card.limit - invoice.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (invoice.totalAmount / card.limit) > 0.85 ? "bg-rose-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${Math.min(100, (invoice.totalAmount / card.limit) * 100)}%` }}
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
                      <span>{isSelected ? "Ocultar Detalhes da Fatura" : `Ver ${invoice.cardTxs.length} Compras da Fatura`}</span>
                    </button>

                    {invoice.totalAmount > 0 && !invoice.isAlreadyPosted && (
                      <button
                        type="button"
                        onClick={() => onPostInvoiceToLedger(card, invoice.totalAmount, invoice.dueDateStr, currentMonthLabel)}
                        className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        title="Lançar valor da fatura como despesa do mês no extrato"
                      >
                        <CheckCircle2 size={14} />
                        <span>Lançar Fatura no Caixa (Dia {invoice.actualDueDay})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed transactions list for selected card */}
                {isSelected && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                        Compras vinculadas a esta fatura:
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {invoice.cardTxs.length} lançamento(s)
                      </span>
                    </div>

                    {invoice.cardTxs.length === 0 ? (
                      <p className="text-slate-400 italic py-2 text-center text-[11px]">
                        Nenhuma compra registrada para este cartão no ciclo de fechamento de {currentMonthLabel}.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {invoice.cardTxs.map(tx => (
                          <div
                            key={tx.id}
                            className="bg-white p-2 rounded-lg border border-slate-200/60 flex items-center justify-between shadow-3xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 block truncate">{tx.description}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Data da compra: {tx.date.split("-").reverse().join("/")} • {tx.category}
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

      {/* MODAL: Cadastrar / Editar Cartão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex justify-between items-center">
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

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
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
                      onChange={e => setFormClosingDay(parseInt(e.target.value) || 1)}
                      className="w-full text-xs font-bold font-mono px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">dia</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Compras a partir deste dia caem no próximo mês.
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
                      onChange={e => setFormDueDay(parseInt(e.target.value) || 1)}
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

              {/* Buttons */}
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
