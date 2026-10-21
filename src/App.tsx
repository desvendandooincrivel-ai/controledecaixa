import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Search,
  Sparkles,
  Download,
  Upload,
  X,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Grid,
  Edit2,
  Check,
  AlertCircle,
  Repeat,
  Clock,
  Building,
  User,
  MapPin,
  Lock,
  ArrowUpDown,
  Printer,
  ChevronDown,
  AlertTriangle,
  Cloud,
  CloudOff,
  Database,
  Key,
  CreditCard as CreditCardIcon,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeadpageDashboard } from "./components/LeadpageDashboard";
import { CategoriesManager } from "./components/CategoriesManager";
import { CategoryBulkTransferModal } from "./components/CategoryBulkTransferModal";
import { CategorySelectionModal } from "./components/CategorySelectionModal";
import { resolveCategoryColorHex } from "./utils/categoryColor";
import { ActivityLogPanel, ActivityLog } from "./components/ActivityLogPanel";
import { ExecutiveReportModal } from "./components/ExecutiveReportModal";
import { RentalReportModal } from "./components/RentalReportModal";
import { AccountantReportModal } from "./components/AccountantReportModal";
import { DepositDetailModal, calculateMonthsDifference } from "./components/DepositDetailModal";
import { CreditCardsManager, CreditCard as CreditCardData, PaymentMethod } from "./components/CreditCardsManager";
import { AppUpdateModal, AppUpdateInfo } from "./components/AppUpdateModal";
import { getCreditCardCycleForPurchase } from "./utils/creditCardCycle";

// Interfaces
interface Caixa {
  id: string;
  name: string;
}

export type { PaymentMethod };
export type CreditCard = CreditCardData;

interface Transaction {
  id: string;
  caixaId: string;
  date: string; // YYYY-MM-DD
  purchaseDate?: string; // Data real da compra quando no cartão
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  paymentMethod?: PaymentMethod;
  cardId?: string;
  fixedTemplateId?: string;
  installments?: { current: number; total: number };
  invoicePeriod?: string; // "YYYY-MM" competência da fatura
  isCardInvoicePayment?: boolean; // Se é a baixa/quitação da fatura no caixa
  invoicePaid?: boolean; // Se a compra já teve a fatura quitada
  invoicePaymentTxId?: string; // ID da transação da fatura paga
}

interface Category {
  id: string;
  name: string;
  type: "entrada" | "saida";
  color: string;
}

interface FixedTemplate {
  id: string;
  caixaId: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  dueDay: number;
  status: "ativo" | "inativo";
}

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
  paymentAmounts?: Record<string, number>; // Valor efetivamente repassado pela imobiliária por competência
  paymentAdjustments?: Record<string, RentalPaymentAdjustment>; // Diferenças e alertas de repasse por competência
  hasDeposit?: boolean;
  depositMonthsCount?: number;
  depositAmount?: number;
  depositStartDate?: string;
  depositInterestRate?: number;
  depositCorrectionMode?: "fixed" | "bcb";
  adjustmentMode?: "add" | "subtract";
  adjustmentAmount?: number;
  adjustmentReason?: string;
  adjustments?: RentalItemAdjustment[];
  guaranteeType?: "caucao" | "fiador" | "nenhuma";
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorCpf?: string;
}

export interface RentalItemAdjustment {
  id: string;
  mode: "add" | "subtract";
  amount: number;
  description: string;
  recurrence: "fixo" | "pontual";
  targetPeriod?: string; // "YYYY-MM"
  createdAt?: string;
}

export interface RentalPaymentPart {
  id: string;
  amount: number;
  date: string;
  paymentMethod: string;
  observation?: string;
  txId?: string;
}

export interface RentalPaymentAdjustment {
  period: string;
  expectedAmount: number;
  receivedAmount: number;
  difference: number;
  status: "pending" | "forgiven" | "charged";
  dueDate: string;
  graceDate: string;
  receivedDate?: string;
  daysAfterDue: number;
  daysAfterGrace: number;
  lateFeeStatus: "none" | "suggested" | "waived" | "charged";
  createdAt: string;
  note?: string;
  paymentMethod?: string;
  observation?: string;
  parts?: RentalPaymentPart[];
}

export const RENTAL_PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro / Espécie", icon: "💵" },
  { id: "pix", label: "PIX", icon: "⚡" },
  { id: "transferencia", label: "Transferência / TED", icon: "🏦" },
  { id: "cartao_debito", label: "Cartão de Débito", icon: "💳" },
  { id: "cartao_credito", label: "Cartão de Crédito", icon: "💳" },
  { id: "boleto", label: "Boleto Bancário", icon: "📄" },
  { id: "outro", label: "Outro", icon: "🔄" }
];

export const getRentalPaymentMethodLabel = (id?: string) => {
  const found = RENTAL_PAYMENT_METHODS.find(m => m.id === id);
  return found ? `${found.icon} ${found.label}` : id || "Dinheiro";
};

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

const clampDayToMonth = (year: string | number, month: string | number, day: number) => {
  const yearNum = Number(year);
  const monthNum = Number(month);
  const safeDay = Number.isFinite(day) && day > 0 ? day : 1;
  const maxDays = new Date(yearNum, monthNum, 0).getDate();
  return Math.min(safeDay, maxDays);
};

const addDaysToDateInput = (dateStr: string, days: number) => {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateInputValue(date);
};

export const getRentalApplicableAdjustments = (rental: RentalProperty, period?: string): RentalItemAdjustment[] => {
  const result: RentalItemAdjustment[] = [];
  if (rental.adjustments && Array.isArray(rental.adjustments)) {
    rental.adjustments.forEach(adj => {
      if (adj.recurrence === "fixo") {
        result.push(adj);
      } else if (!period || adj.targetPeriod === period) {
        result.push(adj);
      }
    });
  } else if (rental.adjustmentAmount && rental.adjustmentAmount > 0) {
    result.push({
      id: "legacy-adj-" + rental.id,
      mode: rental.adjustmentMode || "add",
      amount: rental.adjustmentAmount,
      description: rental.adjustmentReason || "Ajuste de valor",
      recurrence: "fixo"
    });
  }
  return result;
};

export const getRentalAdjustmentsNetTotal = (rental: RentalProperty, period?: string): number => {
  const adjs = getRentalApplicableAdjustments(rental, period);
  return adjs.reduce((sum, a) => a.mode === "subtract" ? sum - a.amount : sum + a.amount, 0);
};

const getRentalExpectedAmount = (rental: RentalProperty, period?: string) => {
  const base = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
  const netAdj = getRentalAdjustmentsNetTotal(rental, period);
  return base + netAdj;
};

const getPendingRentalCarryover = (rental: RentalProperty, currentPeriod?: string) => {
  return Object.values(rental.paymentAdjustments || {})
    .filter(adj => adj.status === "pending" && adj.difference > 0 && (!currentPeriod || adj.period < currentPeriod))
    .reduce((sum, adj) => sum + adj.difference, 0);
};

const getRentalPeriodDates = (period: string, dueDay: number) => {
  const [year, month] = period.split("-").map(Number);
  const actualDueDay = clampDayToMonth(year, month, dueDay);
  const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;
  const graceDate = addDaysToDateInput(dueDate, 2);
  return { dueDate, graceDate };
};

// Categories definitions
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

// Color mapping for categories
const CATEGORY_COLORS: { [key: string]: string } = {
  // Entradas
  "Vendas": "bg-emerald-500",
  "Salário": "bg-cyan-500",
  "Serviços": "bg-indigo-500",
  "Aluguéis Ativos": "bg-sky-500",
  "Investimentos": "bg-teal-500",
  "Crédito": "bg-emerald-400",
  "Outras Receitas": "bg-slate-400",
  // Saídas
  "Alimentação": "bg-amber-500",
  "Moradia (Aluguel/IPTU)": "bg-red-550",
  "Combustível": "bg-orange-550",
  "Contas de Consumo (Luz/Água)": "bg-sky-600",
  "Impostos & Tributos (IPTU/IR)": "bg-purple-600",
  "Financiamento/Carro": "bg-blue-600",
  "Transporte": "bg-blue-400",
  "Saúde": "bg-rose-500",
  "Lazer": "bg-pink-500",
  "Suprimentos": "bg-orange-400",
  "Serviços Contratados": "bg-violet-500",
  "Outras Despesas": "bg-zinc-500"
};

const CATEGORY_BORDER_COLORS: { [key: string]: string } = {
  // Entradas
  "Vendas": "border-emerald-500 text-emerald-700 bg-emerald-50",
  "Salário": "border-cyan-500 text-cyan-700 bg-cyan-50",
  "Serviços": "border-indigo-500 text-indigo-700 bg-indigo-50",
  "Aluguéis Ativos": "border-sky-500 text-sky-700 bg-sky-50",
  "Investimentos": "border-teal-500 text-teal-700 bg-teal-50",
  "Crédito": "border-emerald-400 text-emerald-800 bg-emerald-50",
  "Outras Receitas": "border-slate-400 text-slate-700 bg-slate-50",
  // Saídas
  "Alimentação": "border-amber-500 text-amber-700 bg-amber-50",
  "Moradia (Aluguel/IPTU)": "border-red-500 text-red-750 bg-red-50",
  "Combustível": "border-orange-500 text-orange-700 bg-orange-50",
  "Contas de Consumo (Luz/Água)": "border-sky-500 text-sky-700 bg-sky-50",
  "Impostos & Tributos (IPTU/IR)": "border-purple-500 text-purple-700 bg-purple-50",
  "Financiamento/Carro": "border-blue-500 text-blue-750 bg-blue-50",
  "Transporte": "border-blue-400 text-blue-700 bg-blue-50",
  "Saúde": "border-rose-500 text-rose-700 bg-rose-50",
  "Lazer": "border-pink-500 text-pink-700 bg-pink-50",
  "Suprimentos": "border-orange-400 text-orange-700 bg-orange-50",
  "Serviços Contratados": "border-violet-500 text-violet-700 bg-violet-50",
  "Outras Despesas": "border-zinc-500 text-zinc-700 bg-zinc-50"
};

const COLOR_CLASSES_MAP: { [key: string]: { bg: string, badge: string, hex: string, label: string } } = {
  "bg-emerald-500": { bg: "bg-emerald-500", badge: "border-emerald-300 text-emerald-700 bg-emerald-50", hex: "#10b981", label: "Esmeralda" },
  "bg-cyan-500": { bg: "bg-cyan-500", badge: "border-cyan-300 text-cyan-700 bg-cyan-50", hex: "#06b6d4", label: "Ciano" },
  "bg-indigo-500": { bg: "bg-indigo-500", badge: "border-indigo-300 text-indigo-700 bg-indigo-50", hex: "#6366f1", label: "Índigo" },
  "bg-sky-500": { bg: "bg-sky-500", badge: "border-sky-300 text-sky-700 bg-sky-50", hex: "#0ea5e9", label: "Azul Céu" },
  "bg-sky-600": { bg: "bg-sky-600", badge: "border-sky-300 text-sky-800 bg-sky-50", hex: "#0284c7", label: "Azul Escuro" },
  "bg-teal-500": { bg: "bg-teal-500", badge: "border-teal-300 text-teal-700 bg-teal-50", hex: "#14b8a6", label: "Teal" },
  "bg-emerald-400": { bg: "bg-emerald-400", badge: "border-emerald-300 text-emerald-800 bg-emerald-50", hex: "#34d399", label: "Verde Claro" },
  "bg-slate-400": { bg: "bg-slate-400", badge: "border-slate-300 text-slate-700 bg-slate-50", hex: "#94a3b8", label: "Cinza Claro" },
  "bg-slate-500": { bg: "bg-slate-500", badge: "border-slate-300 text-slate-700 bg-slate-50", hex: "#64748b", label: "Slate" },
  "bg-amber-500": { bg: "bg-amber-500", badge: "border-amber-300 text-amber-700 bg-amber-50", hex: "#f59e0b", label: "Âmbar/Laranja" },
  "bg-red-500": { bg: "bg-red-500", badge: "border-red-300 text-red-700 bg-red-50", hex: "#ef4444", label: "Vermelho" },
  "bg-red-550": { bg: "bg-red-550", badge: "border-red-350 text-red-750 bg-red-50", hex: "#b91c1c", label: "Vermelho Escuro" },
  "bg-orange-500": { bg: "bg-orange-500", badge: "border-orange-300 text-orange-700 bg-orange-50", hex: "#f97316", label: "Laranja" },
  "bg-orange-550": { bg: "bg-orange-550", badge: "border-orange-350 text-orange-750 bg-orange-50", hex: "#c2410c", label: "Cenoura" },
  "bg-purple-600": { bg: "bg-purple-600", badge: "border-purple-300 text-purple-700 bg-purple-50", hex: "#a855f7", label: "Roxo" },
  "bg-blue-600": { bg: "bg-blue-600", badge: "border-blue-300 text-blue-750 bg-blue-50", hex: "#2563eb", label: "Azul" },
  "bg-blue-400": { bg: "bg-blue-400", badge: "border-blue-300 text-blue-700 bg-blue-50", hex: "#60a5fa", label: "Azul Claro" },
  "bg-rose-500": { bg: "bg-rose-500", badge: "border-rose-300 text-rose-700 bg-rose-50", hex: "#f43f5e", label: "Rose" },
  "bg-pink-500": { bg: "bg-pink-500", badge: "border-pink-300 text-pink-700 bg-pink-50", hex: "#ec4899", label: "Rosa" },
  "bg-orange-400": { bg: "bg-orange-400", badge: "border-orange-350 text-orange-850 bg-orange-50", hex: "#fb923c", label: "Salmão" },
  "bg-violet-500": { bg: "bg-violet-500", badge: "border-violet-300 text-violet-700 bg-violet-50", hex: "#8b5cf6", label: "Toque Violeta" },
  "bg-zinc-500": { bg: "bg-zinc-500", badge: "border-zinc-300 text-zinc-700 bg-zinc-50", hex: "#71717a", label: "Cinza Escuro" },
};

const INITIAL_CAIXAS: Caixa[] = [
  { id: "principal", name: "Caixa Principal" },
  { id: "contratos_de_aluguel", name: "Contratos de Aluguel" }
];

export const INITIAL_RENTALS = (): RentalProperty[] => [];
export const INITIAL_FIXED_TEMPLATES = (): FixedTemplate[] => [];
export const INITIAL_CREDIT_CARDS = (): CreditCardData[] => [];
export const INITIAL_TRANSACTIONS = (): Transaction[] => [];
export const INITIAL_LOGS = (): ActivityLog[] => [];

export default function App() {
   // Load initial state from LocalStorage or backup seeds
  const [caixas, setCaixas] = useState<Caixa[]>(() => {
    const saved = localStorage.getItem("caixa_contas");
    let loaded: Caixa[] = saved ? JSON.parse(saved) : [...INITIAL_CAIXAS];
    
    // Ensure "Contratos de Aluguel" always exists as an option
    const hasRentalCaixa = loaded.some(c => c.id === "contratos_de_aluguel" || c.name.toLowerCase().includes("contratos de aluguel") || c.name.toLowerCase().includes("aluguéis"));
    if (!hasRentalCaixa) {
      loaded.push({ id: "contratos_de_aluguel", name: "Contratos de Aluguel" });
      localStorage.setItem("caixa_contas", JSON.stringify(loaded));
    }
    return loaded;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem("caixa_transacoes");
    const list: Transaction[] = saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS();
    // Migration: ensure rental transactions that were mistakenly saved as "Vendas" or duplicate rental category names are normalized to "Aluguéis Ativos"
    return list.map(t => {
      const isRental = 
        (t.id && t.id.startsWith("tx-rent-")) || 
        (t.description && (t.description.startsWith("[Aluguel ") || t.description.toLowerCase().includes("aluguel conciliado")));
      const isRentalCat = t.category && (
        t.category.toLowerCase().trim() === "aluguéis ativos" || 
        t.category.toLowerCase().trim() === "alugueis ativos"
      );
      if ((isRental && (t.category === "Vendas" || !t.category)) || isRentalCat) {
        return { ...t, category: "Aluguéis Ativos" };
      }
      return t;
    });
  });

  const [activeCaixaId, setActiveCaixaId] = useState<string>("principal");

  const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("caixa_deleted_categories");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.error("Error parsing deleted categories", err);
      }
    }
    return [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const savedDeleted = localStorage.getItem("caixa_deleted_categories");
    let deletedList: string[] = [];
    if (savedDeleted) {
      try {
        deletedList = JSON.parse(savedDeleted);
      } catch (e) {}
    }

    const isDeleted = (name: string, id?: string) => {
      const lowerName = name.trim().toLowerCase();
      return deletedList.some(d => d.toLowerCase() === lowerName || (id && d === id));
    };

    const saved = localStorage.getItem("caixa_categorias");
    let loaded: Category[] = [];
    if (saved) {
      try {
        loaded = JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing categories", err);
      }
    }
    if (!Array.isArray(loaded) || loaded.length === 0) {
      const initial: Category[] = [];
      CATEGORIES_ENTRADA.forEach(name => {
        const id = `cat-in-${name.replace(/\s+/g, '-').toLowerCase()}`;
        if (!isDeleted(name, id)) {
          initial.push({
            id,
            name,
            type: "entrada",
            color: CATEGORY_COLORS[name] || "bg-emerald-500"
          });
        }
      });
      CATEGORIES_SAIDA.forEach(name => {
        const id = `cat-out-${name.replace(/\s+/g, '-').toLowerCase()}`;
        if (!isDeleted(name, id)) {
          initial.push({
            id,
            name,
            type: "saida",
            color: CATEGORY_COLORS[name] || "bg-rose-500"
          });
        }
      });
      return initial;
    }

    // Filter out any previously deleted category if still in array
    loaded = loaded.filter(c => !isDeleted(c.name, c.id));

    // Ensure dedicated rental category and other defaults exist ONLY IF NOT EXCLUDED
    CATEGORIES_ENTRADA.forEach(name => {
      const defaultId = `cat-in-${name.replace(/\s+/g, '-').toLowerCase()}`;
      if (!isDeleted(name, defaultId) && !loaded.some(c => c.name.toLowerCase() === name.toLowerCase() && c.type === "entrada")) {
        let id = defaultId;
        if (loaded.some(c => c.id === id)) {
          id = `cat-in-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        }
        loaded.push({
          id,
          name,
          type: "entrada",
          color: resolveCategoryColorHex(CATEGORY_COLORS[name], name, "entrada")
        });
      }
    });
    CATEGORIES_SAIDA.forEach(name => {
      const defaultId = `cat-out-${name.replace(/\s+/g, '-').toLowerCase()}`;
      if (!isDeleted(name, defaultId) && !loaded.some(c => c.name.toLowerCase() === name.toLowerCase() && c.type === "saida")) {
        let id = defaultId;
        if (loaded.some(c => c.id === id)) {
          id = `cat-out-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        }
        loaded.push({
          id,
          name,
          type: "saida",
          color: resolveCategoryColorHex(CATEGORY_COLORS[name], name, "saida")
        });
      }
    });

    // Auto-deduplicate categories (keep only one per normalized name and type)
    // Guarantee that "Aluguéis Ativos" has its canonical ID and color
    const uniqueMap = new Map<string, Category>();
    loaded.forEach(cat => {
      const norm = cat.name.trim().toLowerCase();
      const key = `${norm}__${cat.type}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cat);
      } else {
        // If one of the duplicates is the canonical "cat-in-aluguéis-ativos" or "Aluguéis Ativos", prioritize it
        const current = uniqueMap.get(key)!;
        if (norm === "aluguéis ativos" || norm === "alugueis ativos") {
          if (cat.id === "cat-in-aluguéis-ativos" || cat.id === "cat-in-alugueis-ativos") {
            uniqueMap.set(key, { ...cat, name: "Aluguéis Ativos" });
          }
        }
      }
    });

    // CRITICAL: Guarantee every single category has a strictly UNIQUE id and valid hex color!
    const seenCategoryIds = new Set<string>();
    let idRepaired = false;
    const deduped = Array.from(uniqueMap.values()).map(cat => {
      let finalId = cat.id;
      if (!finalId || seenCategoryIds.has(finalId)) {
        idRepaired = true;
        finalId = `cat-${cat.type === "entrada" ? "in" : "out"}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      seenCategoryIds.add(finalId);
      const cleanColor = resolveCategoryColorHex(cat.color, cat.name, cat.type);
      if (cleanColor !== cat.color) {
        idRepaired = true;
      }
      return {
        ...cat,
        id: finalId,
        color: cleanColor
      };
    });

    if (idRepaired) {
      try {
        localStorage.setItem("caixa_categories", JSON.stringify(deduped));
      } catch (e) {
        console.error("Failed to save repaired categories", e);
      }
    }

    return deduped;
  });

  const getCategoryBgColor = (catName: string) => {
    const found = categories.find(c => c.name === catName);
    return resolveCategoryColorHex(found?.color, catName, "saida");
  };

  const getCategoryColorHex = (catName: string): string => {
    const found = categories.find(c => c.name === catName);
    return resolveCategoryColorHex(found?.color, catName, "saida");
  };

  const getCategoryBadgeStyle = (catName: string, type: "entrada" | "saida" = "saida") => {
    const found = categories.find(c => c.name === catName);
    const colorClass = found ? found.color : (CATEGORY_COLORS[catName] || (type === "entrada" ? "bg-emerald-500" : "bg-zinc-500"));
    const mapped = COLOR_CLASSES_MAP[colorClass];
    if (mapped) return mapped.badge;
    return CATEGORY_BORDER_COLORS[catName] || (type === "entrada" ? "border-emerald-350 text-emerald-700 bg-emerald-50" : "border-zinc-300 text-zinc-700 bg-zinc-50");
  };

  const getCategoryBadgeInlineStyle = (catName: string, type: "entrada" | "saida" = "saida") => {
    const found = categories.find(c => c.name === catName);
    const hex = resolveCategoryColorHex(found?.color, catName, type);
    return {
      backgroundColor: `${hex}14`,
      borderColor: `${hex}38`,
      color: hex
    };
  };

  // Filter conditions
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    return String(new Date().getMonth() + 1).padStart(2, "0");
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });

  const activePeriodStr = useMemo(() => {
    return filterYear !== "todos" && filterMonth !== "todos"
      ? `${filterYear}-${filterMonth}`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  }, [filterYear, filterMonth]);

  // Overview Donut Charts active tab (3 graphs view, Saidas, Entradas, Misto)
  const [overviewChartTab, setOverviewChartTab] = useState<"todos" | "saidas" | "entradas" | "misto">("todos");

  // Current Input Form states
  const [formDate, setFormDate] = useState(() => {
    return getLocalDateInputValue();
  });
  const [formDescription, setFormDescription] = useState("");
  const [formAmountStr, setFormAmountStr] = useState("");
  const [formCategory, setFormCategory] = useState("Vendas");

  // Selection state for category modal on save
  const [categorySelectionModal, setCategorySelectionModal] = useState<{
    isOpen: boolean;
    type: "entrada" | "saida";
    selectedCategory: string;
  }>({
    isOpen: false,
    type: "entrada",
    selectedCategory: "Vendas",
  });

  // Google OAuth & Sync States
  const [googleClientId, setGoogleClientId] = useState(() => {
    return localStorage.getItem("caixa_google_client_id") || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";
  });
  const [accessToken, setAccessToken] = useState("");
  const [isGoogleConnected, setIsGoogleConnected] = useState(() => {
    return localStorage.getItem("caixa_google_connected") === "true";
  });
  const [userGoogleInfo, setUserGoogleInfo] = useState<{name: string, email: string, picture: string} | null>(() => {
    const saved = localStorage.getItem("caixa_google_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [isGoogleConfigModalOpen, setIsGoogleConfigModalOpen] = useState(false);

  // Modals & UI Controls
  const [isNewCaixaModalOpen, setIsNewCaixaModalOpen] = useState(false);
  const [newCaixaName, setNewCaixaName] = useState("");

  const [isRenameCaixaModalOpen, setIsRenameCaixaModalOpen] = useState(false);
  const [renameCaixaName, setRenameCaixaName] = useState("");

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Carryover starting balance (Saldo Anterior) configuration
  const [includeSaldoAnterior, setIncludeSaldoAnterior] = useState<boolean>(() => {
    const saved = localStorage.getItem("caixa_include_saldo_anterior");
    return saved ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("caixa_include_saldo_anterior", String(includeSaldoAnterior));
  }, [includeSaldoAnterior]);

  // AI Insights states
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState(false);
  const [isAccountantReportOpen, setIsAccountantReportOpen] = useState(false);
  const [isRentalReportOpen, setIsRentalReportOpen] = useState(false);
  const [selectedRentalIdForReport, setSelectedRentalIdForReport] = useState<string | null>(null);
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(false);
  const [hideAlertsBanner, setHideAlertsBanner] = useState<boolean>(false);

  // Auto cleanup existing demo data on initial load
  useEffect(() => {
    if (localStorage.getItem("caixa_demo_cleaned_v107") !== "true") {
      localStorage.setItem("caixa_demo_cleaned_v107", "true");

      const savedTxs = localStorage.getItem("caixa_transacoes");
      if (savedTxs && (savedTxs.includes("tx-2026-10-01") || savedTxs.includes("Pró-labore Diretor") || savedTxs.includes("Consultoria Tecnológica"))) {
        localStorage.removeItem("caixa_transacoes");
        setTransactions([]);
      }

      const savedRentals = localStorage.getItem("caixa_alugueis_fixos");
      if (savedRentals && (savedRentals.includes("rent-lf01") || savedRentals.includes("Carlos Eduardo Silva") || savedRentals.includes("Mariana Souza"))) {
        localStorage.removeItem("caixa_alugueis_fixos");
        setRentals([]);
      }

      const savedFixed = localStorage.getItem("caixa_templates_fixos");
      if (savedFixed && (savedFixed.includes("Internet Fibra Dedicada") || savedFixed.includes("fix-demo-"))) {
        localStorage.removeItem("caixa_templates_fixos");
        setFixedTemplates([]);
      }

      const savedCards = localStorage.getItem("caixa_cartoes_credito");
      if (savedCards && (savedCards.includes("Nubank Ultravioleta") || savedCards.includes("Itaú Personnalité"))) {
        localStorage.removeItem("caixa_cartoes_credito");
        setCreditCards([]);
      }

      const savedLogs = localStorage.getItem("caixa_activity_logs");
      if (savedLogs && savedLogs.includes("Base de dados fictícia")) {
        localStorage.removeItem("caixa_activity_logs");
        setActivityLogs([]);
      }
    }
  }, []);

  // App Update System state & functions
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const checkForUpdates = async (simulate = false, manual = false) => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch(`/api/app-update/check${simulate ? "?simulate=true" : ""}`);
      if (!res.ok) throw new Error("Falha na consulta de atualização");
      const data: AppUpdateInfo = await res.json();
      setUpdateInfo(data);

      if (data.hasUpdate) {
        const snoozedUntil = localStorage.getItem("update_snoozed_until");
        const isSnoozed = snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();
        const dismissedVer = localStorage.getItem("update_dismissed_version");
        const isDismissed = dismissedVer === data.latestVersion;

        if (manual) {
          setIsUpdateModalOpen(true);
        } else if (!isSnoozed && !isDismissed) {
          setShowUpdateBanner(true);
        }
      } else if (manual) {
        setIsUpdateModalOpen(true);
      }
    } catch (err) {
      console.warn("Erro ao buscar atualizações:", err);
      if (manual) {
        setUpdateInfo({
          hasUpdate: false,
          currentVersion: "1.0.9",
          latestVersion: "1.0.9",
          releaseName: "Versão 1.0.9",
          releaseNotes: "Não foi possível conectar ao servidor de atualizações do GitHub no momento. Verifique sua conexão com a internet.",
          publishedAt: new Date().toISOString(),
          downloadUrl: "https://github.com/desvendandooincrivel-ai/caixaatt",
          installerUrl: null
        });
        setIsUpdateModalOpen(true);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSnoozeUpdate = () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    localStorage.setItem("update_snoozed_until", tomorrow.toISOString());
    setShowUpdateBanner(false);
  };

  const handleDismissVersion = (ver: string) => {
    localStorage.setItem("update_dismissed_version", ver);
    setShowUpdateBanner(false);
  };

  // Background automatic check for updates on app launch
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false, false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Editing transaction state (Inline/Modal)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState<"entrada" | "saida" >("entrada");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [editCardId, setEditCardId] = useState<string>("");

  // Payment method and card input states for transaction form
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [formCardId, setFormCardId] = useState<string>("");
  const [formInstallmentsCount, setFormInstallmentsCount] = useState<number>(1);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("todos");

  // Credit Cards Management State
  const [creditCards, setCreditCards] = useState<CreditCardData[]>(() => {
    const saved = localStorage.getItem("caixa_cartoes_credito");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.error("Error parsing credit cards", err);
      }
    }
    return INITIAL_CREDIT_CARDS();
  });

  useEffect(() => {
    localStorage.setItem("caixa_cartoes_credito", JSON.stringify(creditCards));
  }, [creditCards]);

  const activeCards = useMemo(() => {
    return creditCards.filter(c => !c.caixaId || c.caixaId === activeCaixaId);
  }, [creditCards, activeCaixaId]);

  // Retroactive migration for credit card transactions (populate invoicePeriod / purchaseDate / rollover dates)
  useEffect(() => {
    if (localStorage.getItem("caixa_credit_card_cycle_v110") !== "true") {
      localStorage.setItem("caixa_credit_card_cycle_v110", "true");
      setTransactions(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment) {
            const card = creditCards.find(c => c.id === t.cardId) || creditCards[0];
            const closingDay = card?.closingDay || 15;
            const dueDay = card?.dueDay || 25;
            const purchaseDate = t.purchaseDate || t.date;
            const instIdx = t.installments ? (t.installments.current - 1) : 0;
            const cycle = getCreditCardCycleForPurchase(purchaseDate, closingDay, dueDay, instIdx);

            if (!t.invoicePeriod || !t.purchaseDate || (t.date !== cycle.dueDate && t.date === purchaseDate && cycle.isNextMonth)) {
              changed = true;
              return {
                ...t,
                purchaseDate: purchaseDate,
                invoicePeriod: cycle.invoicePeriod,
                date: cycle.dueDate,
                invoicePaid: t.invoicePaid ?? false
              };
            }
          }
          return t;
        });
        return changed ? updated : prev;
      });
    }
  }, [creditCards]);

  // Modal for Confirming/Adjusting Fixed Expense launch (cents adjustment, date, payment method)
  const [confirmingFixedTpl, setConfirmingFixedTpl] = useState<FixedTemplate | null>(null);
  const [confirmFixedAmountStr, setConfirmFixedAmountStr] = useState<string>("");
  const [confirmFixedDate, setConfirmFixedDate] = useState<string>("");
  const [confirmFixedPaymentMethod, setConfirmFixedPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [confirmFixedCardId, setConfirmFixedCardId] = useState<string>("");
  const [confirmFixedUpdateTemplate, setConfirmFixedUpdateTemplate] = useState<boolean>(false);
  const [confirmFixedUpdateExistingTx, setConfirmFixedUpdateExistingTx] = useState<boolean>(true);

  // Modal for Editing Base Fixed Template & already posted value
  const [editingFixedTpl, setEditingFixedTpl] = useState<FixedTemplate | null>(null);
  const [editFixedDesc, setEditFixedDesc] = useState<string>("");
  const [editFixedAmountStr, setEditFixedAmountStr] = useState<string>("");
  const [editFixedDueDay, setEditFixedDueDay] = useState<number>(1);
  const [editFixedCategory, setEditFixedCategory] = useState<string>("");
  const [editFixedType, setEditFixedType] = useState<"entrada" | "saida">("saida");
  const [editFixedUpdateMonthTx, setEditFixedUpdateMonthTx] = useState<boolean>(true);
  // Category Bulk Transfer and Interactive Deletion Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [categoryModalMode, setCategoryModalMode] = useState<"transfer" | "delete">("transfer");
  const [categoryModalSourceId, setCategoryModalSourceId] = useState<string>("");

  // Subtab for Extrato, Fixed templates, Credit Cards, etc.
  const [subTab, setSubTab] = useState<"extrato" | "fixas" | "cartoes" | "alugueis" | "categorias" | "logs" | "relatorio">("extrato");

  // Activity Logs implementation
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem("caixa_activity_logs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_LOGS();
  });

  const addLogEntry = (type: string, description: string, amount?: number, customCaixaId?: string) => {
    const newLog: ActivityLog = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      type,
      description,
      amount,
      caixaId: customCaixaId || activeCaixaId
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  // Recurring/Fixed templates states
  const [fixedTemplates, setFixedTemplates] = useState<FixedTemplate[]>(() => {
    const saved = localStorage.getItem("caixa_templates_fixos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.error("Error parsing fixed templates", err);
      }
    }
    return INITIAL_FIXED_TEMPLATES();
  });

  // Rental Properties (Gestão de Aluguéis LF) state
  const [rentals, setRentals] = useState<RentalProperty[]>(() => {
    const saved = localStorage.getItem("caixa_alugueis_fixos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.error("Error parsing rentals", err);
      }
    }
    return INITIAL_RENTALS();
  });

  // Rental properties sorting states
  const [rentalSortField, setRentalSortField] = useState<"lfCode" | "tenantName" | "dueDay" | "rentAmount" | "totalReceivable" | null>("lfCode");
  const [rentalSortDir, setRentalSortDir] = useState<"asc" | "desc">("asc");

  const handleRequestSort = (field: "lfCode" | "tenantName" | "dueDay" | "rentAmount" | "totalReceivable") => {
    if (rentalSortField === field) {
      setRentalSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setRentalSortField(field);
      setRentalSortDir("asc");
    }
  };

  const renderSortIcon = (field: "lfCode" | "tenantName" | "dueDay" | "rentAmount" | "totalReceivable") => {
    if (rentalSortField !== field) {
      return <ArrowUpDown size={10} className="text-slate-400 opacity-60 flex-shrink-0 ml-1" />;
    }
    return rentalSortDir === "asc" ? (
      <span className="text-indigo-600 font-extrabold text-[10px] ml-1 select-none" title="Ordem Crescente">▲</span>
    ) : (
      <span className="text-indigo-600 font-extrabold text-[10px] ml-1 select-none" title="Ordem Decrescente">▼</span>
    );
  };

  const rentalsStatusDetails = useMemo(() => {
    const today = new Date(); // In production, we'll base it on local date
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const activeYearStr = filterYear !== "todos" ? filterYear : String(todayYear);
    const activeMonthStr = filterMonth !== "todos" ? filterMonth : String(todayMonth).padStart(2, "0");
    const activePeriod = `${activeYearStr}-${activeMonthStr}`;

    const list = rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId);

    const overdueList: { rental: RentalProperty; daysLate: number; totalValue: number; baseDueDate: string }[] = [];
    const dueTodayList: { rental: RentalProperty; totalValue: number }[] = [];
    const upcomingList: { rental: RentalProperty; daysToDue: number; totalValue: number }[] = [];
    const paidList: { rental: RentalProperty; paidDate: string; daysDiff: number }[] = [];

    list.forEach(r => {
      const isPaid = r.paidPeriods.includes(activePeriod);
      const totalVal = getRentalExpectedAmount(r);
      
      const maxDays = new Date(Number(activeYearStr), Number(activeMonthStr), 0).getDate();
      const actualDueDay = Math.min(r.dueDay, maxDays);
      const dueDateStr = `${activeYearStr}-${activeMonthStr}-${String(actualDueDay).padStart(2, "0")}`;
      
      const due = new Date(dueDateStr + "T12:00:00");
      const currentSimDate = new Date(getLocalDateInputValue(today) + "T12:00:00");

      if (isPaid) {
        const paidDateStr = r.paymentDates?.[activePeriod] || dueDateStr;
        const paidDate = new Date(paidDateStr + "T12:00:00");
        const daysDiff = Math.round((paidDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        paidList.push({ rental: r, paidDate: paidDateStr, daysDiff });
      } else {
        // Unpaid
        const diffInMs = currentSimDate.getTime() - due.getTime();
        const daysDiff = Math.round(diffInMs / (1000 * 60 * 60 * 24));

        if (daysDiff > 0) {
          overdueList.push({ rental: r, daysLate: daysDiff, totalValue: totalVal, baseDueDate: dueDateStr });
        } else if (daysDiff === 0) {
          dueTodayList.push({ rental: r, totalValue: totalVal });
        } else {
          upcomingList.push({ rental: r, daysToDue: Math.abs(daysDiff), totalValue: totalVal });
        }
      }
    });

    return { overdueList, dueTodayList, upcomingList, paidList, activePeriod };
  }, [rentals, filterYear, filterMonth, activeCaixaId]);

  // Calculation of pending rental maturities with near or overdue statuses for the top-level app alert
  const rentDueAlerts = useMemo(() => {
    if (!rentals || rentals.length === 0) {
      return { overdue: [], dueToday: [], dueSoon: [], totalPendingAmount: 0, totalCount: 0 };
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayStr = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

    const activeYearStr = filterYear !== "todos" ? filterYear : String(todayYear);
    const activeMonthStr = filterMonth !== "todos" ? filterMonth : String(todayMonth).padStart(2, "0");
    const activePeriod = `${activeYearStr}-${activeMonthStr}`;

    const overdue: { rental: RentalProperty; daysLate: number; dueDateStr: string; totalVal: number }[] = [];
    const dueToday: { rental: RentalProperty; dueDateStr: string; totalVal: number }[] = [];
    const dueSoon: { rental: RentalProperty; daysToDue: number; dueDateStr: string; totalVal: number }[] = [];
    let totalPendingAmount = 0;

    // Filter properties for current active caixa context
    const list = rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId);

    list.forEach(r => {
      const isPaid = r.paidPeriods.includes(activePeriod);
      if (isPaid) return; // If paid, skip alert

      const maxDays = new Date(Number(activeYearStr), Number(activeMonthStr), 0).getDate();
      const actualDueDay = Math.min(r.dueDay, maxDays);
      const dueDateStr = `${activeYearStr}-${activeMonthStr}-${String(actualDueDay).padStart(2, "0")}`;
      
      const totalVal = getRentalExpectedAmount(r);
      totalPendingAmount += totalVal;

      const due = new Date(dueDateStr + "T12:00:00");
      const currentSimDate = new Date(todayStr + "T12:00:00");
      
      const diffInMs = currentSimDate.getTime() - due.getTime();
      const daysDiff = Math.round(diffInMs / (1000 * 60 * 60 * 24)); // > 0 means late, === 0 today, < 0 future

      if (daysDiff > 0) {
        overdue.push({ rental: r, daysLate: daysDiff, dueDateStr, totalVal });
      } else if (daysDiff === 0) {
        dueToday.push({ rental: r, dueDateStr, totalVal });
      } else {
        const daysToDue = Math.abs(daysDiff);
        if (daysToDue <= 7) { // within 1 week is close to expiration (vencimento próximo)
          dueSoon.push({ rental: r, daysToDue, dueDateStr, totalVal });
        }
      }
    });

    return {
      overdue,
      dueToday,
      dueSoon,
      totalPendingAmount,
      totalCount: overdue.length + dueToday.length + dueSoon.length
    };
  }, [rentals, filterYear, filterMonth, activeCaixaId]);

  const sortedRentals = useMemo(() => {
    // 1. Filter by active caixa
    const filtered = rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId);
    
    // 2. Sort if there is an active sort field
    if (!rentalSortField) return filtered;
    
    return [...filtered].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      
      if (rentalSortField === "lfCode") {
        valA = a.lfCode || "";
        valB = b.lfCode || "";
      } else if (rentalSortField === "tenantName") {
        valA = a.tenantName || "";
        valB = b.tenantName || "";
      } else if (rentalSortField === "dueDay") {
        valA = a.dueDay ?? 0;
        valB = b.dueDay ?? 0;
      } else if (rentalSortField === "rentAmount") {
        valA = a.rentAmount ?? 0;
        valB = b.rentAmount ?? 0;
      } else if (rentalSortField === "totalReceivable") {
        valA = getRentalExpectedAmount(a);
        valB = getRentalExpectedAmount(b);
      }
      
      if (typeof valA === "string") {
        return rentalSortDir === "asc"
          ? valA.localeCompare(valB, "pt-BR", { sensitivity: "base", numeric: true })
          : valB.localeCompare(valA, "pt-BR", { sensitivity: "base", numeric: true });
      } else {
        return rentalSortDir === "asc"
          ? valA - valB
          : valB - valA;
      }
    });
  }, [rentals, activeCaixaId, rentalSortField, rentalSortDir]);

  // Form states for creating custom fixed templates
  const [tplDescription, setTplDescription] = useState("");
  const [tplAmountStr, setTplAmountStr] = useState("");
  const [tplType, setTplType] = useState<"entrada" | "saida">("entrada");
  const [tplCategory, setTplCategory] = useState("Salário");
  const [tplDueDay, setTplDueDay] = useState<number>(5);

  // Form states for creating custom rental properties (LF)
  const [newRentLf, setNewRentLf] = useState("");
  const [newRentTenant, setNewRentTenant] = useState("");
  const [newRentAddress, setNewRentAddress] = useState("");
  const [newRentDueDay, setNewRentDueDay] = useState<number>(10);
  const [newRentAmountStr, setNewRentAmountStr] = useState("");
  const [newRentWaterStr, setNewRentWaterStr] = useState("");
  const [newRentIptuStr, setNewRentIptuStr] = useState("");
  const [newRentGarbageStr, setNewRentGarbageStr] = useState("");
  const [newRentLightStr, setNewRentLightStr] = useState("");
  const [newRentFineStr, setNewRentFineStr] = useState("");
  const [newRentAdminFeePercentStr, setNewRentAdminFeePercentStr] = useState("10");
  const [showNewRentForm, setShowNewRentForm] = useState(false);

  // Edit form states for custom rental properties (LF)
  const [editingRental, setEditingRental] = useState<RentalProperty | null>(null);
  const [editRentLf, setEditRentLf] = useState("");
  const [editRentTenant, setEditRentTenant] = useState("");
  const [editRentAddress, setEditRentAddress] = useState("");
  const [editRentDueDay, setEditRentDueDay] = useState<number>(10);
  const [editRentAmountStr, setEditRentAmountStr] = useState("");
  const [editRentWaterStr, setEditRentWaterStr] = useState("");
  const [editRentIptuStr, setEditRentIptuStr] = useState("");
  const [editRentGarbageStr, setEditRentGarbageStr] = useState("");
  const [editRentLightStr, setEditRentLightStr] = useState("");
  const [editRentFineStr, setEditRentFineStr] = useState("");
  const [editRentAdminFeePercentStr, setEditRentAdminFeePercentStr] = useState("10");
  const [editRentHasDeposit, setEditRentHasDeposit] = useState(false);
  const [editRentDepositMonths, setEditRentDepositMonths] = useState<number>(3);
  const [editRentDepositAmountStr, setEditRentDepositAmountStr] = useState("");
  const [editRentDepositStartDate, setEditRentDepositStartDate] = useState("");
  const [editRentDepositInterestRateStr, setEditRentDepositInterestRateStr] = useState("0.5");
  const [editRentAdjustmentActive, setEditRentAdjustmentActive] = useState(false);
  const [editRentAdjustmentMode, setEditRentAdjustmentMode] = useState<"add" | "subtract">("add");
  const [editRentAdjustmentAmountStr, setEditRentAdjustmentAmountStr] = useState("");
  const [editRentAdjustmentReason, setEditRentAdjustmentReason] = useState("");
  const [editRentGuaranteeType, setEditRentGuaranteeType] = useState<"caucao" | "fiador" | "nenhuma">("nenhuma");
  const [editRentGuarantorName, setEditRentGuarantorName] = useState("");
  const [editRentGuarantorPhone, setEditRentGuarantorPhone] = useState("");
  const [editRentGuarantorCpf, setEditRentGuarantorCpf] = useState("");

  // Deposit (Caução) form states
  const [newRentHasDeposit, setNewRentHasDeposit] = useState(false);
  const [newRentDepositMonths, setNewRentDepositMonths] = useState<number>(3);
  const [newRentDepositAmountStr, setNewRentDepositAmountStr] = useState("");
  const [newRentDepositStartDate, setNewRentDepositStartDate] = useState(() => {
    return getLocalDateInputValue();
  });
  const [newRentDepositInterestRateStr, setNewRentDepositInterestRateStr] = useState("0.5");
  const [newRentAdjustmentActive, setNewRentAdjustmentActive] = useState(false);
  const [newRentAdjustmentMode, setNewRentAdjustmentMode] = useState<"add" | "subtract">("add");
  const [newRentAdjustmentAmountStr, setNewRentAdjustmentAmountStr] = useState("");
  const [newRentAdjustmentReason, setNewRentAdjustmentReason] = useState("");
  const [newRentGuaranteeType, setNewRentGuaranteeType] = useState<"caucao" | "fiador" | "nenhuma">("nenhuma");
  const [newRentGuarantorName, setNewRentGuarantorName] = useState("");
  const [newRentGuarantorPhone, setNewRentGuarantorPhone] = useState("");
  const [newRentGuarantorCpf, setNewRentGuarantorCpf] = useState("");

  // Selected rental for the Deposit details modal
  const [selectedDepositRental, setSelectedDepositRental] = useState<RentalProperty | null>(null);

  // Selected rental for the Adjustments manager modal
  const [managingAdjustmentsRental, setManagingAdjustmentsRental] = useState<RentalProperty | null>(null);
  const [adjFormMode, setAdjFormMode] = useState<"add" | "subtract">("add");
  const [adjFormAmountStr, setAdjFormAmountStr] = useState("");
  const [adjFormDesc, setAdjFormDesc] = useState("");
  const [adjFormRecurrence, setAdjFormRecurrence] = useState<"pontual" | "fixo">("pontual");

  // SGS Savings series 195 states from Banco Central
  const [sgsRates, setSgsRates] = useState<Record<string, number>>({});
  const [sgsLoading, setSgsLoading] = useState(false);
  const [sgsError, setSgsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSgsRates() {
      setSgsLoading(true);
      try {
        const response = await fetch("/api/sgs195?dataInicial=01/01/2015&dataFinal=31/12/2032");
        if (!response.ok) {
          throw new Error("Não foi possível obter dados de Poupança do BCB.");
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          const ratesMap: Record<string, number> = {};
          data.forEach((item: any) => {
            if (item && item.data && item.valor) {
              ratesMap[item.data] = parseFloat(item.valor);
            }
          });
          setSgsRates(ratesMap);
        }
      } catch (err: any) {
        console.error("Erro ao carregar taxas SGS 195:", err);
        setSgsError(err.message || "Erro ao consultar poupança oficial.");
      } finally {
        setSgsLoading(false);
      }
    }
    fetchSgsRates();
  }, []);

  // States for interactive confirmation of rent payments with actual receive date and payment methods
  const [receiptConfirmingRental, setReceiptConfirmingRental] = useState<RentalProperty | null>(null);
  const [receiptConfirmingPeriod, setReceiptConfirmingPeriod] = useState<string>("");
  const [receiptDateInput, setReceiptDateInput] = useState<string>("");
  const [receiptAmountInput, setReceiptAmountInput] = useState<string>("");
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<string>("pix");
  const [receiptObservation, setReceiptObservation] = useState<string>("");
  const [receiptShortfallTreatment, setReceiptShortfallTreatment] = useState<"pending" | "forgiven">("pending");
  const [receiptLateFeeTreatment, setReceiptLateFeeTreatment] = useState<"suggested" | "waived">("suggested");

  // Split payment / 2nd part inside initial receipt modal
  const [receiptHasSplitPart, setReceiptHasSplitPart] = useState<boolean>(false);
  const [receiptSplitAmountInput, setReceiptSplitAmountInput] = useState<string>("");
  const [receiptSplitDateInput, setReceiptSplitDateInput] = useState<string>("");
  const [receiptSplitPaymentMethod, setReceiptSplitPaymentMethod] = useState<string>("transferencia");
  const [receiptSplitObservation, setReceiptSplitObservation] = useState<string>("");

  // Modal for receiving 2nd part later (when shortfall was left as pending)
  const [payingShortfallRental, setPayingShortfallRental] = useState<RentalProperty | null>(null);
  const [payingShortfallPeriod, setPayingShortfallPeriod] = useState<string>("");
  const [payingShortfallAmountInput, setPayingShortfallAmountInput] = useState<string>("");
  const [payingShortfallDateInput, setPayingShortfallDateInput] = useState<string>("");
  const [payingShortfallPaymentMethod, setPayingShortfallPaymentMethod] = useState<string>("transferencia");
  const [payingShortfallObservation, setPayingShortfallObservation] = useState<string>("");

  const resetReceiptConfirmation = () => {
    setReceiptConfirmingRental(null);
    setReceiptConfirmingPeriod("");
    setReceiptDateInput("");
    setReceiptAmountInput("");
    setReceiptPaymentMethod("pix");
    setReceiptObservation("");
    setReceiptShortfallTreatment("pending");
    setReceiptLateFeeTreatment("suggested");
    setReceiptHasSplitPart(false);
    setReceiptSplitAmountInput("");
    setReceiptSplitDateInput("");
    setReceiptSplitPaymentMethod("transferencia");
    setReceiptSplitObservation("");
  };

  const handleUpdateRentalDeposit = (updatedRental: RentalProperty) => {
    setRentals(prev => {
      const next = prev.map(r => r.id === updatedRental.id ? updatedRental : r);
      localStorage.setItem("caixa_alugueis_fixos", JSON.stringify(next));
      return next;
    });
    setSelectedDepositRental(updatedRental); // Synchronize
    addLogEntry(
      "cadastro_aluguel",
      `Dados da caução do contrato ${updatedRental.lfCode} atualizados.`
    );
  };

  const handleRefundRentalDeposit = (rental: RentalProperty, refundAmount: number) => {
    const newTx: Transaction = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      caixaId: rental.caixaId || activeCaixaId,
      date: getLocalDateInputValue(),
      description: `Devolução de Caução Corrigida Poupança - Imóvel ${rental.lfCode} (Inq: ${rental.tenantName})`,
      amount: refundAmount,
      type: "saida",
      category: resolveCategoryForType("Moradia (Aluguel/IPTU)", "saida")
    };

    setTransactions(prev => [newTx, ...prev]);

    setRentals(prev => {
      const next = prev.map(r => {
        if (r.id === rental.id) {
          return {
            ...r,
            hasDeposit: false,
            depositAmount: undefined,
            depositMonthsCount: undefined,
            depositStartDate: undefined,
            depositInterestRate: undefined
          };
        }
        return r;
      });
      localStorage.setItem("caixa_alugueis_fixos", JSON.stringify(next));
      return next;
    });

    addLogEntry(
      "remover_aluguel",
      `Caução do imóvel ${rental.lfCode} devolvida reajustada no valor de R$ ${refundAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para o inquilino "${rental.tenantName}".`
    );

    alert(`Sucesso! A caução de R$ ${refundAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} foi devolvida e registrada como DESPESA (SAÍDA) no caixa.`);
  };

  // Synchronize with LocalStorage
  useEffect(() => {
    localStorage.setItem("caixa_contas", JSON.stringify(caixas));
  }, [caixas]);

  useEffect(() => {
    localStorage.setItem("caixa_transacoes", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("caixa_templates_fixos", JSON.stringify(fixedTemplates));
  }, [fixedTemplates]);

  useEffect(() => {
    localStorage.setItem("caixa_alugueis_fixos", JSON.stringify(rentals));
  }, [rentals]);

  useEffect(() => {
    localStorage.setItem("caixa_categorias", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("caixa_deleted_categories", JSON.stringify(deletedCategories));
  }, [deletedCategories]);

  useEffect(() => {
    localStorage.setItem("caixa_activity_logs", JSON.stringify(activityLogs));
  }, [activityLogs]);

  // Google Drive Sync Engine & Utilities
  const [lastUpdated, setLastUpdated] = useState<number>(() => {
    const saved = localStorage.getItem("caixa_last_updated");
    return saved ? Number(saved) : Date.now();
  });

  const isDownloadingRef = useRef(false);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor all local state changes and update timestamp / schedule sync
  useEffect(() => {
    if (isDownloadingRef.current) return;

    const now = Date.now();
    setLastUpdated(now);
    localStorage.setItem("caixa_last_updated", String(now));

    triggerAutoBackup();
  }, [caixas, transactions, fixedTemplates, rentals, categories, activityLogs, creditCards]);

  const fetchGoogleUserInfo = async (token: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const userInfo = {
          name: data.name || data.given_name || "Usuário",
          email: data.email,
          picture: data.picture || ""
        };
        setUserGoogleInfo(userInfo);
        localStorage.setItem("caixa_google_user", JSON.stringify(userInfo));
      } else if (res.status === 401) {
        throw new Error("401 Unauthorized when fetching userinfo");
      }
    } catch (err) {
      console.error("Failed to fetch user info from Google:", err);
    }
  };

  const mergeArraysById = <T extends { id: string }>(arr1: T[], arr2: T[]): T[] => {
    const map = new Map<string, T>();
    arr1.forEach(item => map.set(item.id, item));
    arr2.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  };

  const uploadToGoogleDrive = async (dataToUpload?: any) => {
    const currentToken = accessToken || localStorage.getItem("caixa_google_token");
    if (!currentToken) throw new Error("No Google Access Token found");

    const appData = dataToUpload || {
      caixas,
      transactions,
      fixedTemplates,
      rentals,
      categories,
      deletedCategories,
      activityLogs,
      creditCards,
      lastUpdated
    };

    let fileId = localStorage.getItem("caixa_google_file_id");

    if (!fileId) {
      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='caixa_backup.json'&spaces=appDataFolder&fields=files(id)",
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      if (searchRes.status === 401) {
        throw new Error("401 Unauthorized searchRes");
      }
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          fileId = searchData.files[0].id;
          localStorage.setItem("caixa_google_file_id", fileId);
        }
      }
    }

    if (fileId) {
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(appData)
        }
      );
      if (updateRes.status === 401) {
        throw new Error("401 Unauthorized updateRes");
      }
      if (!updateRes.ok) {
        if (updateRes.status === 404) {
          localStorage.removeItem("caixa_google_file_id");
          await uploadToGoogleDrive(dataToUpload);
          return;
        }
        throw new Error(`Failed to update backup: ${updateRes.statusText}`);
      }
    } else {
      const metadata = {
        name: "caixa_backup.json",
        parents: ["appDataFolder"]
      };

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append(
        "file",
        new Blob([JSON.stringify(appData)], { type: "application/json" })
      );

      const createRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
          body: formData
        }
      );
      if (createRes.status === 401) {
        throw new Error("401 Unauthorized createRes");
      }
      if (!createRes.ok) {
        throw new Error(`Failed to create backup: ${createRes.statusText}`);
      }

      const createData = await createRes.json();
      if (createData.id) {
        localStorage.setItem("caixa_google_file_id", createData.id);
      }
    }
  };

  const downloadAndRestoreFromGoogleDrive = async (token = accessToken) => {
    const currentToken = token || localStorage.getItem("caixa_google_token");
    if (!currentToken) return;

    setSyncStatus("syncing");
    try {
      let fileId = localStorage.getItem("caixa_google_file_id");

      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='caixa_backup.json'&spaces=appDataFolder&fields=files(id,modifiedTime)",
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      
      if (searchRes.status === 401) {
        throw new Error("401 Unauthorized during search");
      }
      if (!searchRes.ok) {
        throw new Error("Failed to search files in Google Drive");
      }

      const searchData = await searchRes.json();
      if (!searchData.files || searchData.files.length === 0) {
        console.log("No backup found on Drive. Uploading local state as initial backup.");
        await uploadToGoogleDrive();
        setSyncStatus("synced");
        return;
      }

      fileId = searchData.files[0].id;
      localStorage.setItem("caixa_google_file_id", fileId);

      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );

      if (downloadRes.status === 401) {
        throw new Error("401 Unauthorized during download");
      }
      if (!downloadRes.ok) {
        throw new Error("Failed to download file from Google Drive");
      }

      const driveData = await downloadRes.json();
      const localTS = lastUpdated;
      const driveTS = driveData.lastUpdated || 0;

      if (driveTS !== localTS) {
        console.log("Sync mismatch detected. Performing Smart Merge.");
        
        isDownloadingRef.current = true;

        const mergedCaixas = mergeArraysById<Caixa>(caixas, driveData.caixas || []);
        const mergedTransactions = mergeArraysById<Transaction>(transactions, driveData.transactions || []);
        const mergedTemplates = mergeArraysById<FixedTemplate>(fixedTemplates, driveData.fixedTemplates || []);
        const mergedRentals = mergeArraysById<RentalProperty>(rentals, driveData.rentals || []);
        const mergedDeleted = Array.from(new Set([...deletedCategories, ...(driveData.deletedCategories || [])]));
        let rawCategories = mergeArraysById<Category>(categories, driveData.categories || [])
          .filter(c => !mergedDeleted.some(d => d.toLowerCase() === c.name.toLowerCase() || d === c.id));

        // Deduplicate categories by normalized name and type
        const catMap = new Map<string, Category>();
        rawCategories.forEach(c => {
          const key = `${c.name.trim().toLowerCase()}__${c.type}`;
          if (!catMap.has(key)) {
            catMap.set(key, c);
          } else if (c.id === "cat-in-aluguéis-ativos" || c.id === "cat-in-alugueis-ativos") {
            catMap.set(key, { ...c, name: "Aluguéis Ativos" });
          }
        });
        const mergedCategories = Array.from(catMap.values());

        // Normalize rental categories in merged transactions
        const normalizedMergedTransactions = mergedTransactions.map(t => {
          const isRentalCat = t.category && (
            t.category.toLowerCase().trim() === "aluguéis ativos" || 
            t.category.toLowerCase().trim() === "alugueis ativos"
          );
          if (isRentalCat) {
            return { ...t, category: "Aluguéis Ativos" };
          }
          return t;
        });

        const mergedCards = mergeArraysById<CreditCardData>(creditCards, driveData.creditCards || []);
        const mergedLogs = mergeArraysById<ActivityLog>(activityLogs, driveData.activityLogs || [])
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Update states in React
        setCaixas(mergedCaixas);
        setTransactions(normalizedMergedTransactions);
        setFixedTemplates(mergedTemplates);
        setRentals(mergedRentals);
        setDeletedCategories(mergedDeleted);
        setCategories(mergedCategories);
        setCreditCards(mergedCards);
        setActivityLogs(mergedLogs);

        const newTS = Math.max(localTS, driveTS) + 1;
        setLastUpdated(newTS);
        localStorage.setItem("caixa_last_updated", String(newTS));

        setTimeout(() => {
          isDownloadingRef.current = false;
        }, 150);

        // Upload combined data immediately
        const combinedData = {
          caixas: mergedCaixas,
          transactions: mergedTransactions,
          fixedTemplates: mergedTemplates,
          rentals: mergedRentals,
          categories: mergedCategories,
          deletedCategories: mergedDeleted,
          creditCards: mergedCards,
          activityLogs: mergedLogs,
          lastUpdated: newTS
        };
        await uploadToGoogleDrive(combinedData);
        console.log("Successfully performed Smart Merge and updated Google Drive.");
      }

      setSyncStatus("synced");
    } catch (err: any) {
      console.error("Error restoring/syncing with Google Drive:", err);
      setSyncStatus("error");
    }
  };

  const triggerAutoBackup = () => {
    const currentToken = accessToken || localStorage.getItem("caixa_google_token");
    // Only attempt backup if an active token and connection exist
    if (!currentToken || !isGoogleConnected) return;

    setSyncStatus("syncing");

    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
    }

    uploadTimeoutRef.current = setTimeout(async () => {
      try {
        await uploadToGoogleDrive();
        setSyncStatus("synced");
      } catch (err: any) {
        console.warn("Auto-backup deferred or failed silently:", err);
        setSyncStatus("error");
      }
    }, 4000);
  };

  const handleConnectGoogle = () => {
    if (!googleClientId) {
      setIsGoogleConfigModalOpen(true);
      return;
    }

    try {
      setSyncStatus("syncing");
      const tokenClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: googleClientId,
        scope: "https://www.googleapis.com/auth/drive.appdata",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            alert(`Erro ao autenticar com o Google: ${tokenResponse.error_description || tokenResponse.error}`);
            setSyncStatus("error");
            return;
          }
          const token = tokenResponse.access_token;
          setAccessToken(token);
          localStorage.setItem("caixa_google_token", token);
          localStorage.setItem("caixa_google_token_expiry", String(Date.now() + 3500 * 1000));
          setIsGoogleConnected(true);
          localStorage.setItem("caixa_google_connected", "true");

          await fetchGoogleUserInfo(token);
          await downloadAndRestoreFromGoogleDrive(token);
        }
      });
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: "consent" });
      } else {
        alert("O serviço de autenticação do Google ainda está carregando. Tente novamente em alguns instantes.");
        setSyncStatus("error");
      }
    } catch (err) {
      console.error("Failed to login with Google:", err);
      alert("Erro ao iniciar login com Google. Verifique se o Client ID está configurado corretamente.");
      setSyncStatus("error");
    }
  };

  const handleLogoutGoogle = () => {
    setAccessToken("");
    setIsGoogleConnected(false);
    setUserGoogleInfo(null);
    localStorage.removeItem("caixa_google_token");
    localStorage.removeItem("caixa_google_token_expiry");
    localStorage.removeItem("caixa_google_connected");
    localStorage.removeItem("caixa_google_user");
    localStorage.removeItem("caixa_google_file_id");
    setSyncStatus("idle");
  };

  // Safe Startup session restoration without opening popups or flashing windows
  useEffect(() => {
    const savedToken = localStorage.getItem("caixa_google_token");
    const expiryStr = localStorage.getItem("caixa_google_token_expiry");
    const wasConnected = localStorage.getItem("caixa_google_connected") === "true";

    if (wasConnected && savedToken && expiryStr) {
      const expiry = Number(expiryStr);
      if (Date.now() < expiry) {
        setAccessToken(savedToken);
        setIsGoogleConnected(true);
      } else {
        // Token has expired naturally, set state without popping up any UI
        setIsGoogleConnected(false);
        setSyncStatus("idle");
      }
    }
  }, []);

  // Adjust default category based on selected transaction type
  const setFormTransactionTypeDefaults = (type: "entrada" | "saida") => {
    const list = categories.filter(c => c.type === type);
    if (list.length > 0) {
      setFormCategory(list[0].name);
    } else {
      setFormCategory(type === "entrada" ? "Vendas" : "Alimentação");
    }
  };

  const getDefaultCategoryForType = (type: "entrada" | "saida") => {
    const list = categories.filter(c => c.type === type);
    if (list.length > 0) return list[0].name;
    return type === "entrada" ? CATEGORIES_ENTRADA[0] : CATEGORIES_SAIDA[0];
  };

  const resolveCategoryForType = (categoryName: string, type: "entrada" | "saida") => {
    const selected = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === type);
    if (selected) return selected.name;
    if (type === "entrada" && (categoryName.toLowerCase().includes("aluguel") || categoryName.toLowerCase().includes("aluguéis"))) {
      return "Aluguéis Ativos";
    }
    return getDefaultCategoryForType(type);
  };

  // Static options helper
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) {
      years.add(String(year));
    }
    if (filterYear !== "todos") {
      years.add(filterYear);
    }
    transactions.forEach(t => {
      const y = t.date.split("-")[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [filterYear, transactions]);

  // Months labels mapped
  const monthsList = [
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

  const setFilterToCurrentMonth = () => {
    const today = new Date();
    setFilterYear(String(today.getFullYear()));
    setFilterMonth(String(today.getMonth() + 1).padStart(2, "0"));
  };

  const shiftFilterMonth = (offset: number) => {
    const today = new Date();
    const activeYear = filterYear !== "todos" ? Number(filterYear) : today.getFullYear();
    const activeMonth = filterMonth !== "todos" ? Number(filterMonth) : today.getMonth() + 1;
    const target = new Date(activeYear, activeMonth - 1 + offset, 1);
    setFilterYear(String(target.getFullYear()));
    setFilterMonth(String(target.getMonth() + 1).padStart(2, "0"));
  };

  const handleFilterMonthChange = (value: string) => {
    setFilterMonth(value);
    if (value !== "todos" && filterYear === "todos") {
      setFilterYear(String(new Date().getFullYear()));
    }
  };

  const handleFilterYearChange = (value: string) => {
    setFilterYear(value);
  };

  // Active Caixa profile helper
  const activeCaixa = useMemo(() => {
    return caixas.find(c => c.id === activeCaixaId) || caixas[0] || { id: "principal", name: "Caixa Principal" };
  }, [caixas, activeCaixaId]);

  // Filtered transactions computed safely
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        // Must belong to active accounts
        if (activeCaixaId !== "principal" && t.caixaId !== activeCaixaId) return false;

        // Month filter
        if (filterMonth !== "todos") {
          const m = t.date.split("-")[1];
          if (m !== filterMonth) return false;
        }

        // Year filter
        if (filterYear !== "todos") {
          const y = t.date.split("-")[0];
          if (y !== filterYear) return false;
        }

        // Search match (description or category)
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const descMatch = t.description.toLowerCase().includes(q);
          const catMatch = t.category.toLowerCase().includes(q);
          if (!descMatch && !catMatch) return false;
        }

        // Payment method filter
        if (filterPaymentMethod !== "todos") {
          const method = t.paymentMethod || "dinheiro";
          if (method !== filterPaymentMethod) return false;
        }

        return true;
      })
      // Sort oldest to newest (to visualize like a chronologic balance sheet) or vice-versa? 
      // Financial statements look great newest first, but running balance works oldest first.
      // Let's sort newest first for ledger entries so they are easy to edit.
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, activeCaixaId, filterMonth, filterYear, searchQuery, filterPaymentMethod]);

  const saldoAnterior = useMemo(() => {
    // If everything is selected, there is no carryover balance
    if (filterYear === "todos" && filterMonth === "todos") return 0;

    let limitDate = "";
    if (filterYear !== "todos" && filterMonth !== "todos") {
      limitDate = `${filterYear}-${filterMonth}-01`;
    } else if (filterYear !== "todos" && filterMonth === "todos") {
      limitDate = `${filterYear}-01-01`;
    } else {
      // filterMonth !== 'todos' but filterYear === 'todos' -> fallback to current year
      const currentYrStr = String(new Date().getFullYear());
      limitDate = `${currentYrStr}-${filterMonth}-01`;
    }

    let accumulated = 0;
    transactions.forEach(t => {
      // Must belong to active accounts
      if (activeCaixaId !== "principal" && t.caixaId !== activeCaixaId) return;

      if (t.date < limitDate) {
        if (t.type === "entrada") {
          accumulated += t.amount;
        } else {
          // Apenas saídas reais do caixa abatem o saldo físico acumulado.
          // Compras avulsas no cartão de crédito (a prazo) são quitadas pela transação da fatura.
          if (!(t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment)) {
            accumulated -= t.amount;
          }
        }
      }
    });

    return accumulated;
  }, [transactions, activeCaixaId, filterMonth, filterYear]);

  // Aggregations computed
  const totals = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    let faturaCartaoPendente = 0;

    filteredTransactions.forEach(t => {
      if (t.type === "entrada") {
        entrada += t.amount;
      } else {
        // Se for compra no cartão de crédito avulsa (a prazo), o dinheiro não sai do caixa na hora.
        // O que debita o caixa é o lançamento da fatura paga (isCardInvoicePayment)!
        if (t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment) {
          faturaCartaoPendente += t.amount;
        } else {
          saida += t.amount;
        }
      }
    });
    return {
      entrada,
      saida,
      faturaCartaoPendente,
      saldo: entrada - saida
    };
  }, [filteredTransactions]);

  // Financial health indicator
  const healthRate = useMemo(() => {
    if (totals.entrada === 0) return totals.saida === 0 ? "neutro" : "critico";
    const ratio = totals.saida / totals.entrada;
    if (ratio === 0) return "excelente";
    if (ratio < 0.3) return "excelente"; // Exp under 30% of inc
    if (ratio < 0.6) return "bom";
    if (ratio <= 0.9) return "atencao";
    return "alerta";
  }, [totals]);

  // Category statistics compute for custom pure SVGs graphics
  const categoryStats = useMemo(() => {
    const stats: { [key: string]: { total: number; type: "entrada" | "saida"; color: string } } = {};
    filteredTransactions.forEach(t => {
      if (!stats[t.category]) {
        stats[t.category] = {
          total: 0,
          type: t.type,
          color: getCategoryBgColor(t.category)
        };
      }
      stats[t.category].total += t.amount;
    });

    return Object.entries(stats)
      .map(([name, val]) => ({
        name,
        total: val.total,
        type: val.type,
        color: val.color
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, categories]);

  // Actions - Open category selection modal when user clicks Entrada or Saída
  const handleAddTransaction = (type: "entrada" | "saida") => {
    const rawVal = parseCurrencyInput(formAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert("Por favor insira um valor numérico válido maior que zero.");
      return;
    }
    if (!formDescription.trim()) {
      alert("Por favor escreva uma descrição ou legenda para a transação.");
      return;
    }

    const typeCats = categories.filter(c => c.type === type);
    let initialCat = "";
    if (formCategory && typeCats.some(c => c.name.toLowerCase() === formCategory.toLowerCase())) {
      initialCat = typeCats.find(c => c.name.toLowerCase() === formCategory.toLowerCase())!.name;
    } else if (typeCats.length > 0) {
      initialCat = typeCats[0].name;
    } else {
      initialCat = type === "entrada" ? "Vendas" : "Alimentação";
    }

    setCategorySelectionModal({
      isOpen: true,
      type,
      selectedCategory: initialCat
    });
  };

  const handleConfirmCategoryAndSave = (chosenCategory: string) => {
    const type = categorySelectionModal.type;
    const rawVal = parseCurrencyInput(formAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) return;
    if (!formDescription.trim()) return;

    const safeCategory = resolveCategoryForType(chosenCategory, type);
    const numInstallments = formPaymentMethod === "cartao_credito" && formInstallmentsCount > 1 ? formInstallmentsCount : 1;
    const installmentAmount = rawVal / numInstallments;
    const baseDate = new Date(formDate + "T12:00:00");
    const createdTxs: Transaction[] = [];

    const selectedCard = formPaymentMethod === "cartao_credito" && formCardId
      ? creditCards.find(c => c.id === formCardId)
      : undefined;

    for (let i = 1; i <= numInstallments; i++) {
      let dateStr = "";
      let invoicePeriod: string | undefined = undefined;

      if (selectedCard) {
        // Calcula a competência da fatura e o vencimento respeitando o dia de fechamento (virada) do cartão
        const cycle = getCreditCardCycleForPurchase(formDate, selectedCard.closingDay, selectedCard.dueDay, i);
        dateStr = cycle.dueDate; // Cai na data de vencimento da fatura correspondente (ex: 2026-11-25)
        invoicePeriod = cycle.invoicePeriod; // ex: "2026-11"
      } else {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i - 1), baseDate.getDate());
        dateStr = d.toISOString().split("T")[0];
      }

      const desc = numInstallments > 1
        ? `${formDescription.trim()} (${i}/${numInstallments})`
        : formDescription.trim();

      createdTxs.push({
        id: "tx-" + Date.now() + "-" + i + "-" + Math.random().toString(36).substr(2, 4),
        caixaId: activeCaixaId,
        date: dateStr,
        purchaseDate: formDate,
        description: desc,
        amount: installmentAmount,
        type,
        category: safeCategory,
        paymentMethod: formPaymentMethod,
        cardId: formPaymentMethod === "cartao_credito" ? formCardId : undefined,
        installments: numInstallments > 1 ? { current: i, total: numInstallments } : undefined,
        invoicePeriod
      });
    }

    if (safeCategory !== formCategory) {
      setFormCategory(safeCategory);
    }
    setTransactions(prev => [...createdTxs, ...prev]);

    // Add log entry
    addLogEntry(
      type === "entrada" ? "receita" : "despesa",
      `Lançamento manual registrado: "${formDescription.trim()}" (${formPaymentMethod}) na categoria "${safeCategory}" no valor total de ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${numInstallments > 1 ? ` em ${numInstallments}x` : ""}.`,
      rawVal
    );

    // Reset fields except date for easier fast inputs
    setFormDescription("");
    setFormAmountStr("");
    setFormInstallmentsCount(1);
    setCategorySelectionModal(prev => ({ ...prev, isOpen: false }));
  };

  // Caixa Tab controls
  const handleCreateCaixa = () => {
    if (!newCaixaName.trim()) return;
    const newId = "caixa-" + Date.now();
    const newAcc: Caixa = {
      id: newId,
      name: newCaixaName.trim()
    };
    setCaixas(prev => [...prev, newAcc]);
    setActiveCaixaId(newId);
    setNewCaixaName("");
    setIsNewCaixaModalOpen(false);
  };

  const handleMoveCaixa = (index: number, direction: "left" | "right") => {
    setCaixas(prev => {
      const copy = [...prev];
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      
      // Swap elements
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleRenameCaixa = () => {
    if (!renameCaixaName.trim()) return;
    if (activeCaixaId === "principal") {
      alert("O Caixa Principal é fixo e não pode ser alterado.");
      return;
    }
    setCaixas(prev => prev.map(c => c.id === activeCaixaId ? { ...c, name: renameCaixaName.trim() } : c));
    setIsRenameCaixaModalOpen(false);
    setRenameCaixaName("");
  };

  const handleDeleteCaixa = () => {
    if (activeCaixaId === "principal") {
      alert("O Caixa Principal é fixo e não pode ser removido.");
      return;
    }
    if (caixas.length <= 1) {
      alert("Você deve manter pelo menos uma aba de caixa cadastrada.");
      return;
    }
    const filteredAcc = caixas.filter(c => c.id !== activeCaixaId);
    const relatedTxsFiltered = transactions.filter(t => t.caixaId !== activeCaixaId);
    
    setCaixas(filteredAcc);
    setTransactions(relatedTxsFiltered);
    setFixedTemplates(prev => prev.filter(tpl => tpl.caixaId !== activeCaixaId));
    setRentals(prev => prev.filter(r => r.caixaId !== activeCaixaId));
    setActiveCaixaId(filteredAcc[0].id);
  };

  const startEditTransaction = (t: Transaction) => {
    setEditingTransactionId(t.id);
    setEditDate(t.purchaseDate || t.date);
    setEditDescription(t.description);
    setEditAmountStr(String(t.amount).replace(".", ","));
    setEditCategory(t.category);
    setEditType(t.type);
    setEditPaymentMethod(t.paymentMethod || "dinheiro");
    setEditCardId(t.cardId || "");
  };

  const handleSaveEdit = () => {
    const rawVal = parseCurrencyInput(editAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert("Insira um valor maior que zero.");
      return;
    }
    if (!editDescription.trim()) {
      alert("Forneça uma descrição.");
      return;
    }

    const oldTx = transactions.find(t => t.id === editingTransactionId);
    if (oldTx) {
      addLogEntry(
        "edicao",
        `Lançamento "${oldTx.description}" editado para "${editDescription.trim()}" (Valor anterior: ${oldTx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ➔ Novo valor: ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`
      );
    }

    setTransactions(prev => prev.map(t => {
      if (t.id === editingTransactionId) {
        let finalDate = editDate;
        let invoicePeriod = t.invoicePeriod;
        let purchaseDate = editDate;

        if (editPaymentMethod === "cartao_credito" && !t.isCardInvoicePayment) {
          const card = creditCards.find(c => c.id === editCardId) || creditCards[0];
          if (card) {
            const instIdx = t.installments ? (t.installments.current - 1) : 0;
            const cycle = getCreditCardCycleForPurchase(editDate, card.closingDay, card.dueDay, instIdx);
            finalDate = cycle.dueDate;
            invoicePeriod = cycle.invoicePeriod;
            purchaseDate = editDate;
          }
        }

        return {
          ...t,
          date: finalDate,
          purchaseDate: purchaseDate,
          invoicePeriod: invoicePeriod,
          description: editDescription.trim(),
          amount: rawVal,
          category: editCategory,
          type: editType,
          paymentMethod: editPaymentMethod,
          cardId: editPaymentMethod === "cartao_credito" ? editCardId : undefined
        };
      }
      return t;
    }));

    setEditingTransactionId(null);
  };

  const handleDeleteClick = (id: string) => {
    setTransactionToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteTransaction = () => {
    if (transactionToDelete) {
      const deletedTx = transactions.find(t => t.id === transactionToDelete);
      if (deletedTx) {
        addLogEntry(
          "exclusao",
          `Lançamento excluído: "${deletedTx.description}" (${deletedTx.type === "entrada" ? "Entrada" : "Saída"}) no valor de ${deletedTx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        );
      }
      setTransactions(prev => prev.filter(t => t.id !== transactionToDelete));
      setTransactionToDelete(null);
    }
    setIsDeleteConfirmOpen(false);
  };

  const handleResetData = () => {
    setCaixas(INITIAL_CAIXAS);
    setTransactions([]);
    setFixedTemplates([]);
    setRentals([]);
    setCreditCards([]);
    setActiveCaixaId("principal");
    setFilterMonth(String(new Date().getMonth() + 1).padStart(2, "0"));
    setFilterYear(String(new Date().getFullYear()));
    setSearchQuery("");
    setAiInsights(null);
    setIsResetConfirmOpen(false);
    setActivityLogs([]);
  };

  const handleLoadDemoData = (confirmFirst = true) => {
    if (confirmFirst && !window.confirm("Deseja carregar a base de dados fictícios completa para demonstração?\n\nIsso preencherá o extrato do ano de 2026, 4 contratos de aluguel (LF01 a LF04 com recebimentos e divisão em dinheiro/PIX/transferência), cartões de crédito e despesas fixas recorrentes para você testar todas as funcionalidades e relatórios do sistema.")) {
      return;
    }

    const demoTxs = INITIAL_TRANSACTIONS();
    const demoRentals = INITIAL_RENTALS();
    const demoFixed = INITIAL_FIXED_TEMPLATES();
    const demoCards = INITIAL_CREDIT_CARDS();
    const demoLogs = INITIAL_LOGS();

    setCaixas(INITIAL_CAIXAS);
    setTransactions(demoTxs);
    setRentals(demoRentals);
    setFixedTemplates(demoFixed);
    setCreditCards(demoCards);
    setActivityLogs(demoLogs);
    setActiveCaixaId("principal");
    setFilterYear("2026");
    setFilterMonth("10");

    localStorage.setItem("caixa_contas", JSON.stringify(INITIAL_CAIXAS));
    localStorage.setItem("caixa_transacoes", JSON.stringify(demoTxs));
    localStorage.setItem("caixa_alugueis_fixos", JSON.stringify(demoRentals));
    localStorage.setItem("caixa_templates_fixos", JSON.stringify(demoFixed));
    localStorage.setItem("caixa_cartoes_credito", JSON.stringify(demoCards));
    localStorage.setItem("caixa_activity_logs", JSON.stringify(demoLogs));

    alert("✨ Dados de demonstração carregados com sucesso! O período de visualização foi posicionado em Outubro de 2026.");
  };

  // Fixed Templates actions
  const handleAddFixedTemplate = () => {
    const rawVal = parseCurrencyInput(tplAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert("Por favor, insira um valor numérico válido maior que zero.");
      return;
    }
    if (!tplDescription.trim()) {
      alert("Por favor, digite uma descrição para o lançamento fixo.");
      return;
    }

    const safeCategory = resolveCategoryForType(tplCategory, tplType);
    const newTpl: FixedTemplate = {
      id: "tpl-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      caixaId: activeCaixaId,
      description: tplDescription.trim(),
      amount: rawVal,
      type: tplType,
      category: safeCategory,
      dueDay: Number(tplDueDay) || 1,
      status: "ativo"
    };

    if (safeCategory !== tplCategory) {
      setTplCategory(safeCategory);
    }
    setFixedTemplates(prev => [newTpl, ...prev]);
    setTplDescription("");
    setTplAmountStr("");
  };

  const handleDeleteFixedTemplate = (id: string) => {
    if (confirm("Você quer mesmo remover este lançamento fixo? Isso não afetará transações já enviadas ao extrato.")) {
      setFixedTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const getPostedTxForFixed = (tpl: FixedTemplate, year?: string, month?: string): Transaction | undefined => {
    const y = year || (filterYear !== "todos" ? filterYear : String(new Date().getFullYear()));
    const m = month || (filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0"));
    const periodPrefix = `${y}-${m}`;

    return transactions.find(t => 
      t.caixaId === (tpl.caixaId || activeCaixaId) &&
      t.type === tpl.type &&
      t.date.startsWith(periodPrefix) &&
      (
        (t.fixedTemplateId && t.fixedTemplateId === tpl.id) ||
        t.description.toLowerCase().includes(tpl.description.toLowerCase()) ||
        t.description.toLowerCase() === `[fixo] ${tpl.description.toLowerCase()}`
      )
    );
  };

  const openLaunchFixedModal = (tpl: FixedTemplate) => {
    setConfirmingFixedTpl(tpl);
    setConfirmFixedAmountStr(tpl.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const today = new Date();
    const targetYear = filterYear !== "todos" ? filterYear : String(today.getFullYear());
    const targetMonth = filterMonth !== "todos" ? filterMonth : String(today.getMonth() + 1).padStart(2, "0");
    const actualDueDay = clampDayToMonth(targetYear, targetMonth, tpl.dueDay);
    const paddedDay = String(actualDueDay).padStart(2, "0");
    setConfirmFixedDate(`${targetYear}-${targetMonth}-${paddedDay}`);
    setConfirmFixedPaymentMethod("dinheiro");
    setConfirmFixedCardId(creditCards.length > 0 ? creditCards[0].id : "");
    setConfirmFixedUpdateTemplate(false);
    
    const existingTx = getPostedTxForFixed(tpl, targetYear, targetMonth);
    setConfirmFixedUpdateExistingTx(Boolean(existingTx));
  };

  const handleConfirmLaunchFixed = () => {
    if (!confirmingFixedTpl) return;
    const rawVal = parseCurrencyInput(confirmFixedAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert("Por favor, insira um valor numérico válido maior que zero.");
      return;
    }

    // Se o usuário optou por atualizar o valor base cadastrado no modelo fixo
    if (confirmFixedUpdateTemplate) {
      setFixedTemplates(prev => prev.map(t => {
        if (t.id === confirmingFixedTpl.id) {
          return { ...t, amount: rawVal };
        }
        return t;
      }));
    }

    const targetYear = confirmFixedDate.split("-")[0];
    const targetMonth = confirmFixedDate.split("-")[1];
    const existingTx = getPostedTxForFixed(confirmingFixedTpl, targetYear, targetMonth);

    let postDate = confirmFixedDate;
    let invoicePeriod: string | undefined = undefined;
    let purchaseDate: string | undefined = undefined;

    if (confirmFixedPaymentMethod === "cartao_credito") {
      const card = creditCards.find(c => c.id === confirmFixedCardId) || creditCards[0];
      if (card) {
        const cycle = getCreditCardCycleForPurchase(confirmFixedDate, card.closingDay, card.dueDay);
        postDate = cycle.dueDate;
        invoicePeriod = cycle.invoicePeriod;
        purchaseDate = confirmFixedDate;
      }
    }

    // Se já existia transação e usuário optou por atualizar a existente
    if (existingTx && confirmFixedUpdateExistingTx) {
      setTransactions(prev => prev.map(t => {
        if (t.id === existingTx.id) {
          return {
            ...t,
            date: postDate,
            purchaseDate: purchaseDate || confirmFixedDate,
            invoicePeriod: invoicePeriod,
            amount: rawVal,
            paymentMethod: confirmFixedPaymentMethod,
            cardId: confirmFixedPaymentMethod === "cartao_credito" ? confirmFixedCardId : undefined,
            fixedTemplateId: confirmingFixedTpl.id
          };
        }
        return t;
      }));

      addLogEntry(
        "modelo_fixo",
        `Lançamento fixo "${confirmingFixedTpl.description}" atualizado no extrato do mês para ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} via ${confirmFixedPaymentMethod}.${confirmFixedUpdateTemplate ? " Valor base do modelo fixo também foi atualizado." : ""}`,
        rawVal
      );
    } else {
      const newTx: Transaction = {
        id: "tx-posted-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        caixaId: confirmingFixedTpl.caixaId || activeCaixaId,
        date: postDate,
        purchaseDate: purchaseDate || confirmFixedDate,
        invoicePeriod: invoicePeriod,
        invoicePaid: false,
        description: `[Fixo] ${confirmingFixedTpl.description}`,
        amount: rawVal,
        type: confirmingFixedTpl.type,
        category: resolveCategoryForType(confirmingFixedTpl.category, confirmingFixedTpl.type),
        paymentMethod: confirmFixedPaymentMethod,
        cardId: confirmFixedPaymentMethod === "cartao_credito" ? confirmFixedCardId : undefined,
        fixedTemplateId: confirmingFixedTpl.id
      };

      setTransactions(prev => [newTx, ...prev]);

      addLogEntry(
        "modelo_fixo",
        `Lançamento fixo executado no extrato: "${confirmingFixedTpl.description}" no valor de ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} via ${confirmFixedPaymentMethod}.${confirmFixedUpdateTemplate ? " Valor base do modelo fixo também foi atualizado." : ""}`,
        rawVal
      );
    }

    setConfirmingFixedTpl(null);
  };

  const openEditFixedModal = (tpl: FixedTemplate) => {
    setEditingFixedTpl(tpl);
    setEditFixedDesc(tpl.description);
    setEditFixedAmountStr(tpl.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setEditFixedDueDay(tpl.dueDay || 1);
    setEditFixedCategory(tpl.category);
    setEditFixedType(tpl.type);
    setEditFixedUpdateMonthTx(true);
  };

  const handleSaveEditFixed = () => {
    if (!editingFixedTpl) return;
    const rawVal = parseCurrencyInput(editFixedAmountStr);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert("Por favor, insira um valor numérico válido maior que zero.");
      return;
    }
    if (!editFixedDesc.trim()) {
      alert("Por favor, digite uma descrição para o lançamento fixo.");
      return;
    }

    const safeCat = resolveCategoryForType(editFixedCategory, editFixedType);
    const day = Math.min(31, Math.max(1, Number(editFixedDueDay) || 1));
    const oldAmount = editingFixedTpl.amount;
    const oldDesc = editingFixedTpl.description;

    // 1. Atualizar o modelo fixo
    setFixedTemplates(prev => prev.map(t => {
      if (t.id === editingFixedTpl.id) {
        return {
          ...t,
          description: editFixedDesc.trim(),
          amount: rawVal,
          dueDay: day,
          category: safeCat,
          type: editFixedType
        };
      }
      return t;
    }));

    // 2. Se o usuário marcou para atualizar lançamento já realizado no mês
    let updatedTxMsg = "";
    if (editFixedUpdateMonthTx) {
      const targetYear = filterYear !== "todos" ? filterYear : String(new Date().getFullYear());
      const targetMonth = filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0");
      const existingTx = getPostedTxForFixed(editingFixedTpl, targetYear, targetMonth);

      if (existingTx) {
        setTransactions(prev => prev.map(t => {
          if (t.id === existingTx.id) {
            return {
              ...t,
              amount: rawVal,
              description: `[Fixo] ${editFixedDesc.trim()}`,
              category: safeCat,
              type: editFixedType
            };
          }
          return t;
        }));
        updatedTxMsg = ` e lançamento já registrado no mês foi sincronizado para ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`;
      }
    }

    addLogEntry(
      "edicao_fixo",
      `Lançamento fixo "${oldDesc}" atualizado para "${editFixedDesc.trim()}" (Valor base: ${oldAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ➔ ${rawVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, Vencimento: dia ${day})${updatedTxMsg}`,
      rawVal
    );

    setEditingFixedTpl(null);
  };

  const handlePostFixedTemplate = (tpl: FixedTemplate) => {
    openLaunchFixedModal(tpl);
  };

  // Credit Cards handlers
  const handleSaveCreditCard = (card: CreditCardData) => {
    setCreditCards(prev => {
      const exists = prev.some(c => c.id === card.id);
      if (exists) {
        return prev.map(c => c.id === card.id ? card : c);
      }
      return [card, ...prev];
    });
    addLogEntry("cartao", `Cartão de crédito "${card.name}" cadastrado/atualizado.`);
  };

  const handleDeleteCreditCard = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (confirm(`Deseja mesmo remover o cartão "${card?.name || ""}"? As compras já lançadas no extrato não serão apagadas.`)) {
      setCreditCards(prev => prev.filter(c => c.id !== cardId));
      addLogEntry("cartao", `Cartão de crédito "${card?.name || ""}" removido.`);
    }
  };

  const handlePostCardInvoiceToLedger = (
    card: CreditCardData,
    amount: number,
    paymentDate: string,
    periodLabel: string,
    paymentMethod: PaymentMethod = "pix",
    invoicePeriod?: string
  ) => {
    if (amount <= 0) {
      alert("O valor da fatura está zerado.");
      return;
    }

    const invoiceTxId = "tx-invoice-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
    const effectiveDate = paymentDate || getLocalDateInputValue();

    const newTx: Transaction = {
      id: invoiceTxId,
      caixaId: activeCaixaId,
      date: effectiveDate,
      description: `[Fatura Paga] Cartão ${card.name} (${periodLabel})`,
      amount: amount,
      type: "saida",
      category: resolveCategoryForType("Cartão de Crédito", "saida") || "Outras Despesas",
      paymentMethod: paymentMethod || "pix",
      cardId: card.id,
      isCardInvoicePayment: true,
      invoicePeriod: invoicePeriod
    };

    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.cardId === card.id && t.type === "saida" && !t.isCardInvoicePayment) {
          if (invoicePeriod && t.invoicePeriod === invoicePeriod) {
            return { ...t, invoicePaid: true, invoicePaymentTxId: invoiceTxId };
          }
        }
        return t;
      });
      return [newTx, ...updated];
    });

    addLogEntry(
      "transacao",
      `Pagamento de fatura do cartão "${card.name}" (${periodLabel}) registrado no caixa em ${formatDateBRL(effectiveDate)} no valor de ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} via ${paymentMethod.toUpperCase()}.`,
      amount
    );
    alert(`Sucesso! Pagamento da fatura do cartão "${card.name}" de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} lançado no extrato.`);
  };

  // Helper date period displayer Ex: "Janeiro de 2026"
  const formatPeriodBRL = (period: string) => {
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
  };

  // Rental Properties Business actions
  const handleAddRentalProperty = () => {
    if (!newRentLf.trim()) {
      alert("Por favor, digite o Código do Imóvel (LF). Ex: LF04");
      return;
    }
    if (!newRentTenant.trim()) {
      alert("Por favor, digite o nome do inquilino.");
      return;
    }

    const parseFormattedVal = parseCurrencyInput;

    const rentAmount = parseFormattedVal(newRentAmountStr);
    const waterAmount = parseFormattedVal(newRentWaterStr);
    const iptuAmount = parseFormattedVal(newRentIptuStr);
    const garbageAmount = parseFormattedVal(newRentGarbageStr);
    const lightAmount = parseFormattedVal(newRentLightStr);
    const fineAmount = parseFormattedVal(newRentFineStr);
    const adminFeePercent = parseCurrencyInput(newRentAdminFeePercentStr);
    const adminFeeAmount = parseFloat(((rentAmount * adminFeePercent) / 100).toFixed(2));

    if (rentAmount <= 0) {
      alert("O valor de Aluguel do imóvel deve ser um valor válido maior que zero.");
      return;
    }

    const isCaucao = newRentGuaranteeType === "caucao" || newRentHasDeposit;
    const isFiador = newRentGuaranteeType === "fiador";
    const adjustmentAmount = newRentAdjustmentActive ? parseFormattedVal(newRentAdjustmentAmountStr) : 0;
    const adjustmentMode = newRentAdjustmentMode;
    const adjustmentReason = newRentAdjustmentActive ? newRentAdjustmentReason.trim() : undefined;

    const newRental: RentalProperty = {
      id: "rent-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      caixaId: activeCaixaId,
      lfCode: newRentLf.trim().toUpperCase(),
      tenantName: newRentTenant.trim(),
      address: newRentAddress.trim() || "Endereço não informado",
      dueDay: Number(newRentDueDay) || 10,
      rentAmount,
      waterAmount,
      iptuAmount,
      garbageAmount,
      lightAmount,
      fineAmount,
      adminFeeAmount,
      adminFeePercent,
      paidPeriods: [],
      adjustmentMode: adjustmentAmount > 0 ? adjustmentMode : undefined,
      adjustmentAmount: adjustmentAmount > 0 ? adjustmentAmount : undefined,
      adjustmentReason: adjustmentAmount > 0 ? adjustmentReason : undefined,
      guaranteeType: newRentGuaranteeType,
      guarantorName: isFiador ? newRentGuarantorName.trim() : undefined,
      guarantorPhone: isFiador ? newRentGuarantorPhone.trim() : undefined,
      guarantorCpf: isFiador ? newRentGuarantorCpf.trim() : undefined,
      hasDeposit: isCaucao,
      depositMonthsCount: isCaucao ? newRentDepositMonths : undefined,
      depositAmount: isCaucao ? (parseFormattedVal(newRentDepositAmountStr) || (rentAmount * newRentDepositMonths)) : undefined,
      depositStartDate: isCaucao ? (newRentDepositStartDate || getLocalDateInputValue()) : undefined,
      depositInterestRate: isCaucao ? (parseCurrencyInput(newRentDepositInterestRateStr) || 0.5) : undefined
    };

    setRentals(prev => [newRental, ...prev]);

    // Add log entry
    addLogEntry(
      "cadastro_aluguel",
      `Novo imóvel cadastrado sob o código ${newRental.lfCode} para o inquilino "${newRental.tenantName}" com aluguel base de R$ ${newRental.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${newRental.adjustmentAmount ? ` Ajuste: ${newRental.adjustmentMode === "subtract" ? "-" : "+"}R$ ${newRental.adjustmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : ""}${newRental.hasDeposit ? ` Depósito de caução registrado: R$ ${newRental.depositAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : ""}${isFiador ? ` Fiador: ${newRental.guarantorName || "Sim"}.` : ""}`
    );

    // Reset rental form states
    setNewRentLf("");
    setNewRentTenant("");
    setNewRentAddress("");
    setNewRentDueDay(10);
    setNewRentAmountStr("");
    setNewRentWaterStr("");
    setNewRentIptuStr("");
    setNewRentGarbageStr("");
    setNewRentLightStr("");
    setNewRentFineStr("");
    setNewRentAdminFeePercentStr("10");
    setNewRentHasDeposit(false);
    setNewRentDepositMonths(3);
    setNewRentDepositAmountStr("");
    setNewRentDepositStartDate(getLocalDateInputValue());
    setNewRentDepositInterestRateStr("0.5");
    setNewRentAdjustmentActive(false);
    setNewRentAdjustmentMode("add");
    setNewRentAdjustmentAmountStr("");
    setNewRentAdjustmentReason("");
    setNewRentGuaranteeType("nenhuma");
    setNewRentGuarantorName("");
    setNewRentGuarantorPhone("");
    setNewRentGuarantorCpf("");
    setShowNewRentForm(false);

    alert(`Sucesso! Código ${newRental.lfCode} cadastrado para o inquilino ${newRental.tenantName}.`);
  };

  const handleDeleteRentalProperty = (id: string) => {
    const targetRental = rentals.find(r => r.id === id);
    if (confirm("Você quer mesmo remover este aluguel fixo? Isso não afetará transações já enviadas ao extrato.")) {
      if (targetRental) {
        addLogEntry(
          "remover_aluguel",
          `Imóvel removido do painel fixo: Código ${targetRental.lfCode} - Inquilino "${targetRental.tenantName}".`
        );
      }
      setRentals(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleUpdateAdminFeePercent = (id: string, newPercent: number) => {
    setRentals(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          adminFeePercent: newPercent,
          adminFeeAmount: parseFloat(((r.rentAmount * newPercent) / 100).toFixed(2))
        };
      }
      return r;
    }));
  };

  const handleAddAdjustmentToRental = (rentalId: string) => {
    const amount = parseCurrencyInput(adjFormAmountStr);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Por favor, informe um valor numérico válido maior que zero.");
      return;
    }

    const desc = adjFormDesc.trim() || (adjFormMode === "add" ? "Acréscimo de valor" : "Abatimento / Desconto");
    const newAdj: RentalItemAdjustment = {
      id: "adj-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      mode: adjFormMode,
      amount,
      description: desc,
      recurrence: adjFormRecurrence,
      targetPeriod: adjFormRecurrence === "pontual" ? activePeriodStr : undefined,
      createdAt: new Date().toISOString()
    };

    setRentals(prev => prev.map(r => {
      if (r.id === rentalId) {
        const existing: RentalItemAdjustment[] = r.adjustments && Array.isArray(r.adjustments) ? [...r.adjustments] : [];
        if (r.adjustmentAmount && r.adjustmentAmount > 0 && existing.length === 0) {
          existing.push({
            id: "legacy-adj-" + r.id,
            mode: r.adjustmentMode || "add",
            amount: r.adjustmentAmount,
            description: r.adjustmentReason || "Ajuste de valor",
            recurrence: "fixo"
          });
        }
        const updated: RentalProperty = {
          ...r,
          adjustments: [...existing, newAdj],
          adjustmentAmount: undefined,
          adjustmentReason: undefined
        };
        if (managingAdjustmentsRental && managingAdjustmentsRental.id === rentalId) {
          setManagingAdjustmentsRental(updated);
        }
        return updated;
      }
      return r;
    }));

    addLogEntry(
      "ajuste_aluguel",
      `Novo ajuste no imóvel (ID ${rentalId}): ${adjFormMode === "add" ? "Acréscimo" : "Abatimento"} de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${desc}) - ${adjFormRecurrence === "pontual" ? `Pontual para ${formatPeriodBRL(activePeriodStr)}` : "Fixo mensal"}.`
    );

    setAdjFormAmountStr("");
    setAdjFormDesc("");
  };

  const handleRemoveAdjustmentFromRental = (rentalId: string, adjId: string) => {
    setRentals(prev => prev.map(r => {
      if (r.id === rentalId) {
        const existing: RentalItemAdjustment[] = r.adjustments && Array.isArray(r.adjustments) ? [...r.adjustments] : [];
        const filtered = existing.filter(a => a.id !== adjId);
        const updated: RentalProperty = {
          ...r,
          adjustments: filtered
        };
        if (managingAdjustmentsRental && managingAdjustmentsRental.id === rentalId) {
          setManagingAdjustmentsRental(updated);
        }
        return updated;
      }
      return r;
    }));
  };

  const startEditingRental = (rental: RentalProperty) => {
    setEditingRental(rental);
    setEditRentLf(rental.lfCode);
    setEditRentTenant(rental.tenantName);
    setEditRentAddress(rental.address);
    setEditRentDueDay(rental.dueDay);
    setEditRentAmountStr(String(rental.rentAmount).replace(".", ","));
    setEditRentWaterStr(String(rental.waterAmount).replace(".", ","));
    setEditRentIptuStr(String(rental.iptuAmount).replace(".", ","));
    setEditRentGarbageStr(String(rental.garbageAmount).replace(".", ","));
    setEditRentLightStr(String(rental.lightAmount).replace(".", ","));
    setEditRentFineStr(String(rental.fineAmount).replace(".", ","));
    setEditRentAdminFeePercentStr(String(rental.adminFeePercent ?? 10).replace(".", ","));
    setEditRentHasDeposit(!!rental.hasDeposit);
    setEditRentDepositMonths(rental.depositMonthsCount ?? 3);
    setEditRentDepositAmountStr(String(rental.depositAmount ?? 0).replace(".", ","));
    setEditRentDepositStartDate(rental.depositStartDate || getLocalDateInputValue());
    setEditRentDepositInterestRateStr(String(rental.depositInterestRate ?? 0.5).replace(".", ","));

    // Populate Adjustment
    const hasAdj = !!(rental.adjustmentAmount && rental.adjustmentAmount > 0);
    setEditRentAdjustmentActive(hasAdj);
    setEditRentAdjustmentMode(rental.adjustmentMode || "add");
    setEditRentAdjustmentAmountStr(hasAdj ? String(rental.adjustmentAmount).replace(".", ",") : "");
    setEditRentAdjustmentReason(rental.adjustmentReason || "");

    // Populate Guarantee
    const initialGuarantee: "caucao" | "fiador" | "nenhuma" =
      rental.guaranteeType
        ? rental.guaranteeType
        : rental.hasDeposit
          ? "caucao"
          : rental.guarantorName
            ? "fiador"
            : "nenhuma";
    setEditRentGuaranteeType(initialGuarantee);
    setEditRentGuarantorName(rental.guarantorName || "");
    setEditRentGuarantorPhone(rental.guarantorPhone || "");
    setEditRentGuarantorCpf(rental.guarantorCpf || "");
  };

  const handleSaveEditedRental = () => {
    if (!editingRental) return;
    if (!editRentLf.trim()) {
      alert("Por favor, digite o Código do Imóvel (LF). Ex: LF04");
      return;
    }
    if (!editRentTenant.trim()) {
      alert("Por favor, digite o nome do inquilino.");
      return;
    }

    const parseFormattedVal = parseCurrencyInput;

    const rentAmount = parseFormattedVal(editRentAmountStr);
    const waterAmount = parseFormattedVal(editRentWaterStr);
    const iptuAmount = parseFormattedVal(editRentIptuStr);
    const garbageAmount = parseFormattedVal(editRentGarbageStr);
    const lightAmount = parseFormattedVal(editRentLightStr);
    const fineAmount = parseFormattedVal(editRentFineStr);
    const adminFeePercent = parseCurrencyInput(editRentAdminFeePercentStr);
    const adminFeeAmount = parseFloat(((rentAmount * adminFeePercent) / 100).toFixed(2));

    if (rentAmount <= 0) {
      alert("O valor de Aluguel do imóvel deve ser um valor válido maior que zero.");
      return;
    }

    const isCaucao = editRentGuaranteeType === "caucao" || editRentHasDeposit;
    const isFiador = editRentGuaranteeType === "fiador";
    const adjustmentAmount = editRentAdjustmentActive ? parseFormattedVal(editRentAdjustmentAmountStr) : 0;
    const adjustmentMode = editRentAdjustmentMode;
    const adjustmentReason = editRentAdjustmentActive ? editRentAdjustmentReason.trim() : undefined;

    setRentals(prev => prev.map(r => {
      if (r.id === editingRental.id) {
        return {
          ...r,
          lfCode: editRentLf.trim().toUpperCase(),
          tenantName: editRentTenant.trim(),
          address: editRentAddress.trim() || "Endereço não informado",
          dueDay: Number(editRentDueDay) || 10,
          rentAmount,
          waterAmount,
          iptuAmount,
          garbageAmount,
          lightAmount,
          fineAmount,
          adminFeeAmount,
          adminFeePercent,
          adjustmentMode: adjustmentAmount > 0 ? adjustmentMode : undefined,
          adjustmentAmount: adjustmentAmount > 0 ? adjustmentAmount : undefined,
          adjustmentReason: adjustmentAmount > 0 ? adjustmentReason : undefined,
          guaranteeType: editRentGuaranteeType,
          guarantorName: isFiador ? editRentGuarantorName.trim() : undefined,
          guarantorPhone: isFiador ? editRentGuarantorPhone.trim() : undefined,
          guarantorCpf: isFiador ? editRentGuarantorCpf.trim() : undefined,
          hasDeposit: isCaucao,
          depositMonthsCount: isCaucao ? editRentDepositMonths : undefined,
          depositAmount: isCaucao ? (parseFormattedVal(editRentDepositAmountStr) || (rentAmount * editRentDepositMonths)) : undefined,
          depositStartDate: isCaucao ? editRentDepositStartDate : undefined,
          depositInterestRate: isCaucao ? (parseCurrencyInput(editRentDepositInterestRateStr) || 0.5) : undefined
        };
      }
      return r;
    }));

    addLogEntry(
      "edicao_aluguel",
      `Imóvel atualizado: Código ${editRentLf.trim().toUpperCase()} - Inquilino "${editRentTenant.trim()}" editado com sucesso.${adjustmentAmount > 0 ? ` Ajuste: ${adjustmentMode === "subtract" ? "-" : "+"}R$ ${adjustmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : ""}`
    );

    setEditingRental(null);
  };

  const handleCreateCategory = (name: string, type: "entrada" | "saida", color: string) => {
    const formattedName = name.trim();
    if (!formattedName) {
      alert("Por favor, digite o nome da categoria.");
      return;
    }

    const normName = formattedName.toLowerCase();
    if (type === "entrada" && (normName === "aluguéis ativos" || normName === "alugueis ativos" || normName === "aluguel ativo")) {
      alert("A categoria oficial 'Aluguéis Ativos' já é fixa do sistema e gerencia todos os aluguéis. Não é permitido criar outra categoria para aluguéis.");
      return;
    }
    
    const exists = categories.some(c => c.name.toLowerCase() === normName);
    if (exists) {
      alert("Já existe uma categoria cadastrada com este nome.");
      return;
    }

    const newCat: Category = {
      id: `cat-${type === "entrada" ? "in" : "out"}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: formattedName,
      type,
      color: resolveCategoryColorHex(color, formattedName, type)
    };

    setCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const handleUpdateCategory = (id: string, newName: string, newColor: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const oldName = cat.name;
    const formattedNewName = newName.trim();

    if (!formattedNewName) {
      alert("O nome da categoria não pode ser vazio.");
      return;
    }
    
    const normNewName = formattedNewName.toLowerCase();
    const isProtectedRental = cat.id === "cat-in-aluguéis-ativos" || cat.id === "cat-in-alugueis-ativos" || oldName.toLowerCase() === "aluguéis ativos";

    if (isProtectedRental && normNewName !== "aluguéis ativos") {
      alert("A categoria 'Aluguéis Ativos' é a categoria oficial do sistema para receitas de locação e seu nome não pode ser alterado.");
      return;
    }

    if (!isProtectedRental && cat.type === "entrada" && (normNewName === "aluguéis ativos" || normNewName === "alugueis ativos")) {
      alert("Já existe a categoria oficial 'Aluguéis Ativos'. Não é permitido renomear outra categoria para este nome.");
      return;
    }

    if (normNewName !== oldName.toLowerCase()) {
      const exists = categories.some(c => c.id !== id && c.name.toLowerCase() === normNewName);
      if (exists) {
        alert("Já existe outra categoria cadastrada com este nome.");
        return;
      }
    }

    const cleanColor = resolveCategoryColorHex(newColor, formattedNewName, cat.type);
    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, name: formattedNewName, color: cleanColor };
      }
      return c;
    }));

    if (formattedNewName !== oldName) {
      // Propagation
      setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: formattedNewName } : t));
      setFixedTemplates(prev => prev.map(tpl => tpl.category === oldName ? { ...tpl, category: formattedNewName } : tpl));
    }
  };

  // Bulk transfer transactions and recurring templates from one category to another
  const handleBulkTransferCategory = (
    sourceCatName: string, 
    targetCatName: string, 
    selectedTxIds: string[], 
    transferFixed: boolean
  ) => {
    if (!sourceCatName || !targetCatName || sourceCatName === targetCatName) return;

    if (selectedTxIds.length > 0) {
      setTransactions(prev => prev.map(t => {
        if (selectedTxIds.includes(t.id)) {
          return { ...t, category: targetCatName };
        }
        return t;
      }));
    }

    if (transferFixed) {
      setFixedTemplates(prev => prev.map(tpl => {
        if (tpl.category === sourceCatName) {
          return { ...tpl, category: targetCatName };
        }
        return tpl;
      }));
    }

    addLogEntry(
      "TRANSFER_CATEGORY",
      `Transferência em massa de ${selectedTxIds.length} lançamento(s) de "${sourceCatName}" para "${targetCatName}".`
    );
  };

  // Entry point when user clicks delete category button
  const handleDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const entryCount = categories.filter(c => c.type === cat.type).length;
    if (entryCount <= 1) {
      alert(`Você precisa manter pelo menos uma categoria de ${cat.type === "entrada" ? "entrada" : "saída"}.`);
      return;
    }

    // Open the interactive deletion modal
    setCategoryModalMode("delete");
    setCategoryModalSourceId(id);
    setIsCategoryModalOpen(true);
  };

  // Execution when user confirms category deletion in modal
  const handleConfirmDeleteCategory = (
    categoryId: string, 
    targetCatName?: string, 
    selectedTxIds: string[] = [], 
    transferFixed: boolean = true
  ) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;

    // If targetCatName is provided, transfer the records
    if (targetCatName && targetCatName !== cat.name) {
      // Reassign selected transactions
      if (selectedTxIds.length > 0) {
        setTransactions(prev => prev.map(t => {
          if (selectedTxIds.includes(t.id)) {
            return { ...t, category: targetCatName };
          }
          return t;
        }));
      }

      // Reassign fixed templates
      if (transferFixed) {
        setFixedTemplates(prev => prev.map(tpl => {
          if (tpl.category === cat.name) {
            return { ...tpl, category: targetCatName };
          }
          return tpl;
        }));
      }
    }

    // Permanently blacklist the deleted category so it never resurrects
    setDeletedCategories(prev => {
      const next = Array.from(new Set([...prev, cat.name, cat.id]));
      localStorage.setItem("caixa_deleted_categories", JSON.stringify(next));
      return next;
    });

    // Remove category from active state
    setCategories(prev => prev.filter(c => c.id !== categoryId));

    addLogEntry(
      "DELETE_CATEGORY",
      `Categoria "${cat.name}" excluída definitivamente.${targetCatName ? ` Registros migrados para "${targetCatName}".` : ""}`
    );
  };

  const handleToggleRentalPaid = (rental: RentalProperty) => {
    const today = new Date();
    const targetYear = filterYear !== "todos" ? filterYear : String(today.getFullYear());
    const targetMonth = filterMonth !== "todos" ? filterMonth : String(today.getMonth() + 1).padStart(2, "0");
    const period = `${targetYear}-${targetMonth}`;

    const isPaid = rental.paidPeriods.includes(period);
    const valorAReceber = getRentalExpectedAmount(rental, period);
    
    if (isPaid) {
      if (confirm(`Remover confirmação de aluguel recebido para ${rental.tenantName} no período de ${formatPeriodBRL(period)}? A entrada correspondente do caixa será desfeita.`)) {
        // Toggle OFF (remove period from list)
        setRentals(prev => prev.map(r => {
          if (r.id === rental.id) {
            const updatedPaymentDates = { ...(r.paymentDates || {}) };
            const updatedPaymentAmounts = { ...(r.paymentAmounts || {}) };
            const updatedPaymentAdjustments = { ...(r.paymentAdjustments || {}) };
            delete updatedPaymentDates[period];
            delete updatedPaymentAmounts[period];
            delete updatedPaymentAdjustments[period];
            return {
              ...r,
              paidPeriods: r.paidPeriods.filter(p => p !== period),
              paymentDates: updatedPaymentDates,
              paymentAmounts: updatedPaymentAmounts,
              paymentAdjustments: updatedPaymentAdjustments
            };
          }
          return r;
        }));

        // Add log entry
        addLogEntry(
          "reconciliacao_remover",
          `Recebimento de aluguel desfeito para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente ao período de ${formatPeriodBRL(period)} no valor de R$ ${valorAReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        );

        // Delete associated transactions (including split parts like -part1, -part2)
        const targetTxPrefix = `tx-rent-${rental.id}-${period}`;
        setTransactions(prev => prev.filter(t => !t.id.startsWith(targetTxPrefix)));
      }
    } else {
      // Toggle ON: Open the custom check detail modal!
      setReceiptConfirmingRental(rental);
      setReceiptConfirmingPeriod(period);
      setReceiptDateInput(getLocalDateInputValue());
      setReceiptAmountInput(valorAReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setReceiptShortfallTreatment("pending");
      setReceiptLateFeeTreatment("suggested");
    }
  };

  const handleConfirmRentalPaidWithDetails = (
    rental: RentalProperty,
    period: string,
    receivedDateStr: string,
    receivedAmount: number,
    shortfallTreatment: "pending" | "forgiven",
    lateFeeTreatment: "suggested" | "waived",
    paymentMethod: string = "pix",
    observation: string = "",
    splitPart?: {
      amount: number;
      date: string;
      paymentMethod: string;
      observation?: string;
    }
  ) => {
    if (!receivedDateStr) {
      alert("Informe a data efetiva do recebimento.");
      return;
    }
    if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) {
      alert("Informe o valor realmente recebido.");
      return;
    }

    const latestRental = rentals.find(r => r.id === rental.id) || rental;
    if (latestRental.paidPeriods.includes(period)) {
      resetReceiptConfirmation();
      return;
    }

    const valorAReceber = getRentalExpectedAmount(rental, period);
    const periodStr = formatPeriodBRL(period);
    const hasValidSplit = !!(splitPart && Number.isFinite(splitPart.amount) && splitPart.amount > 0);
    const totalReceived = hasValidSplit ? Number((receivedAmount + splitPart.amount).toFixed(2)) : receivedAmount;
    const amountDifference = Number((valorAReceber - totalReceived).toFixed(2));
    const { dueDate, graceDate } = getRentalPeriodDates(period, rental.dueDay);
    const due = new Date(`${dueDate}T12:00:00`);
    const grace = new Date(`${graceDate}T12:00:00`);
    const received = new Date(`${receivedDateStr}T12:00:00`);
    const daysAfterDue = Math.round((received.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const daysAfterGrace = Math.round((received.getTime() - grace.getTime()) / (1000 * 60 * 60 * 24));
    const lateFeeStatus: RentalPaymentAdjustment["lateFeeStatus"] = daysAfterGrace > 0
      ? (lateFeeTreatment === "suggested" ? "suggested" : "waived")
      : "none";
    const adjustmentStatus: RentalPaymentAdjustment["status"] = amountDifference > 0
      ? (shortfallTreatment === "pending" ? "pending" : "forgiven")
      : "charged";

    const parts: RentalPaymentPart[] = [];
    const part1TxId = hasValidSplit ? `tx-rent-${rental.id}-${period}-part1` : `tx-rent-${rental.id}-${period}`;
    parts.push({
      id: `part-1-${Date.now()}`,
      amount: receivedAmount,
      date: receivedDateStr,
      paymentMethod,
      observation: observation.trim(),
      txId: part1TxId
    });

    if (hasValidSplit) {
      const part2TxId = `tx-rent-${rental.id}-${period}-part2`;
      parts.push({
        id: `part-2-${Date.now() + 1}`,
        amount: splitPart!.amount,
        date: splitPart!.date || receivedDateStr,
        paymentMethod: splitPart!.paymentMethod,
        observation: splitPart!.observation?.trim() || "",
        txId: part2TxId
      });
    }

    const adjustment: RentalPaymentAdjustment = {
      period,
      expectedAmount: valorAReceber,
      receivedAmount: totalReceived,
      difference: amountDifference,
      status: adjustmentStatus,
      dueDate,
      graceDate,
      receivedDate: receivedDateStr,
      daysAfterDue,
      daysAfterGrace,
      lateFeeStatus,
      createdAt: new Date().toISOString(),
      paymentMethod,
      observation: observation.trim(),
      parts,
      note: amountDifference > 0
        ? (adjustmentStatus === "pending" ? "Diferença anexada para quitação posterior ou no próximo mês." : "Diferença aliviada no fechamento.")
        : amountDifference < 0
          ? "Recebimento acima do valor esperado."
          : hasValidSplit ? "Aluguel totalmente quitado em 2 formas de pagamento." : "Recebimento integral."
    };

    // Toggle ON with stored date
    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        return {
          ...r,
          paidPeriods: Array.from(new Set([...r.paidPeriods, period])),
          paymentDates: {
            ...(r.paymentDates || {}),
            [period]: hasValidSplit && splitPart!.date ? splitPart!.date : receivedDateStr
          },
          paymentAmounts: {
            ...(r.paymentAmounts || {}),
            [period]: totalReceived
          },
          paymentAdjustments: {
            ...(r.paymentAdjustments || {}),
            [period]: adjustment
          }
        };
      }
      return r;
    }));

    // Details for description
    const details = [];
    if (rental.rentAmount > 0) details.push(`Aluguel: R$${rental.rentAmount}`);
    if (rental.waterAmount > 0) details.push(`Água: R$${rental.waterAmount}`);
    if (rental.iptuAmount > 0) details.push(`IPTU: R$${rental.iptuAmount}`);
    if (rental.garbageAmount > 0) details.push(`Lixo: R$${rental.garbageAmount}`);
    if (rental.lightAmount > 0) details.push(`Luz: R$${rental.lightAmount}`);
    if (rental.fineAmount > 0) details.push(`Multa: R$${rental.fineAmount}`);
    const applicableAdjs = getRentalApplicableAdjustments(rental, period);
    if (applicableAdjs.length > 0) {
      applicableAdjs.forEach(adj => {
        details.push(
          adj.mode === "subtract"
            ? `Abatimento: -R$${adj.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${adj.description ? ` (${adj.description})` : ""}`
            : `Acréscimo: +R$${adj.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${adj.description ? ` (${adj.description})` : ""}`
        );
      });
    } else if (rental.adjustmentAmount && rental.adjustmentAmount > 0) {
      details.push(
        rental.adjustmentMode === "subtract"
          ? `Abatimento: -R$${rental.adjustmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${rental.adjustmentReason ? ` (${rental.adjustmentReason})` : ""}`
          : `Acréscimo: +R$${rental.adjustmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${rental.adjustmentReason ? ` (${rental.adjustmentReason})` : ""}`
      );
    }
    if (rental.adminFeeAmount > 0) details.push(`Tx Adm: -R$${rental.adminFeeAmount}`);

    const method1Label = getRentalPaymentMethodLabel(paymentMethod);
    const date1BRL = receivedDateStr.split("-").reverse().join("/");

    // Create transaction(s)
    const newTxs: Transaction[] = [];

    if (hasValidSplit) {
      const method2Label = getRentalPaymentMethodLabel(splitPart!.paymentMethod);
      const date2BRL = (splitPart!.date || receivedDateStr).split("-").reverse().join("/");

      newTxs.push({
        id: part1TxId,
        caixaId: rental.caixaId || activeCaixaId,
        date: receivedDateStr,
        description: `[Aluguel ${rental.lfCode}] ${rental.tenantName} - 1ª Parte Ref. ${periodStr} (${details.join(", ")}) [Rec: ${date1BRL} via ${method1Label}]${observation.trim() ? ` - Obs: ${observation.trim()}` : ""}`,
        amount: receivedAmount,
        type: "entrada",
        category: resolveCategoryForType("Aluguéis Ativos", "entrada"),
        paymentMethod: paymentMethod as any
      });

      newTxs.push({
        id: `tx-rent-${rental.id}-${period}-part2`,
        caixaId: rental.caixaId || activeCaixaId,
        date: splitPart!.date || receivedDateStr,
        description: `[Aluguel ${rental.lfCode}] ${rental.tenantName} - 2ª Parte Ref. ${periodStr} [Rec: ${date2BRL} via ${method2Label}]${splitPart!.observation?.trim() ? ` - Obs: ${splitPart!.observation.trim()}` : ""}`,
        amount: splitPart!.amount,
        type: "entrada",
        category: resolveCategoryForType("Aluguéis Ativos", "entrada"),
        paymentMethod: splitPart!.paymentMethod as any
      });

      setTransactions(prev => [...newTxs, ...prev]);

      const obs1Text = observation.trim() ? ` (Obs: ${observation.trim()})` : "";
      const obs2Text = splitPart!.observation?.trim() ? ` (Obs: ${splitPart!.observation.trim()})` : "";

      addLogEntry(
        "reconciliacao_confirmar",
        `Parte do aluguel pago no dia ${date1BRL} (R$ ${receivedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} via ${method1Label}${obs1Text}) e segunda parte paga no dia ${date2BRL} (R$ ${splitPart!.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} via ${method2Label}${obs2Text}) para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente a ${periodStr}. Total quitado: R$ ${totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        totalReceived
      );
    } else {
      const delayText = daysAfterDue === 0 ? "No vencimento" : daysAfterDue < 0 ? `Adiantado ${Math.abs(daysAfterDue)} dias` : `Atrasado ${daysAfterDue} dias`;
      const differenceText = amountDifference > 0
        ? `Saldo devedor restante: R$ ${amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : amountDifference < 0
          ? `Recebido a mais: R$ ${Math.abs(amountDifference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : "Valor recebido integral";

      newTxs.push({
        id: part1TxId,
        caixaId: rental.caixaId || activeCaixaId,
        date: receivedDateStr,
        description: `[Aluguel ${rental.lfCode}] ${rental.tenantName} - Ref. ${periodStr} (${details.join(", ")}) [Rec: ${date1BRL} via ${method1Label} - ${delayText}; ${differenceText}]${observation.trim() ? ` - Obs: ${observation.trim()}` : ""}`,
        amount: receivedAmount,
        type: "entrada",
        category: resolveCategoryForType("Aluguéis Ativos", "entrada"),
        paymentMethod: paymentMethod as any
      });

      setTransactions(prev => [...newTxs, ...prev]);

      const obsText = observation.trim() ? ` - Obs: ${observation.trim()}` : "";
      addLogEntry(
        "reconciliacao_confirmar",
        amountDifference > 0
          ? `1ª parte do aluguel paga no dia ${date1BRL} (R$ ${receivedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} via ${method1Label}) para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente a ${periodStr}. Saldo devedor restante: R$ ${amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${obsText}`
          : `Aluguel conciliado para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente a ${periodStr}. Recebido em ${date1BRL} via ${method1Label}. Esperado: R$ ${valorAReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}; recebido: R$ ${receivedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${obsText}`,
        receivedAmount
      );
    }

    resetReceiptConfirmation();
  };

  const handleConfirmRentalShortfallPayment = (
    rental: RentalProperty,
    period: string,
    part2DateStr: string,
    part2Amount: number,
    part2PaymentMethod: string,
    part2Observation: string
  ) => {
    if (!part2DateStr) {
      alert("Informe a data do recebimento da 2ª parte.");
      return;
    }
    if (!Number.isFinite(part2Amount) || part2Amount <= 0) {
      alert("Informe o valor recebido na 2ª parte.");
      return;
    }

    const currentAdj = rental.paymentAdjustments?.[period];
    const prevReceived = rental.paymentAmounts?.[period] ?? currentAdj?.receivedAmount ?? 0;
    const newTotalReceived = Number((prevReceived + part2Amount).toFixed(2));
    const expected = currentAdj?.expectedAmount ?? getRentalExpectedAmount(rental, period);
    const newDifference = Number(Math.max(0, expected - newTotalReceived).toFixed(2));
    const newStatus: RentalPaymentAdjustment["status"] = newDifference <= 0.01 ? "charged" : "pending";

    const part2TxId = `tx-rent-${rental.id}-${period}-part2-${Date.now()}`;
    const part2: RentalPaymentPart = {
      id: "part-2-" + Date.now(),
      amount: part2Amount,
      date: part2DateStr,
      paymentMethod: part2PaymentMethod,
      observation: part2Observation.trim(),
      txId: part2TxId
    };

    const existingParts: RentalPaymentPart[] = currentAdj?.parts && currentAdj.parts.length > 0
      ? [...currentAdj.parts]
      : [{
          id: "part-1-orig",
          amount: prevReceived,
          date: currentAdj?.receivedDate || rental.paymentDates?.[period] || getLocalDateInputValue(),
          paymentMethod: currentAdj?.paymentMethod || "dinheiro",
          observation: currentAdj?.observation || ""
        }];

    const updatedParts = [...existingParts, part2];
    const periodStr = formatPeriodBRL(period);

    // Create 2nd part transaction in Caixa
    const part2MethodLabel = getRentalPaymentMethodLabel(part2PaymentMethod);
    const part2DateBRL = part2DateStr.split("-").reverse().join("/");
    const newTx: Transaction = {
      id: part2TxId,
      caixaId: rental.caixaId || activeCaixaId,
      date: part2DateStr,
      description: `[Aluguel ${rental.lfCode}] ${rental.tenantName} - 2ª Parte Ref. ${periodStr} [Rec: ${part2DateBRL} via ${part2MethodLabel}]${part2Observation.trim() ? ` - Obs: ${part2Observation.trim()}` : ""}`,
      amount: part2Amount,
      type: "entrada",
      category: resolveCategoryForType("Aluguéis Ativos", "entrada"),
      paymentMethod: part2PaymentMethod as any
    };

    setTransactions(prev => [newTx, ...prev]);

    // Update rental record
    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        const updatedAdj: RentalPaymentAdjustment = {
          ...(currentAdj || {
            period,
            expectedAmount: expected,
            dueDate: "",
            graceDate: "",
            daysAfterDue: 0,
            daysAfterGrace: 0,
            lateFeeStatus: "none",
            createdAt: new Date().toISOString()
          }),
          receivedAmount: newTotalReceived,
          difference: newDifference,
          status: newStatus,
          parts: updatedParts,
          note: newDifference <= 0.01
            ? "Aluguel totalmente quitado em 2 partes."
            : `2ª parte recebida. Saldo restante: R$ ${newDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        };

        return {
          ...r,
          paymentDates: {
            ...(r.paymentDates || {}),
            [period]: part2DateStr
          },
          paymentAmounts: {
            ...(r.paymentAmounts || {}),
            [period]: newTotalReceived
          },
          paymentAdjustments: {
            ...(r.paymentAdjustments || {}),
            [period]: updatedAdj
          }
        };
      }
      return r;
    }));

    // Add audit log entry with exact format requested:
    const part1 = existingParts[0];
    const part1DateBRL = part1?.date ? part1.date.split("-").reverse().join("/") : "data inicial";
    const part1AmountFormatted = part1?.amount ? `R$ ${part1.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    const part1MethodLabel = getRentalPaymentMethodLabel(part1?.paymentMethod);
    const obsText = part2Observation.trim() ? ` - Observação: ${part2Observation.trim()}` : "";

    addLogEntry(
      "reconciliacao_segunda_parte",
      `Parte do aluguel pago no dia ${part1DateBRL} (${part1AmountFormatted} via ${part1MethodLabel}) e segunda parte paga no dia ${part2DateBRL} (R$ ${part2Amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} via ${part2MethodLabel}) para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente a ${periodStr}.${obsText}`,
      part2Amount
    );

    // Reset shortfall modal
    setPayingShortfallRental(null);
    setPayingShortfallPeriod("");
    setPayingShortfallAmountInput("");
    setPayingShortfallDateInput("");
    setPayingShortfallPaymentMethod("transferencia");
    setPayingShortfallObservation("");
  };

  const openPayShortfallModal = (rental: RentalProperty, period: string, difference: number) => {
    setPayingShortfallRental(rental);
    setPayingShortfallPeriod(period);
    setPayingShortfallAmountInput(difference.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPayingShortfallDateInput(getLocalDateInputValue());
    setPayingShortfallPaymentMethod("transferencia");
    setPayingShortfallObservation("");
  };

  const handleResolveRentalDifference = (
    rentalId: string,
    period: string,
    status: "forgiven" | "charged"
  ) => {
    let updatedAdjustment: RentalPaymentAdjustment | null = null;
    setRentals(prev => prev.map(r => {
      if (r.id !== rentalId) return r;
      const current = r.paymentAdjustments?.[period];
      if (!current) return r;
      updatedAdjustment = {
        ...current,
        status,
        note: status === "forgiven"
          ? "Diferença aliviada manualmente."
          : "Diferença marcada como cobrada da imobiliária."
      };
      return {
        ...r,
        paymentAdjustments: {
          ...(r.paymentAdjustments || {}),
          [period]: updatedAdjustment
        }
      };
    }));

    if (updatedAdjustment) {
      const actionText = status === "forgiven" ? "aliviada" : "marcada como cobrada";
      addLogEntry(
        "reconciliacao_confirmar",
        `Diferença de aluguel ${actionText} no período ${formatPeriodBRL(period)}. Valor: R$ ${Math.abs(updatedAdjustment.difference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        Math.abs(updatedAdjustment.difference)
      );
    }
  };

  // Backup / Excel features
  const exportToJSON = () => {
    const data = {
      caixas,
      transactions,
      fixedTemplates,
      rentals,
      categories,
      creditCards,
      activityLogs,
      includeSaldoAnterior,
      version: "1.4",
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_fluxo_de_caixa_${getLocalDateInputValue()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importFromJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.caixas) && Array.isArray(parsed.transactions)) {
          setCaixas(parsed.caixas);
          setTransactions(parsed.transactions);
          if (Array.isArray(parsed.fixedTemplates)) {
            setFixedTemplates(parsed.fixedTemplates);
          }
          if (Array.isArray(parsed.rentals)) {
            setRentals(parsed.rentals);
          }
          if (Array.isArray(parsed.categories)) {
            setCategories(parsed.categories);
          }
          if (Array.isArray(parsed.creditCards)) {
            setCreditCards(parsed.creditCards);
          }
          if (Array.isArray(parsed.activityLogs)) {
            setActivityLogs(parsed.activityLogs);
          }
          if (typeof parsed.includeSaldoAnterior === "boolean") {
            setIncludeSaldoAnterior(parsed.includeSaldoAnterior);
          }
          if (parsed.caixas.length > 0) {
            setActiveCaixaId(parsed.caixas[0].id);
          }
          alert("Backup importado com sucesso total!");
        } else {
          alert("Estrutura do arquivo de backup inválida ou corrompida.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo JSON de backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportToCSV = () => {
    // Generate CSV for active caixa & period
    const headers = "Data;Descrição;Subcategoria;Tipo;Forma de Pagamento;Cartão;Valor Recebido;Valor Pago;Caixa\n";
    const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const getCaixaNameForExport = (caixaId?: string) => caixas.find(c => c.id === caixaId)?.name || "Sem caixa";
    const rows = filteredTransactions.map(t => {
      const formattedDate = formatDateBRL(t.date);
      const entrada = t.type === "entrada" ? t.amount.toFixed(2).replace(".", ",") : "";
      const saida = t.type === "saida" ? t.amount.toFixed(2).replace(".", ",") : "";
      const paymentMethodLabel = t.paymentMethod === "pix"
        ? "PIX"
        : t.paymentMethod === "cartao_credito"
        ? "Cartão de Crédito"
        : t.paymentMethod === "cartao_debito"
        ? "Cartão de Débito"
        : t.paymentMethod === "boleto"
        ? "Boleto"
        : "Dinheiro";
      const cardName = t.cardId ? (creditCards.find(c => c.id === t.cardId)?.name || "") : "";

      return [
        csvEscape(formattedDate),
        csvEscape(t.description),
        csvEscape(t.category),
        csvEscape(t.type === "entrada" ? "Entrada" : "Saída"),
        csvEscape(paymentMethodLabel),
        csvEscape(cardName),
        csvEscape(entrada),
        csvEscape(saida),
        csvEscape(getCaixaNameForExport(t.caixaId))
      ].join(";");
    }).join("\n");

    const fullCsv = headers + rows;
    const blob = new Blob(["\ufeff" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato_${activeCaixa.name.toLowerCase().replace(/\s+/g, "_")}_${filterMonth}_${filterYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format date helper for BRL display
  const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  // AI insights retrieval
  const handleGenerateAIInsights = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    setAiInsights(null);
    setIsAiPanelOpen(true);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: filteredTransactions,
          caixaName: activeCaixa.name,
          totalEntrada: totals.entrada,
          totalSaida: totals.saida,
          totalSaldo: totals.saldo,
          currentMonthYear: filterMonth !== "todos" ? `${monthsList.find(m => m.value === filterMonth)?.label} de ${filterYear}` : `Ano Completo ${filterYear}`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Houve uma falha ao solicitar insights de I.A.");
      }
      setAiInsights(data.insights);
    } catch (err: any) {
      setAiError(err.message || "Erro de conexão com o servidor. Verifique a chave de API nos Secrets.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Quick Description Templates for fast selection based on frequency and history
  const quickTemplateSuggestions = useMemo(() => {
    const map = new Map<string, { count: number; lastAmount: number; lastCategory: string; lastType: "entrada" | "saida" }>();
    
    transactions.forEach(t => {
      const desc = t.description.trim();
      if (!desc) return;
      
      const existing = map.get(desc);
      if (existing) {
        existing.count += 1;
        existing.lastAmount = t.amount;
        existing.lastCategory = t.category;
        existing.lastType = t.type;
      } else {
        map.set(desc, {
          count: 1,
          lastAmount: t.amount,
          lastCategory: t.category,
          lastType: t.type
        });
      }
    });

    return Array.from(map.entries())
      .map(([description, info]) => ({
        description,
        ...info
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [transactions]);

  // Helper to generate smooth SVG donut rings for any set of values
  const buildSvgDonutRings = (items: { name: string; total: number; color?: string }[]) => {
    const totalSum = items.reduce((acc, s) => acc + s.total, 0);
    if (totalSum === 0) return [];

    let currentAngle = -90; // Começa no topo (12h)
    return items.map(s => {
      const percentage = s.total / totalSum;
      const angleSize = percentage * 360;
      const start = currentAngle;
      currentAngle += angleSize;

      const radius = 38;
      const x1 = 50 + radius * Math.cos((start * Math.PI) / 180);
      const y1 = 50 + radius * Math.sin((start * Math.PI) / 180);
      const x2 = 50 + radius * Math.cos((currentAngle * Math.PI) / 180);
      const y2 = 50 + radius * Math.sin((currentAngle * Math.PI) / 180);
      const largeArc = angleSize > 180 ? 1 : 0;

      const isFullCircle = angleSize >= 359.99;
      const path = isFullCircle
        ? `M 50 ${50 - radius} A ${radius} ${radius} 0 1 1 49.99 ${50 - radius} Z`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

      return {
        ...s,
        path,
        percentage: (percentage * 100).toFixed(1)
      };
    });
  };

  // 1. Gráfico de Saídas / Despesas
  const donutRingSaidas = useMemo(() => {
    const list = categoryStats
      .filter(s => s.type === "saida" && s.total > 0)
      .map(s => ({ ...s, color: getCategoryColorHex(s.name) }));
    return buildSvgDonutRings(list);
  }, [categoryStats]);

  const donutRingParts = donutRingSaidas; // Mantém compatibilidade com referências existentes

  // 2. Gráfico de Entradas / Receitas
  const donutRingEntradas = useMemo(() => {
    const list = categoryStats
      .filter(s => s.type === "entrada" && s.total > 0)
      .map(s => ({ ...s, color: getCategoryColorHex(s.name) }));
    return buildSvgDonutRings(list);
  }, [categoryStats]);

  // 3. Gráfico Misto (Entradas vs Saídas)
  const donutRingMisto = useMemo(() => {
    const list = [
      { name: "Receitas", total: totals.entrada, color: "#10b981" },
      { name: "Despesas", total: totals.saida, color: "#f43f5e" }
    ].filter(item => item.total > 0);
    return buildSvgDonutRings(list);
  }, [totals.entrada, totals.saida]);

  const renderReceiptConfirmModal = () => {
    if (!receiptConfirmingRental || !receiptConfirmingPeriod) return null;

    const rental = receiptConfirmingRental;
    const period = receiptConfirmingPeriod;
    const value = getRentalExpectedAmount(rental);
    const receivedAmount = parseCurrencyInput(receiptAmountInput);
    const amountDifference = Number((value - receivedAmount).toFixed(2));
    
    // Parse due date
    const [year, month] = period.split("-").map(Number);
    const maxDays = new Date(year, month, 0).getDate();
    const actualDueDay = Math.min(rental.dueDay, maxDays);
    const dueDateStr = `${year}-${String(month).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;
    const graceDateStr = addDaysToDateInput(dueDateStr, 2);
    
    // Calculate difference
    let daysDiff = 0;
    let delayStatus: "early" | "ontime" | "late" = "ontime";
    if (receiptDateInput) {
      const due = new Date(dueDateStr + "T12:00:00");
      const received = new Date(receiptDateInput + "T12:00:00");
      const timeDiff = received.getTime() - due.getTime();
      daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        delayStatus = "ontime";
      } else if (daysDiff < 0) {
        delayStatus = "early";
      } else {
        delayStatus = "late";
      }
    }
    const repasseGraceDays = receiptDateInput
      ? Math.round((new Date(`${receiptDateInput}T12:00:00`).getTime() - new Date(`${graceDateStr}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetReceiptConfirmation}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[92vh] relative z-10 flex flex-col my-auto overflow-hidden"
        >
          {/* Header Fixo */}
          <div className="p-5 pb-3 border-b border-slate-100 flex-shrink-0 relative bg-white">
            {/* Close */}
            <button
              type="button"
              onClick={resetReceiptConfirmation}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 bg-emerald-50 text-emerald-750 rounded-lg">
                <Check size={16} />
              </span>
              <h3 className="font-bold text-sm text-slate-800">Confirmar Recebimento de Aluguel</h3>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Registre os detalhes de quitação do aluguel do imóvel <strong>{rental.lfCode}</strong> ({rental.tenantName}) para o relatório de auditoria e prestação de contas.
            </p>
          </div>

          {/* Body Rolável */}
          <div className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs">
            {/* Info Box */}
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1 bg-gradient-to-r from-slate-50 to-indigo-50/20">
              <div className="flex justify-between">
                <span className="text-slate-450 font-medium">Competência:</span>
                <span className="font-bold text-slate-750">{formatPeriodBRL(period)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-455 font-medium font-sans">Vencimento Planejado:</span>
                <span className="font-mono font-bold text-slate-750">
                  {new Date(dueDateStr + "T12:00:00").toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 font-semibold">
                <span className="text-slate-500">Valor Líquido:</span>
                <span className="text-indigo-700 font-mono font-extrabold text-sm">
                  R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Input Date */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-650">Data do Recebimento Efetivo</label>
              <input
                type="date"
                value={receiptDateInput}
                onChange={(e) => setReceiptDateInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-xs text-slate-850 font-mono shadow-3xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-650">Valor realmente recebido da imobiliária</label>
              <input
                type="text"
                inputMode="decimal"
                value={receiptAmountInput}
                onChange={(e) => setReceiptAmountInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-xs text-slate-850 font-mono shadow-3xs"
                placeholder="Ex: 1.300,00"
              />
              <p className="text-[10px] text-slate-450 leading-snug">
                Esperado: R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Se houver diferença, ela fica registrada no contrato para o próximo relatório.
              </p>
            </div>

            {/* Forma de Pagamento e Observação */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-650 flex items-center justify-between">
                <span>Forma de Recebimento</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {receiptHasSplitPart ? "1ª Parte" : "Integral / Inicial"}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {RENTAL_PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setReceiptPaymentMethod(m.id)}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      receiptPaymentMethod === m.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span className="truncate">{m.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-650 flex items-center justify-between">
                <span>Observação do Recebimento</span>
                <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
              </label>
              <input
                type="text"
                value={receiptObservation}
                onChange={(e) => setReceiptObservation(e.target.value)}
                placeholder="Ex: Recebido em mãos / PIX chave celular / comprovante arquivado..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-xs text-slate-850 shadow-3xs"
              />
            </div>

            {receiptAmountInput && Math.abs(amountDifference) >= 0.01 && (
              <div className={`p-3 rounded-2xl border space-y-2.5 ${
                amountDifference > 0
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-sky-50/70 border-sky-200 text-sky-900"
              }`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[11px]">
                    {amountDifference > 0
                      ? `Recebido a menos: R$ ${amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : `Recebido a mais: R$ ${Math.abs(amountDifference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/80 border border-current opacity-80">
                    {amountDifference > 0 ? "Diferença Pendente" : "Excedente"}
                  </span>
                </div>

                {amountDifference > 0 && (
                  <div className="space-y-2.5 pt-1 border-t border-amber-200/60">
                    <p className="text-[10.5px] font-semibold text-amber-900 leading-tight">
                      Como deseja registrar a 2ª parte de R$ {amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptHasSplitPart(true);
                          if (!receiptSplitAmountInput) {
                            setReceiptSplitAmountInput(amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          }
                          if (!receiptSplitDateInput) {
                            setReceiptSplitDateInput(receiptDateInput || getLocalDateInputValue());
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[10.5px] font-bold border transition text-center cursor-pointer ${
                          receiptHasSplitPart
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        ⚡ Quitar 2ª Parte Agora
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptHasSplitPart(false)}
                        className={`py-2 px-2.5 rounded-xl text-[10.5px] font-bold border transition text-center cursor-pointer ${
                          !receiptHasSplitPart
                            ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        ⏳ Deixar Saldo Devedor
                      </button>
                    </div>

                    {receiptHasSplitPart ? (
                      /* Formulário da 2ª Parte */
                      <div className="bg-white/90 border border-indigo-200 rounded-xl p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-[11px] text-indigo-900">Detalhes da 2ª Parte</span>
                          <span className="text-[10px] text-indigo-600 font-mono font-bold">
                            Total: R$ {((receivedAmount || 0) + (parseCurrencyInput(receiptSplitAmountInput) || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Valor da 2ª Parte (R$)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={receiptSplitAmountInput}
                              onChange={(e) => setReceiptSplitAmountInput(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white"
                              placeholder={amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Data do Pagamento</label>
                            <input
                              type="date"
                              value={receiptSplitDateInput}
                              onChange={(e) => setReceiptSplitDateInput(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Forma de Pagamento (2ª Parte)</label>
                          <div className="grid grid-cols-3 gap-1">
                            {RENTAL_PAYMENT_METHODS.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setReceiptSplitPaymentMethod(m.id)}
                                className={`py-1 px-1.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                                  receiptSplitPaymentMethod === m.id
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                <span>{m.icon}</span>
                                <span className="truncate">{m.label.split(" ")[0]}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Observação da 2ª Parte (Opcional)</label>
                          <input
                            type="text"
                            value={receiptSplitObservation}
                            onChange={(e) => setReceiptSplitObservation(e.target.value)}
                            placeholder="Ex: Complemento pago via PIX na conta..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Tratamento do Saldo Devedor */
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-amber-800">
                          O saldo restante de <strong>R$ {amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> ficará registrado como débito em aberto e você poderá quitá-lo a qualquer momento com o botão <em>"Quitar 2ª Parte"</em>.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setReceiptShortfallTreatment("pending")}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              receiptShortfallTreatment === "pending"
                                ? "bg-amber-600 text-white border-amber-700"
                                : "bg-white text-amber-800 border-amber-200"
                            }`}
                          >
                            Deixar Saldo Devedor Ativo
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceiptShortfallTreatment("forgiven")}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              receiptShortfallTreatment === "forgiven"
                                ? "bg-slate-700 text-white border-slate-800"
                                : "bg-white text-slate-600 border-slate-200"
                            }`}
                          >
                            Aliviar / Perdoar Diferença
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Real-time feedback */}
            {receiptDateInput && (
              <div className={`p-3 rounded-xl border ${
                delayStatus === "ontime" 
                  ? "bg-emerald-50/50 border-emerald-150 text-emerald-800"
                  : delayStatus === "early"
                  ? "bg-sky-50/50 border-sky-150 text-sky-800"
                  : "bg-amber-50/60 border-amber-200 text-amber-800"
              } flex items-start gap-1.5`}>
                <Info size={14} className={`flex-shrink-0 mt-0.5 ${
                  delayStatus === "ontime" ? "text-emerald-500" : delayStatus === "early" ? "text-sky-500" : "text-amber-500"
                }`} />
                <div className="space-y-0.5 leading-normal">
                  <p className="font-bold">
                    {delayStatus === "ontime" && "Pagamento recebido no dia do vencimento!"}
                    {delayStatus === "early" && "Pagamento recebido adiantado!"}
                    {delayStatus === "late" && "Pagamento recebido com atraso!"}
                  </p>
                  <p className="text-[10.5px]">
                    {delayStatus === "ontime" && "Excelente. Transação sem juros nem multas de atraso."}
                    {delayStatus === "early" && `O pagamento foi quitado ${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? 'dia' : 'dias'} antes do vencimento planejado.`}
                    {delayStatus === "late" && `O pagamento foi quitado com ${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'} de atraso.`}
                  </p>
                  <p className="text-[10.5px]">
                    A imobiliária tem até 2 dias após o vencimento para repassar. Limite do repasse: <strong>{new Date(`${graceDateStr}T12:00:00`).toLocaleDateString("pt-BR")}</strong>.
                  </p>
                  {repasseGraceDays > 0 && (
                    <div className="mt-2 rounded-lg bg-white/65 border border-amber-200 p-2">
                      <p className="font-bold text-[10.5px]">Alerta suave: repasse passou {repasseGraceDays} {repasseGraceDays === 1 ? "dia" : "dias"} da tolerância.</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setReceiptLateFeeTreatment("suggested")}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                            receiptLateFeeTreatment === "suggested" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-800 border-amber-200"
                          }`}
                        >
                          Sugerir multa
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiptLateFeeTreatment("waived")}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                            receiptLateFeeTreatment === "waived" ? "bg-slate-700 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          Aliviar atraso
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Fixo com Botões Sempre Visíveis */}
          <div className="p-4 bg-slate-50/90 border-t border-slate-150 flex gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={resetReceiptConfirmation}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 font-bold rounded-xl transition cursor-pointer text-center text-xs shadow-3xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!receiptDateInput) return;
                const splitPartObj = receiptHasSplitPart && amountDifference > 0 ? {
                  amount: parseCurrencyInput(receiptSplitAmountInput) || amountDifference,
                  date: receiptSplitDateInput || receiptDateInput,
                  paymentMethod: receiptSplitPaymentMethod,
                  observation: receiptSplitObservation
                } : undefined;

                handleConfirmRentalPaidWithDetails(
                  rental,
                  period,
                  receiptDateInput,
                  receivedAmount,
                  receiptShortfallTreatment,
                  receiptLateFeeTreatment,
                  receiptPaymentMethod,
                  receiptObservation,
                  splitPartObj
                );
              }}
              className="flex-1 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl transition cursor-pointer text-center shadow-xs text-xs"
            >
              Confirmar Recebimento
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderRentNotificationBanner = () => {
    const { overdueList, dueTodayList, activePeriod } = rentalsStatusDetails;
    const totalNotifications = overdueList.length + dueTodayList.length;
    
    if (totalNotifications === 0) {
      return (
        <div className="bg-emerald-50/55 border border-emerald-150 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center">
              <Check size={16} />
            </span>
            <div className="space-y-0.5">
              <h5 className="font-bold text-xs text-emerald-950 leading-none">Tudo em dia!</h5>
              <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                Todos os aluguéis do período de <strong>{formatPeriodBRL(activePeriod)}</strong> estão quitados ou sem atrasos identificados.
              </p>
            </div>
          </div>
          <span className="text-[9.5px] uppercase font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-md">Auditoria Regular</span>
        </div>
      );
    }

    return (
      <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-4 md:p-5 flex flex-col gap-3 shadow-2xs">
        <div className="flex justify-between items-start border-b border-amber-200/50 pb-2.5 flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-700 rounded-xl relative flex items-center justify-center">
              <AlertCircle size={17} className="animate-bounce" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
            </span>
            <div className="space-y-0.5">
              <h5 className="font-extrabold text-sm text-slate-850 tracking-tight">Central de Notificação de Cobrança</h5>
              <p className="text-[11px] text-amber-850 leading-tight block">
                Há <strong>{totalNotifications} imóveis</strong> exigindo acompanhamento para <strong>{formatPeriodBRL(activePeriod)}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {overdueList.length > 0 && (
              <span className="text-[9px] font-extrabold bg-red-100 text-red-750 px-2 py-0.5 rounded-md">
                {overdueList.length} ATRASADO{overdueList.length === 1 ? "" : "S"}
              </span>
            )}
            {dueTodayList.length > 0 && (
              <span className="text-[9px] font-extrabold bg-amber-100 text-amber-850 px-2 py-0.5 rounded-md animate-pulse">
                {dueTodayList.length} VENCENDO HOJE
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Overdue */}
          {overdueList.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9.5px] font-bold text-red-650 uppercase tracking-widest block font-sans">Aluguéis em Atraso</span>
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                {overdueList.map(({ rental, daysLate, totalValue, baseDueDate }, idx) => (
                  <div key={idx} className="bg-white border border-red-100 p-2 rounded-xl flex justify-between items-center text-[11px] shadow-3xs hover:border-red-200">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded-sm">{rental.lfCode}</span>
                        <span className="font-bold text-slate-700 truncate max-w-[130px]">{rental.tenantName}</span>
                      </div>
                      <span className="text-[9.5px] text-slate-450 block font-normal">
                        Venceu em: {new Date(baseDueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-red-750 font-bold font-sans text-[10px] bg-red-50/80 px-1.5 py-0.5 rounded-md w-fit ml-auto">
                        {daysLate} {daysLate === 1 ? "dia" : "dias"} de atraso
                      </span>
                      <span className="font-bold text-slate-800 font-mono mt-0.5">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Today */}
          {dueTodayList.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9.5px] font-bold text-amber-605 uppercase tracking-widest block font-sans">Liquidando Hoje</span>
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                {dueTodayList.map(({ rental, totalValue }, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-amber-50 to-white border border-amber-200/60 p-2 rounded-xl flex justify-between items-center text-[11px] shadow-3xs">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded-sm">{rental.lfCode}</span>
                        <span className="font-bold text-slate-700 truncate max-w-[130px]">{rental.tenantName}</span>
                      </div>
                      <span className="text-[9.5px] text-amber-700 block font-medium animate-pulse">
                        Vencimento é HOJE!
                      </span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-amber-800 font-bold text-[9px] bg-amber-100 px-1.5 py-0.5 rounded-md w-fit ml-auto">
                        Hoje (Dia {rental.dueDay})
                      </span>
                      <span className="font-bold text-slate-800 font-mono mt-0.5">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRelatorioImobiliaria = () => {
    const { overdueList, dueTodayList, upcomingList, paidList, activePeriod } = rentalsStatusDetails;
    
    const totalExpectedCount = rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId).length;
    const totalPaidCount = paidList.length;
    const totalPendingCount = overdueList.length + dueTodayList.length + upcomingList.length;

    const totalExpectedVal = rentals
      .filter(r => !r.caixaId || r.caixaId === activeCaixaId)
      .reduce((sum, r) => sum + getRentalExpectedAmount(r), 0);

    const totalPaidVal = paidList.reduce((sum, { rental }) => {
      const netVal = getRentalExpectedAmount(rental);
      return sum + netVal;
    }, 0);

    const totalPendingVal = totalExpectedVal - totalPaidVal;

    const handlePrint = () => {
      window.print();
    };

    return (
      <div className="space-y-6 w-full print:bg-white print:p-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            html, body, #root {
              overflow: visible !important;
              height: auto !important;
              background: white !important;
            }

            body * {
              visibility: hidden !important;
            }

            body *:not(:has(#print-relatorio-imobiliaria)):not(#print-relatorio-imobiliaria):not(#print-relatorio-imobiliaria *) {
              display: none !important;
            }

            body *:has(#print-relatorio-imobiliaria) {
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

            #print-relatorio-imobiliaria,
            #print-relatorio-imobiliaria * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #print-relatorio-imobiliaria {
              position: static !important;
              width: 297mm !important;
              max-width: 297mm !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 8mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: #0f172a !important;
              overflow: visible !important;
            }

            #print-relatorio-imobiliaria table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }

            #print-relatorio-imobiliaria thead {
              display: table-header-group !important;
            }

            #print-relatorio-imobiliaria th,
            #print-relatorio-imobiliaria td {
              white-space: normal !important;
              overflow-wrap: anywhere !important;
              word-break: normal !important;
              vertical-align: top !important;
            }

            #print-relatorio-imobiliaria .overflow-x-auto,
            #print-relatorio-imobiliaria .overflow-y-auto,
            #print-relatorio-imobiliaria .overflow-hidden {
              overflow: visible !important;
            }

            #print-relatorio-imobiliaria .truncate {
              overflow: visible !important;
              text-overflow: clip !important;
              white-space: normal !important;
              max-width: none !important;
            }

            #print-relatorio-imobiliaria button,
            #print-relatorio-imobiliaria .print\\:hidden {
              display: none !important;
            }

            #print-relatorio-imobiliaria tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            @page {
              size: A4 landscape;
              margin: 0;
            }
          }
        ` }} />
        
        {/* Painel de Alerta / Notificação Integrado na Cabeceira do Relatório */}
        <div className="print:hidden">
          {renderRentNotificationBanner()}
        </div>

        {/* Report Card Frame */}
        <div id="print-relatorio-imobiliaria" className="bg-white border border-slate-200 rounded-3xl shadow-xs p-6 print:border-none print:shadow-none print:p-0">
          
          {/* Print specific header - hidden on screen, visible on print */}
          <div className="hidden print:flex flex-col gap-4 border-b pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans uppercase">DEMONSTRATIVO DE PRESTAÇÃO DE CONTAS</h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Relatório de adimplemento e controle de recebimentos • LF
                </p>
              </div>
              <div className="text-right font-mono text-xs text-slate-500 space-y-0.5">
                <p><strong>Gerado em:</strong> {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
                <p><strong>Referência:</strong> {formatPeriodBRL(activePeriod)}</p>
                <p><strong>Caixa:</strong> {activeCaixa.name}</p>
              </div>
            </div>
          </div>

          {/* Screen visible header actions */}
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-4 mb-5 flex-wrap gap-4 print:hidden">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                <span>📋 Relatório Prestação de Contas (Imobiliária)</span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                  Auditoria de Atrasos
                </span>
              </h3>
              <p className="text-[11px] text-slate-450 mt-1 leading-normal">
                Demonstrativo de cobrança de aluguel por datas de compensação, ideal para exportar para sua imobiliária ou administradora de bens.
              </p>
            </div>
            
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-xs hover:shadow-sm"
            >
              <Printer size={14} />
              Imprimir Relatório (Física/PDF)
            </button>
          </div>

          {/* Métricas do Período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Métricas de Faturamento</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-700">R$ {totalExpectedVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-400 font-sans">Consolidado ({totalExpectedCount} contratos)</span>
              </div>
            </div>

            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-emerald-650 block mb-1">Total Recebido (Efetivo)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-extrabold text-emerald-700">R$ {totalPaidVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-emerald-600 font-bold">({totalPaidCount} quitados)</span>
              </div>
            </div>

            <div className={`rounded-2xl p-4 flex flex-col justify-center border ${
              totalPendingVal > 0 ? "bg-amber-50/40 border-amber-100" : "bg-slate-50 border-slate-100"
            }`}>
              <span className={`text-[10px] uppercase font-bold block mb-1 ${totalPendingVal > 0 ? "text-amber-800" : "text-slate-400"}`}>
                Total Pendente (Em aberto + Atrasos)
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-extrabold ${totalPendingVal > 0 ? "text-amber-900" : "text-slate-650"}`}>
                  R$ {totalPendingVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-[10px] font-bold ${totalPendingVal > 0 ? "text-amber-700" : "text-slate-400"}`}>
                  ({totalPendingCount} pendentes)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Seção 1: Recebidos */}
            <div className="space-y-3">
              <div className="border-b border-indigo-50/60 pb-1.5 flex justify-between items-center">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  1. Pagamentos Recebidos ({totalPaidCount})
                </h4>
                <span className="text-[10px] font-semibold text-slate-400 italic">Controle de pontualidade</span>
              </div>

              {paidList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs">Nenhum aluguel foi recebido ou conciliado para este período até o momento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-600">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                        <th className="px-3 py-2">Imóvel</th>
                        <th className="px-3 py-2">Inquilino</th>
                        <th className="px-3 py-2">Atendimento de Encargos (Líquido)</th>
                        <th className="px-3 py-2 text-center">Data Recebimento</th>
                        <th className="px-3 py-2 text-right">Controle de Dias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paidList.map(({ rental, paidDate, daysDiff }, idx) => {
                        const netVal = getRentalExpectedAmount(rental);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 font-medium">
                            <td className="px-3 py-2.5 font-bold font-mono text-slate-800">{rental.lfCode}</td>
                            <td className="px-3 py-2.5 text-slate-705">{rental.tenantName}</td>
                            <td className="px-3 py-2.5 font-mono">
                              R$ {netVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-slate-650">
                              {paidDate.split("-").reverse().join("/")}
                            </td>
                            <td className="px-3 py-2.5 text-right font-sans">
                              {daysDiff === 0 && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded-lg">
                                  No Vencimento
                                </span>
                              )}
                              {daysDiff < 0 && (
                                <span className="px-2 py-0.5 bg-sky-55 text-sky-700 font-bold text-[9px] rounded-lg">
                                  Adiantado por {Math.abs(daysDiff)} {Math.abs(daysDiff) === 1 ? 'dia' : 'dias'}
                                </span>
                              )}
                              {daysDiff > 0 && (
                                <span className="px-2 py-0.5 bg-red-50 text-red-705 font-bold text-[9px] rounded-lg">
                                  Atrasado por {daysDiff} {daysDiff === 1 ? 'dia' : 'dias'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Seção 2: Pendentes e Atrasados */}
            <div className="space-y-3">
              <div className="border-b border-indigo-50/60 pb-1.5 flex justify-between items-center">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  2. Pagamentos Não Recebidos / Em Aberto e Atrasados ({totalPendingCount})
                </h4>
                <span className="text-[10px] font-semibold text-slate-400 italic">Inadimplências pendentes</span>
              </div>

              {overdueList.length === 0 && dueTodayList.length === 0 && upcomingList.length === 0 ? (
                <div className="py-8 text-center text-emerald-700 bg-emerald-50/20 rounded-2xl border border-dashed border-emerald-200">
                  <p className="text-xs font-bold font-sans">Parabéns! Todos os aluguéis do período de prestação de contas foram quitados!</p>
                </div>
              ) : (
                <div className="overflow-x-auto font-sans">
                  <table className="w-full text-xs text-left text-slate-600">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                        <th className="px-3 py-2">Imóvel</th>
                        <th className="px-3 py-2">Inquilino</th>
                        <th className="px-3 py-2">Vencimento Planejado</th>
                        <th className="px-3 py-2 font-mono">Valor Estimado</th>
                        <th className="px-3 py-2 text-center">Dias de Atraso</th>
                        <th className="px-3 py-2 text-right print:hidden">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Overdues */}
                      {overdueList.map(({ rental, daysLate, totalValue, baseDueDate }, idx) => (
                        <tr key={`overdue-${idx}`} className="bg-red-50/30 hover:bg-red-50/50 font-medium">
                          <td className="px-3 py-2.5 font-bold font-mono text-slate-800">{rental.lfCode}</td>
                          <td className="px-3 py-2.5 text-slate-700">{rental.tenantName}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">
                            {baseDueDate.split("-").reverse().join("/")}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                            R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-extrabold text-[9px] rounded-lg">
                              Atrasado por {daysLate} {daysLate === 1 ? 'dia' : 'dias'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right print:hidden">
                            <button
                              onClick={() => handleToggleRentalPaid(rental)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ml-auto shadow-3xs"
                            >
                              <Check size={11} /> Já Recebido
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Due Todays */}
                      {dueTodayList.map(({ rental, totalValue }, idx) => {
                        const maxDays = new Date(Number(filterYear !== "todos" ? filterYear : new Date().getFullYear()), Number(filterMonth !== "todos" ? filterMonth : new Date().getMonth() + 1), 0).getDate();
                        const actualDueDay = Math.min(rental.dueDay, maxDays);
                        const dueDateStr = `${filterYear !== "todos" ? filterYear : new Date().getFullYear()}-${filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;
                        return (
                          <tr key={`today-${idx}`} className="bg-amber-50/20 hover:bg-amber-50/40 font-medium animate-pulse">
                            <td className="px-3 py-2.5 font-bold font-mono text-slate-800">{rental.lfCode}</td>
                            <td className="px-3 py-2.5 text-slate-700">{rental.tenantName}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-600">
                              {dueDateStr.split("-").reverse().join("/")}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                              R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-850 font-extrabold text-[9px] rounded-lg">
                                Vence Hoje!
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right print:hidden">
                              <button
                                onClick={() => handleToggleRentalPaid(rental)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ml-auto shadow-3xs"
                              >
                                <Check size={11} /> Já Recebido
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Upcomings */}
                      {upcomingList.map(({ rental, daysToDue, totalValue }, idx) => {
                        const maxDays = new Date(Number(filterYear !== "todos" ? filterYear : new Date().getFullYear()), Number(filterMonth !== "todos" ? filterMonth : new Date().getMonth() + 1), 0).getDate();
                        const actualDueDay = Math.min(rental.dueDay, maxDays);
                        const dueDateStr = `${filterYear !== "todos" ? filterYear : new Date().getFullYear()}-${filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;
                        return (
                          <tr key={`upcoming-${idx}`} className="hover:bg-slate-50 font-medium">
                            <td className="px-3 py-2.5 font-bold font-mono text-slate-800">{rental.lfCode}</td>
                            <td className="px-3 py-2.5 text-slate-700">{rental.tenantName}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-600">
                              {dueDateStr.split("-").reverse().join("/")}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-slate-800">
                              R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-450 text-[10px]">
                              Vence em {daysToDue} {daysToDue === 1 ? 'dia' : 'dias'}
                            </td>
                            <td className="px-3 py-2.5 text-right print:hidden">
                              <button
                                onClick={() => handleToggleRentalPaid(rental)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ml-auto shadow-3xs"
                              >
                                <Check size={11} /> Já Recebido
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rodapé do Relatório */}
            <div className="border-t border-slate-200/60 pt-4 mt-6 flex justify-between items-center text-[10px] text-slate-400 leading-relaxed">
              <div className="space-y-0.5 max-w-lg">
                <p><strong>Nota Legal de Auditoria:</strong> Este demonstrativo consolida recebimentos históricos gravados de forma permanente.</p>
                <p>Correções de atrasos e devoluções automáticas são registradas no caixa <em>{activeCaixa.name}</em> no momento da conciliação.</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold uppercase text-[9px] tracking-wider text-slate-500">Sistema Fluxo de Caixa LF</p>
                <p className="italic">Garantia e Fidelidade de Dados no Encerramento de Contrato</p>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-600 selection:text-white pb-16">
      
      {/* Dynamic top info alert bar */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white text-xs py-2 px-4 shadow-sm flex justify-between items-center whitespace-normal border-b border-white/5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span><strong>Controle de Caixa</strong></span>
          
          <span className="text-[9px] sm:text-[10px] bg-white/10 px-2 py-0.5 rounded-full border border-white/5 flex items-center gap-1 text-slate-300">
            <Database size={10} /> Local
          </span>

          {/* Version & Update Indicator Badge */}
          <button
            type="button"
            onClick={() => checkForUpdates(false, true)}
            title="Verificar atualizações no repositório GitHub (caixaatt)"
            className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1.5 transition cursor-pointer select-none ${
              updateInfo?.hasUpdate
                ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-300 font-extrabold hover:bg-emerald-500/35 ring-1 ring-emerald-400/30"
                : "bg-white/10 border-white/5 text-slate-300 hover:bg-white/15"
            }`}
          >
            {updateInfo?.hasUpdate ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>v{updateInfo.currentVersion} • Nova v{updateInfo.latestVersion}!</span>
              </>
            ) : (
              <>
                <RefreshCw size={9} className={isCheckingUpdate ? "animate-spin text-indigo-300" : "text-slate-400"} />
                <span>v{updateInfo?.currentVersion || "1.0.9"}</span>
              </>
            )}
          </button>

          {isGoogleConnected ? (
            <div className="flex items-center gap-1.5 ml-1 sm:ml-2 border-l border-white/20 pl-2 sm:pl-3">
              {syncStatus === "syncing" && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              )}
              {syncStatus === "synced" && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              )}
              {syncStatus === "error" && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
              )}
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-200">
                {syncStatus === "syncing" && "Sincronizando..."}
                {syncStatus === "synced" && "Nuvem Sincronizada"}
                {syncStatus === "error" && "Erro de conexão"}
                {syncStatus === "idle" && "Conectado"}
              </span>
              {userGoogleInfo && (
                <span className="text-[9px] text-slate-400 hidden sm:inline ml-1 font-mono">
                  ({userGoogleInfo.email})
                </span>
              )}
            </div>
          ) : null}
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4 text-slate-300 flex-wrap">
          {/* Google Sync Actions */}
          {isGoogleConnected ? (
            <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 border-r border-white/10">
              {userGoogleInfo && userGoogleInfo.picture ? (
                <img 
                  src={userGoogleInfo.picture} 
                  alt={userGoogleInfo.name} 
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/20"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={12} className="text-slate-400" />
              )}
              <span className="font-semibold max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline text-white">{userGoogleInfo?.name}</span>
              <button 
                onClick={() => downloadAndRestoreFromGoogleDrive()}
                title="Sincronizar agora"
                className="hover:text-white transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                <span>Sync</span>
              </button>
              <button 
                onClick={handleLogoutGoogle}
                className="text-rose-400 hover:text-rose-300 transition text-[10px] font-bold cursor-pointer"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
              <button 
                onClick={handleConnectGoogle}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded-lg flex items-center gap-1 cursor-pointer transition text-[10px] sm:text-[11px]"
              >
                <Cloud size={11} />
                <span>Conectar Google Drive</span>
              </button>
              <button 
                onClick={() => setIsGoogleConfigModalOpen(true)}
                title="Configurar ID do Cliente Google"
                className="hover:text-white transition flex items-center p-1 text-slate-350 cursor-pointer"
              >
                <Settings size={12} />
              </button>
            </div>
          )}

          <label className="cursor-pointer hover:text-white transition flex items-center gap-1">
            <Upload size={13} />
            <span className="hidden sm:inline">Importar Backup</span>
            <input type="file" accept=".json" onChange={importFromJSON} className="hidden" />
          </label>
          <button onClick={exportToJSON} className="hover:text-white transition flex items-center gap-1 cursor-pointer">
            <Download size={13} />
            <span className="hidden sm:inline">Exportar Backup</span>
          </button>
          <button
            type="button"
            onClick={() => checkForUpdates(false, true)}
            title="Buscar atualizações no GitHub (caixaatt)"
            className="text-[10px] sm:text-[11px] hover:text-white transition flex items-center gap-1 text-slate-300 cursor-pointer"
          >
            <RefreshCw size={11} className={isCheckingUpdate ? "animate-spin text-indigo-400" : ""} />
            <span className="hidden sm:inline">Atualizações</span>
          </button>
          <button 
            onClick={() => setIsResetConfirmOpen(true)}
            className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1 text-[11px] border-l border-white/10 pl-3 sm:pl-4 cursor-pointer"
          >
            <RefreshCw size={11} />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* APP UPDATE NOTIFICATION BANNER */}
        <AnimatePresence>
          {showUpdateBanner && updateInfo?.hasUpdate && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, margin: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-8 rounded-3xl border border-emerald-300/80 bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-800 text-white p-5 shadow-lg overflow-hidden relative"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner border border-white/20">
                    <Sparkles size={24} className="text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="font-black text-base tracking-tight">Nova Atualização Disponível!</h4>
                      <span className="bg-white/25 text-white text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border border-white/20">
                        v{updateInfo.latestVersion}
                      </span>
                      {updateInfo.isSimulated && (
                        <span className="bg-amber-400/30 text-amber-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                          Modo Demonstração
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                      {updateInfo.releaseName}. Uma nova versão foi publicada no repositório com melhorias e correções. Você pode verificar as mudanças antes de atualizar.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSnoozeUpdate}
                    className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition cursor-pointer"
                    title="Lembrar mais tarde (24h)"
                  >
                    Lembrar Mais Tarde
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-black shadow-md transition cursor-pointer flex items-center gap-1.5 transform active:scale-95"
                  >
                    <span>Ver Mudanças e Atualizar</span>
                    <ChevronRight size={14} className="stroke-[3]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUpdateBanner(false)}
                    className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition cursor-pointer"
                    title="Fechar este aviso"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RENTAL DUE ALERTS BANNER (REPOSITIONED TO THE TOP - VERY EYE-CATCHING AND PRESTINE) */}
        <AnimatePresence>
          {rentDueAlerts.totalCount > 0 && !hideAlertsBanner && (() => {
            const hasOverdue = rentDueAlerts.overdue.length > 0;
            const hasDueToday = rentDueAlerts.dueToday.length > 0;
            const isOnlyDueSoon = rentDueAlerts.dueSoon.length > 0 && !hasOverdue && !hasDueToday;

            let bannerStyle = "";
            let iconContainerStyle = "";
            let titleText = "";
            let iconElement = null;

            if (hasOverdue) {
              bannerStyle = "bg-rose-50/95 border-rose-300/80 text-rose-950 ring-2 ring-rose-500/10";
              iconContainerStyle = "bg-rose-100 text-rose-600 border border-rose-205/30";
              titleText = "Aviso Urgente: Pendências de Locação";
              iconElement = <AlertTriangle size={20} className="stroke-[2.5]" />;
            } else if (hasDueToday) {
              bannerStyle = "bg-amber-50/95 border-amber-300/80 text-amber-950 ring-2 ring-amber-500/10";
              iconContainerStyle = "bg-amber-100 text-amber-600 border border-amber-205/30";
              titleText = "Aviso: Aluguel Vencendo Hoje";
              iconElement = <AlertTriangle size={20} className="stroke-[2.5]" />;
            } else {
              bannerStyle = "bg-sky-50/90 border-sky-200/85 text-sky-950 ring-1 ring-sky-100/30";
              iconContainerStyle = "bg-sky-100 text-sky-700 border border-sky-150";
              titleText = "Lembrete: Próximos Vencimentos de Locação";
              iconElement = <Calendar size={20} />;
            }

            return (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, margin: 0 }}
                transition={{ duration: 0.25 }}
                className={`mb-8 rounded-3xl border overflow-hidden shadow-md transition-all duration-300 relative z-30 ${bannerStyle}`}
              >
              {/* Header portion of the Banner */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl flex-shrink-0 relative mt-0.5 sm:mt-0 ${iconContainerStyle}`}>
                    {!isOnlyDueSoon && (
                      <span className="absolute top-0 right-0 flex h-3 w-3 -mt-1.5 -mr-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          hasOverdue ? "bg-rose-400" : "bg-amber-400"
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          hasOverdue ? "bg-rose-500" : "bg-amber-500"
                        }`}></span>
                      </span>
                    )}
                    {iconElement}
                  </div>
                  <div>
                    <h4 className="font-black tracking-tight text-base text-slate-900 flex items-center gap-2">
                      <span>{titleText}</span>
                      {hasOverdue && (
                        <span className="bg-rose-650 text-white text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full tracking-wide shrink-0">
                          Atrasado
                        </span>
                      )}
                      {isOnlyDueSoon && (
                        <span className="bg-sky-655 text-sky-900 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full tracking-wide shrink-0 select-none">
                          Lembrete
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {isOnlyDueSoon ? (
                        <span>
                          Você possui <span className="font-extrabold text-slate-800">{rentDueAlerts.dueSoon.length} contratos</span> com vencimento programado para os próximos dias (não estão vencidos). Total futuro estimado: <span className="font-black text-slate-800 font-mono text-sm">R$ {rentDueAlerts.totalPendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </span>
                      ) : (
                        <span>
                          Você tem <span className="font-extrabold text-slate-900">{rentDueAlerts.totalCount} cobranças pendentes</span> neste período para o seu caixa ativo: 
                          {hasOverdue ? ` ${rentDueAlerts.overdue.length} em atraso ` : ""} 
                          {hasDueToday ? ` • ${rentDueAlerts.dueToday.length} vencendo hoje ` : ""}
                          {rentDueAlerts.dueSoon.length > 0 ? ` • ${rentDueAlerts.dueSoon.length} vencendo em breve ` : ""}. 
                          Total pendente estimado: <span className="font-black text-slate-900 font-mono text-sm">R$ {rentDueAlerts.totalPendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Action and Dismiss buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition flex items-center gap-1.5 bg-white hover:bg-slate-50 border ${
                      hasOverdue
                        ? "border-rose-350 text-rose-700 hover:border-rose-400"
                        : hasDueToday
                        ? "border-amber-350 text-amber-700 hover:border-amber-400"
                        : "border-sky-300 text-sky-800 hover:border-sky-400"
                    }`}
                  >
                    <span>{isAlertsExpanded ? "Recolher Detalhes" : "Ver Lista Completa"}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isAlertsExpanded ? "rotate-180" : ""}`} />
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setHideAlertsBanner(true);
                      addLogEntry("alerta_ciente", "Usuário confirmou estar ciente das notificações de vencimento ativo.");
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm hover:scale-[1.02] transition cursor-pointer flex items-center gap-1.5 text-white ${
                      hasOverdue
                        ? "bg-rose-600 hover:bg-rose-700 border-rose-600 shadow-xs"
                        : hasDueToday
                        ? "bg-amber-500 hover:bg-amber-600 border-amber-500 shadow-xs"
                        : "bg-sky-600 hover:bg-sky-700 border-sky-655 shadow-xs"
                    }`}
                    title="Confirmar ciência deste aviso"
                  >
                    <Check size={14} className="stroke-[3.5]" />
                    <span>OK, Estou Ciente</span>
                  </button>
                </div>
              </div>

              {/* Expandable detailed content section */}
              {isAlertsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-black/[0.04] bg-white/40"
                >
                  <div className="p-4 sm:p-5 space-y-4">
                    
                    {/* Grid columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* COL 1: OVERDUE (ATRASADOS) */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                        <div>
                          <div className="flex justify-between items-center pb-2.5 border-b border-rose-100">
                            <span className="text-xs font-black uppercase text-rose-600 flex items-center gap-1">
                              <span>🚨</span> Atrasados ({rentDueAlerts.overdue.length})
                            </span>
                            <span className="text-[9px] uppercase font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-md leading-none">Atrasado</span>
                          </div>
                          
                          <div className="mt-2.5 space-y-2 pr-1">
                            {rentDueAlerts.overdue.length > 0 ? (
                              rentDueAlerts.overdue.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0 font-sans leading-tight">
                                  <div className="min-w-0 pr-2">
                                    <div className="font-extrabold text-slate-800 truncate max-w-[150px]" title={item.rental.tenantName}>
                                      {item.rental.tenantName}
                                    </div>
                                    <div className="text-[10px] text-rose-500 font-bold mt-0.5 flex items-center gap-1.5">
                                      <span className="font-mono bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black">{item.rental.lfCode}</span>
                                      <span>Há {item.daysLate} {item.daysLate === 1 ? "dia" : "dias"}</span>
                                    </div>
                                  </div>
                                  <span className="font-extrabold text-[11px] text-rose-600 font-mono whitespace-nowrap bg-rose-50/60 px-2 py-1 rounded-xl">
                                    R$ {item.totalVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 italic text-[11px]">Nenhum contrato em atraso.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COL 2: DUE TODAY (VENCE HOJE) */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                        <div>
                          <div className="flex justify-between items-center pb-2.5 border-b border-amber-100">
                            <span className="text-xs font-black uppercase text-amber-600 flex items-center gap-1">
                              <span>⏰</span> Vence Hoje ({rentDueAlerts.dueToday.length})
                            </span>
                            <span className="text-[9px] uppercase font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md leading-none">Hoje</span>
                          </div>
                          
                          <div className="mt-2.5 space-y-2 pr-1">
                            {rentDueAlerts.dueToday.length > 0 ? (
                              rentDueAlerts.dueToday.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0 font-sans leading-tight">
                                  <div className="min-w-0 pr-2">
                                    <div className="font-extrabold text-slate-800 truncate max-w-[150px]" title={item.rental.tenantName}>
                                      {item.rental.tenantName}
                                    </div>
                                    <div className="text-[10px] text-amber-500 font-bold mt-0.5 flex items-center gap-1.5">
                                      <span className="font-mono bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black">{item.rental.lfCode}</span>
                                      <span>Hoje!</span>
                                    </div>
                                  </div>
                                  <span className="font-extrabold text-[11px] text-amber-600 font-mono whitespace-nowrap bg-amber-50/60 px-2 py-1 rounded-xl">
                                    R$ {item.totalVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 italic text-[11px]">Nenhum contrato vencendo hoje.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COL 3: DUE SOON (VENCE EM BREVE) */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                        <div>
                          <div className="flex justify-between items-center pb-2.5 border-b border-indigo-100">
                            <span className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1">
                              <span>📅</span> Vence em Breve ({rentDueAlerts.dueSoon.length})
                            </span>
                            <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md leading-none">Futuro</span>
                          </div>
                          
                          <div className="mt-2.5 space-y-2 pr-1">
                            {rentDueAlerts.dueSoon.length > 0 ? (
                              rentDueAlerts.dueSoon.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0 font-sans leading-tight">
                                  <div className="min-w-0 pr-2">
                                    <div className="font-extrabold text-slate-800 truncate max-w-[150px]" title={item.rental.tenantName}>
                                      {item.rental.tenantName}
                                    </div>
                                    <div className="text-[10px] text-indigo-500 font-bold mt-0.5 flex items-center gap-1.5">
                                      <span className="font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-black">{item.rental.lfCode}</span>
                                      <span>Em {item.daysToDue} {item.daysToDue === 1 ? "dia" : "dias"}</span>
                                    </div>
                                  </div>
                                  <span className="font-extrabold text-[11px] text-indigo-600 font-mono whitespace-nowrap bg-indigo-50/60 px-2 py-1 rounded-xl">
                                    R$ {item.totalVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 italic text-[11px]">Sem vencimentos próximos (7 dias).</div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Footer informational subrow in expand area */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-black/[0.04]">
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-semibold">
                        <Info size={12} className="text-slate-400 flex-shrink-0" />
                        <span>Estes alertas são automáticos para a competência de visualização ativa.</span>
                      </div>
                      <span className="text-[10.5px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold">
                        🔑 Vá na aba "Propriedades & Aluguéis" para realizar baixas ou editar contratos.
                      </span>
                    </div>

                  </div>
                </motion.div>
              )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Dynamic header - matches visual from user screenshot with premium design */}
        <div id="app-header" className="relative bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white py-10 px-8 rounded-2xl shadow-xl overflow-hidden mb-8 text-center border-b border-indigo-500/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
          
          <div className="relative">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-200/90 bg-blue-950/40 px-3 py-1.5 rounded-full select-none">
              Gestor Financeiro Digital
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-3 text-white drop-shadow-sm">
              {activeCaixa.name}
            </h1>
            <p className="text-blue-100/80 text-sm max-w-lg mx-auto sm:text-base mt-2 font-light">
              Mantenha o controle sob as entradas e saídas e use assessoria inteligente de I.A. nas suas finanças.
            </p>
          </div>
        </div>

        {/* Action Bar / Period & Account Tab Navigator */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Múltiplos Caixas (Aba de Navegação) */}
          <div className="lg:col-span-8 overflow-x-auto">
            <div className="flex items-center gap-2 pb-2 scrollbar-none">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider mr-2 select-none">CONTAS:</span>
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {caixas.map((c, index) => {
                  const isActive = c.id === activeCaixaId;
                  return (
                    <div
                      key={c.id}
                      className={`group relative flex items-center rounded-lg transition-all duration-150 select-none ${
                        isActive
                          ? "bg-white text-blue-800 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      {/* Move Left Button */}
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCaixa(index, "left");
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-700 hover:bg-slate-100/60 rounded-md cursor-pointer pl-1.5 pr-0.5 -mr-1"
                          title="Mover aba para esquerda"
                        >
                          <ChevronLeft size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveCaixaId(c.id)}
                        className="px-3.5 py-2 text-sm font-medium whitespace-nowrap cursor-pointer"
                      >
                        {c.name}
                      </button>

                      {/* Move Right Button */}
                      {index < caixas.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCaixa(index, "right");
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-700 hover:bg-slate-100/60 rounded-md cursor-pointer pr-1.5 pl-0.5 -ml-1"
                          title="Mover aba para direita"
                        >
                          <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons inside boxes list */}
              <button
                onClick={() => setIsNewCaixaModalOpen(true)}
                title="Criar novo Caixa"
                className="p-2 border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 rounded-xl transition cursor-pointer"
              >
                <Plus size={16} />
              </button>

              {activeCaixaId !== "principal" ? (
                <button
                  onClick={() => {
                    setRenameCaixaName(activeCaixa.name);
                    setIsRenameCaixaModalOpen(true);
                  }}
                  title="Configurações do Caixa Ativo"
                  className="p-2 border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-500 rounded-xl transition cursor-pointer"
                >
                  <Settings size={16} />
                </button>
              ) : (
                <div
                  title="O Caixa Principal é fixo e não pode ser renomeado ou removido"
                  className="p-2 border border-slate-100 bg-slate-50 text-slate-450 rounded-xl select-none cursor-not-allowed"
                >
                  <Lock size={16} />
                </div>
              )}
            </div>
          </div>

          {/* Period Filter Selector */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row gap-2 justify-end items-stretch sm:items-center">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
              <button
                type="button"
                onClick={() => shiftFilterMonth(-1)}
                className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border-r border-slate-100 transition cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={filterMonth}
                onChange={(e) => handleFilterMonthChange(e.target.value)}
                className="h-10 w-full sm:w-44 bg-white border-none text-slate-700 text-sm px-3 outline-none focus:bg-indigo-50 transition cursor-pointer font-semibold"
                aria-label="Selecionar mês do filtro"
              >
                <option value="todos">Todos os meses</option>
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => shiftFilterMonth(1)}
                className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border-l border-slate-100 transition cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
              <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 border-r border-slate-100 select-none">Ano</span>
              <select
                value={filterYear}
                onChange={(e) => handleFilterYearChange(e.target.value)}
                className="h-10 w-full sm:w-28 bg-white border-none text-slate-700 text-sm px-3 outline-none focus:bg-indigo-50 transition cursor-pointer font-semibold"
                aria-label="Selecionar ano do filtro"
              >
                <option value="todos">Todos os anos</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={setFilterToCurrentMonth}
              className="h-10 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
              title="Voltar para o mês atual"
            >
              <Calendar size={14} />
              <span>Mês atual</span>
            </button>
          </div>

        </div>

        {/* Totals Summary Cards Row - Matches perfectly with the design of screenshots bottom cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card: TOTAL ENTRADAS */}
          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100/50 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div className="absolute right-0 bottom-0 text-emerald-100 translate-x-3 translate-y-3 pointer-events-none select-none">
              <TrendingUp size={100} className="stroke-[1.5]" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-700/80 tracking-wider uppercase select-none">
                Total de Entrada (+)
              </span>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 font-mono">
                R$ {totals.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-4">
              Receitas acumuladas no período
            </div>
          </div>

          {/* Card: TOTAL SAIDAS */}
          <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100/50 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div className="absolute right-0 bottom-0 text-rose-100 translate-x-3 translate-y-3 pointer-events-none select-none">
              <TrendingDown size={100} className="stroke-[1.5]" />
            </div>
            <div>
              <span className="text-xs font-bold text-rose-700/80 tracking-wider uppercase select-none">
                Total de Saída (-)
              </span>
              <h3 className="text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                R$ {totals.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-4 flex items-center justify-between flex-wrap gap-1">
              <span>Despesas e saídas do caixa</span>
              {totals.faturaCartaoPendente > 0 && (
                <span className="text-[10px] text-purple-700 bg-purple-100/90 border border-purple-200 px-2 py-0.5 rounded-full font-bold" title="Compras no cartão de crédito a serem quitadas via pagamento de fatura">
                  💳 Fatura aberta: R$ {totals.faturaCartaoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          {/* Card: SALDO DIRETO */}
          <div className={`rounded-2xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden text-white transition-all ${
            (includeSaldoAnterior ? (totals.saldo + saldoAnterior) : totals.saldo) >= 0 
              ? "bg-gradient-to-br from-blue-700 to-indigo-850 border border-blue-600/30" 
              : "bg-gradient-to-br from-rose-800 to-red-950 border border-rose-700/30"
          }`}>
            <div className="absolute right-0 bottom-0 text-white/5 translate-x-3 translate-y-3 pointer-events-none select-none">
              <DollarSign size={100} className="stroke-[1.5]" />
            </div>
            
            <div className="flex items-center justify-between w-full relative z-10">
              <span className="text-xs font-bold text-blue-100/80 tracking-wider uppercase select-none">
                {includeSaldoAnterior ? "Saldo Acumulado" : "Saldo do Mês Puro"}
              </span>

              {/* Dynamic Interactive Switch */}
              <button
                type="button"
                onClick={() => setIncludeSaldoAnterior(!includeSaldoAnterior)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2 py-1 rounded-xl cursor-pointer transition select-none text-[10px] font-bold border border-white/15 shadow-2xs"
                title="Alternar entre somar o saldo acumulado histórico ou manter o caixa isolado desta competência"
              >
                <div className={`relative w-7 h-4 rounded-full transition-colors ${includeSaldoAnterior ? "bg-emerald-500" : "bg-slate-500/50"}`}>
                  <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-all duration-200 ${includeSaldoAnterior ? "translate-x-3" : "translate-x-0"}`} />
                </div>
                <span className="text-white text-[9px] font-bold uppercase tracking-wider pl-0.5">Saldo Anterior</span>
              </button>
            </div>

            <div className="mt-3.5 relative z-10">
              <h3 className="text-3xl font-black font-mono drop-shadow-sm">
                R$ {(includeSaldoAnterior ? (totals.saldo + saldoAnterior) : totals.saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h3>

              {/* Breakdown when Carryover is active / styled with subtle elegance */}
              {includeSaldoAnterior && saldoAnterior !== 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1 text-[10px] text-blue-100/80 font-mono transition-opacity duration-300">
                  <div className="flex justify-between items-center">
                    <span>Carry-over (Anterior):</span>
                    <span className="font-bold text-white">R$ {saldoAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Resultado Puro do Mês:</span>
                    <span className={`font-bold ${totals.saldo >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {totals.saldo >= 0 ? "+" : ""}R$ {totals.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Helpful descriptive message when carryover is off */}
              {(!includeSaldoAnterior || saldoAnterior === 0) && (
                <div className="mt-2 text-[10px] text-blue-100/60 font-medium select-none">
                  {saldoAnterior === 0 ? "Sem saldo histórico anterior" : "Exibindo caixa isolado deste período"}
                </div>
              )}
            </div>

            <div className="text-[11px] text-blue-100/90 font-semibold mt-4 flex items-center gap-1.5 select-none relative z-10">
              <span className={`h-2.5 w-2.5 rounded-full ${(includeSaldoAnterior ? (totals.saldo + saldoAnterior) : totals.saldo) >= 0 ? "bg-emerald-400" : "bg-red-400"} shadow-sm`}></span>
              {(includeSaldoAnterior ? (totals.saldo + saldoAnterior) : totals.saldo) >= 0 ? "Caixa Ativo Positivo" : "Orçamento em Défice"}
            </div>
          </div>

        </div>

        {/* Dashboard Grid View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Adicionar Nova Transação Form - Match screen screenshot precisely */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Plus size={18} /></span>
                Adicionar Nova Transação
              </h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">No caixa: {activeCaixa.name}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              
              {/* Date Input */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1 select-none">
                  Data
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1 select-none">
                  Descrição / Legenda
                </label>
                <input
                  type="text"
                  placeholder="Ex: Salário, Aluguel, Mercado"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100 outline-none transition"
                  maxLength={50}
                />
              </div>

              {/* Value input (R$) */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1 select-none">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-450 text-sm font-semibold select-none">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={formAmountStr}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9,.]/g, "");
                      setFormAmountStr(clean);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-700 font-semibold focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

            </div>

            {/* Quick Suggestions Row */}
            {quickTemplateSuggestions.length > 0 && (
              <div className="mb-6 select-none bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sugestões frequentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickTemplateSuggestions.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormDescription(item.description);
                        setFormCategory(item.lastCategory);
                        setFormAmountStr(item.lastAmount > 0 ? item.lastAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
                      }}
                      title={`Clique para preencher.\nÚltimo: R$ ${item.lastAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} na categoria ${item.lastCategory} (${item.count} ocorrência(s))`}
                      className={`text-[11px] border bg-white px-2.5 py-1.5 rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-3xs ${
                        item.lastType === "entrada"
                          ? "border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-800"
                          : "border-slate-100 hover:border-rose-200 hover:bg-rose-50/50 text-slate-700 hover:text-rose-800"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${item.lastType === "entrada" ? "bg-emerald-500" : "bg-rose-500"} flex-shrink-0`}></span>
                      <span className="font-semibold">{item.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Forma de Pagamento Selector Row */}
            <div className="mb-6 p-4 bg-slate-50/80 border border-slate-200/70 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <CreditCardIcon size={14} className="text-indigo-600" />
                  Forma de Pagamento
                </label>
                {formPaymentMethod === "cartao_credito" && (
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Entra na fatura de acordo com o fechamento do cartão
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "dinheiro", label: "Dinheiro", icon: "💵" },
                  { id: "pix", label: "PIX", icon: "⚡" },
                  { id: "cartao_credito", label: "Cartão de Crédito", icon: "💳" },
                  { id: "cartao_debito", label: "Cartão de Débito", icon: "💳" },
                  { id: "boleto", label: "Boleto", icon: "📄" },
                  { id: "outros", label: "Outros", icon: "🔄" },
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setFormPaymentMethod(method.id as PaymentMethod)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      formPaymentMethod === method.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/50"
                    }`}
                  >
                    <span>{method.icon}</span>
                    <span>{method.label}</span>
                  </button>
                ))}
              </div>

              {/* Extra details when Cartão de Crédito is selected */}
              {formPaymentMethod === "cartao_credito" && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Selecionar Cartão de Crédito:
                    </label>
                    {activeCards.length > 0 ? (
                      <select
                        value={formCardId}
                        onChange={e => setFormCardId(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">Selecione o cartão...</option>
                        {activeCards.map(card => (
                          <option key={card.id} value={card.id}>
                            {card.name} (Vira dia {card.closingDay} • Vence dia {card.dueDay})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                        <span>Nenhum cartão cadastrado.</span>
                        <button
                          type="button"
                          onClick={() => setSubTab("cartoes")}
                          className="font-bold underline cursor-pointer ml-2"
                        >
                          Cadastrar Cartão
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Parcelamento:
                    </label>
                    <select
                      value={formInstallmentsCount}
                      onChange={e => setFormInstallmentsCount(parseInt(e.target.value) || 1)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value={1}>À vista (1x)</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => (
                        <option key={n} value={n}>
                          Parcelado em {n}x {formAmountStr ? `(R$ ${(parseCurrencyInput(formAmountStr) / n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Banner informativo da virada do cartão */}
                  {formCardId && (() => {
                    const card = activeCards.find(c => c.id === formCardId);
                    if (!card) return null;
                    const cycle = getCreditCardCycleForPurchase(formDate, card.closingDay, card.dueDay);
                    return (
                      <div className={`col-span-1 sm:col-span-2 p-2.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                        cycle.isRolledToNextMonth
                          ? "bg-purple-50 border-purple-200 text-purple-900"
                          : "bg-indigo-50 border-indigo-200 text-indigo-900"
                      }`}>
                        <span className="text-base">{cycle.isRolledToNextMonth ? "⚡" : "📅"}</span>
                        <div>
                          <p className="font-bold leading-tight">
                            {cycle.isRolledToNextMonth
                              ? `O cartão virou dia ${card.closingDay}! Esta compra entrará na Fatura de ${cycle.invoiceLabel}.`
                              : `Esta compra entrará na Fatura de ${cycle.invoiceLabel} (fecha dia ${card.closingDay}).`}
                          </p>
                          <p className="text-[10px] opacity-80 mt-0.5">
                            Vencimento da fatura: <strong>{cycle.dueDate.split("-").reverse().join("/")}</strong>. As compras no cartão são agrupadas na fatura e debitam do caixa na quitação.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Form Actions: green Entrada and red Saída exactly like physical button mockups */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              
              <button
                onClick={() => handleAddTransaction("entrada")}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 font-bold py-3.5 px-6 rounded-xl transition duration-200 active:scale-97 shadow-lg text-white text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingUp size={18} />
                <span>Salvar Entrada</span>
              </button>

              <button
                onClick={() => handleAddTransaction("saida")}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 font-bold py-3.5 px-6 rounded-xl transition duration-200 active:scale-97 shadow-lg text-white text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingDown size={18} />
                <span>Registrar Saída</span>
              </button>

            </div>
          </div>

          {/* Analytics Overview Column - 3 Gráficos: Saídas, Entradas e Misto */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-100 pb-3 select-none">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <PieChart size={16} className="text-indigo-650" />
                  Divisão por Categorias
                </h2>
                <span className="text-[10px] font-bold uppercase bg-blue-100/70 text-blue-800 px-2 py-0.5 rounded-full w-max">
                  {filterMonth !== "todos" ? (monthsList.find(m => m.value === filterMonth)?.label || "Mês Atual") : "Todo Histórico"}
                </span>
              </div>

              {/* Seletor dos 3 Gráficos */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mb-4 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setOverviewChartTab("todos")}
                  className={`flex-1 py-1 px-1.5 rounded-lg transition text-center cursor-pointer ${
                    overviewChartTab === "todos"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Exibir os 3 gráficos simultaneamente"
                >
                  3 Gráficos
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewChartTab("saidas")}
                  className={`flex-1 py-1 px-1.5 rounded-lg transition text-center cursor-pointer ${
                    overviewChartTab === "saidas"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Gráfico exclusivo de Despesas (Saídas)"
                >
                  Saídas
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewChartTab("entradas")}
                  className={`flex-1 py-1 px-1.5 rounded-lg transition text-center cursor-pointer ${
                    overviewChartTab === "entradas"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Gráfico exclusivo de Receitas (Entradas)"
                >
                  Entradas
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewChartTab("misto")}
                  className={`flex-1 py-1 px-1.5 rounded-lg transition text-center cursor-pointer ${
                    overviewChartTab === "misto"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Gráfico misto comparativo: Entradas x Saídas"
                >
                  Misto
                </button>
              </div>

              {/* RENDERIZAÇÃO DOS GRÁFICOS */}
              <div className="space-y-4">
                {/* 1. GRÁFICO DE SAÍDAS / DESPESAS */}
                {(overviewChartTab === "todos" || overviewChartTab === "saidas") && (
                  <div className={`p-3 rounded-xl border border-slate-100 ${overviewChartTab === "todos" ? "bg-slate-50/60" : "bg-white"}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        1. Saídas / Despesas
                      </span>
                      <span className="font-mono text-xs font-bold text-rose-600">
                        R$ {totals.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {donutRingSaidas.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-24 h-24 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-95">
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            {donutRingSaidas.map((ring, idx) => (
                              <path
                                key={idx}
                                d={ring.path}
                                fill="none"
                                stroke={getCategoryColorHex(ring.name)}
                                strokeWidth="8.5"
                                strokeLinecap="round"
                                className="transition duration-300 hover:stroke-[10] cursor-pointer"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center px-1">
                            <span className="text-[8px] font-bold uppercase text-slate-400 leading-none">Saídas</span>
                            <span className="text-[10px] font-extrabold text-slate-700 font-mono mt-0.5">
                              R$ {totals.saida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 space-y-1 max-h-24 overflow-y-auto pr-1">
                          {donutRingSaidas.slice(0, overviewChartTab === "saidas" ? 8 : 4).map((r, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10.5px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <span 
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getCategoryColorHex(r.name) }}
                                ></span>
                                <span className="text-slate-600 truncate font-semibold" title={r.name}>{r.name}</span>
                              </div>
                              <span className="font-mono text-slate-500 text-[9.5px] ml-1">{r.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400 italic">
                        Nenhuma saída registrada no período.
                      </div>
                    )}
                  </div>
                )}

                {/* 2. GRÁFICO DE ENTRADAS / RECEITAS */}
                {(overviewChartTab === "todos" || overviewChartTab === "entradas") && (
                  <div className={`p-3 rounded-xl border border-slate-100 ${overviewChartTab === "todos" ? "bg-slate-50/60" : "bg-white"}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        2. Entradas / Receitas
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-600">
                        R$ {totals.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {donutRingEntradas.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-24 h-24 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-95">
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            {donutRingEntradas.map((ring, idx) => (
                              <path
                                key={idx}
                                d={ring.path}
                                fill="none"
                                stroke={getCategoryColorHex(ring.name)}
                                strokeWidth="8.5"
                                strokeLinecap="round"
                                className="transition duration-300 hover:stroke-[10] cursor-pointer"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center px-1">
                            <span className="text-[8px] font-bold uppercase text-slate-400 leading-none">Entradas</span>
                            <span className="text-[10px] font-extrabold text-slate-700 font-mono mt-0.5">
                              R$ {totals.entrada.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 space-y-1 max-h-24 overflow-y-auto pr-1">
                          {donutRingEntradas.slice(0, overviewChartTab === "entradas" ? 8 : 4).map((r, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10.5px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <span 
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getCategoryColorHex(r.name) }}
                                ></span>
                                <span className="text-slate-600 truncate font-semibold" title={r.name}>{r.name}</span>
                              </div>
                              <span className="font-mono text-slate-500 text-[9.5px] ml-1">{r.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400 italic">
                        Nenhuma entrada registrada no período.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. GRÁFICO MISTO: ENTRADAS VS SAÍDAS */}
                {(overviewChartTab === "todos" || overviewChartTab === "misto") && (
                  <div className={`p-3 rounded-xl border border-slate-100 ${overviewChartTab === "todos" ? "bg-slate-50/60" : "bg-white"}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        3. Misto: Entradas x Saídas
                      </span>
                      <span className={`font-mono text-xs font-bold ${totals.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        Saldo: R$ {totals.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {(totals.entrada > 0 || totals.saida > 0) ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-24 h-24 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-95">
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            {donutRingMisto.map((ring, idx) => (
                              <path
                                key={idx}
                                d={ring.path}
                                fill="none"
                                stroke={ring.color || (ring.name === "Receitas" ? "#10b981" : "#f43f5e")}
                                strokeWidth="8.5"
                                strokeLinecap="round"
                                className="transition duration-300 hover:stroke-[10] cursor-pointer"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center px-1">
                            <span className="text-[7.5px] font-bold uppercase text-slate-400 leading-none">Saldo Líquido</span>
                            <span className={`text-[10px] font-extrabold font-mono mt-0.5 ${totals.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {totals.saldo >= 0 ? "+" : ""}R$ {totals.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between items-center text-[10.5px]">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                              <span className="text-slate-600 font-semibold">Entradas</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-600 text-[10px]">
                              {((totals.entrada / (totals.entrada + totals.saida || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10.5px]">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-rose-500 flex-shrink-0"></span>
                              <span className="text-slate-600 font-semibold">Saídas</span>
                            </div>
                            <span className="font-mono font-bold text-rose-600 text-[10px]">
                              {((totals.saida / (totals.entrada + totals.saida || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Movimentado:</span>
                            <span className="font-mono text-slate-700 font-bold">
                              R$ {(totals.entrada + totals.saida).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400 italic">
                        Nenhuma movimentação no período para gerar gráfico misto.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Smart mini financial health box & AI trigger */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Info size={13} className="text-slate-450" />
                  Saúde Mensal:
                </span>
                
                {healthRate === "excelente" && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">Excelente</span>
                )}
                {healthRate === "bom" && (
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full uppercase">Muito Bom</span>
                )}
                {healthRate === "atencao" && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Atenção</span>
                )}
                {healthRate === "alerta" && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase">Gastos Altos</span>
                )}
                {healthRate === "neutro" && (
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full uppercase">Sem Dados</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                {healthRate === "excelente" && "Seu fluxo de caixa está soberbo! Suas receitas cobrem com ampla folga suas despesas ordinárias."}
                {healthRate === "bom" && "Você está em terreno seguro. Suas despesas estão em sintonia razoável com o faturamento."}
                {healthRate === "atencao" && "Alerta de equilíbrio. Suas saídas estão competindo de perto com suas entradas."}
                {healthRate === "alerta" && "Aviso vermelho. Reconsidere despesas imediatas ou gere caixa para equilibrar as contas."}
                {healthRate === "neutro" && "Insira algumas transações para obter a pontuação de saúde atual do caixa."}
              </p>

              {/* Secure Server-Side Gemini trigger */}
              <button
                onClick={handleGenerateAIInsights}
                className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-150 shadow-sm cursor-pointer"
              >
                <Sparkles size={13} className="animate-pulse" />
                <span>Gerar Análise com I.A.</span>
              </button>
            </div>

          </div>

        </div>

        {/* Ledger & Recurring templates section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8 overflow-hidden">
          
          {/* Header toolbar for table with Tabs */}
          <div className="mb-6 space-y-4">
            
            {/* Layer 1: Top Bar with Title and Global Quick Report Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100/60">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    Controlador Financeiro
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Lançamentos, recorrências e módulos de <span className="text-slate-600 font-semibold">{activeCaixa.name}</span>
                  </p>
                </div>
              </div>

              {/* Global Report Actions - Always fixed & predictable on top right */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsExecutiveReportOpen(true)}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow"
                  title="Gerar e imprimir relatório executivo consolidado"
                >
                  <Printer size={13} />
                  <span>Relatório Executivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAccountantReportOpen(true)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow"
                  title="Gerar dossiê contábil e organizador para contador"
                >
                  <FileSpreadsheet size={13} />
                  <span>Dossiê Contábil / IR</span>
                </button>
              </div>
            </div>

            {/* Layer 2: Dedicated Navigation Tabs (Segmented Control style, responsive & clean) */}
            <div className="overflow-x-auto pb-1.5 scrollbar-none">
              <div className="inline-flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 min-w-max">
                <button
                  type="button"
                  onClick={() => setSubTab("extrato")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "extrato"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>📋</span>
                  <span>Extrato de Lançamentos</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    subTab === "extrato" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {filteredTransactions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("fixas")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "fixas"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>🔄</span>
                  <span>Contas e Rendas Fixas</span>
                  {fixedTemplates.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      subTab === "fixas" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {fixedTemplates.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("cartoes")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "cartoes"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>💳</span>
                  <span>Cartões & Faturas</span>
                  {creditCards.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      subTab === "cartoes" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {creditCards.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("alugueis")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "alugueis"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>🏢</span>
                  <span>Contratos de Aluguel (LF)</span>
                  {rentals.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      subTab === "alugueis" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {rentals.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("relatorio")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "relatorio"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>📊</span>
                  <span>Relatório da Imobiliária</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("categorias")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "categorias"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>🏷️</span>
                  <span>Categorias</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab("logs")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer flex items-center gap-2 ${
                    subTab === "logs"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>📖</span>
                  <span>Prontuário & Logs</span>
                </button>
              </div>
            </div>

            {/* Layer 3: Contextual Action Toolbar (dedicated space for the current active tab) */}
            {subTab === "extrato" && (
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar descrição ou categoria no extrato..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl pl-9 pr-8 py-2 text-xs outline-none focus:bg-white transition"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter Payment Method */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={filterPaymentMethod}
                      onChange={e => setFilterPaymentMethod(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white transition cursor-pointer"
                      title="Filtrar lançamentos por forma de pagamento"
                    >
                      <option value="todos">Todos os Pagamentos</option>
                      <option value="dinheiro">💵 Dinheiro em Espécie</option>
                      <option value="pix">⚡ PIX</option>
                      <option value="cartao_credito">💳 Cartão de Crédito</option>
                      <option value="cartao_debito">💳 Cartão de Débito</option>
                      <option value="boleto">📄 Boleto</option>
                      <option value="outros">🔄 Outros</option>
                    </select>
                  </div>
                </div>

                {/* CSV Downloader */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={exportToCSV}
                    disabled={filteredTransactions.length === 0}
                    className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-indigo-100"
                    title="Exportar dados atuais para planilha Excel (CSV)"
                  >
                    <Download size={13} />
                    <span>Exportar Planilha</span>
                  </button>
                </div>
              </div>
            )}

            {subTab === "alugueis" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRentalIdForReport(null);
                      setIsRentalReportOpen(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Imprimir relatório detalhado de cobrança de aluguéis"
                  >
                    <Printer size={13} />
                    <span>Relatório de Cobrança (PDF)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewRentForm(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow"
                    title="Adicionar novo contrato de aluguel"
                  >
                    <Plus size={14} />
                    <span>Cadastrar Novo Contrato</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {subTab === "extrato" ? (
            /* Core Table view - matches user screen */
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider select-none">
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Descrição / Detalhes</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4 text-right">Entrada (+)</th>
                    <th className="px-5 py-4 text-right">Saída (-)</th>
                    <th className="px-5 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((t) => {
                      const isEditing = t.id === editingTransactionId;
                      return (
                        <tr 
                          key={t.id} 
                          className={`hover:bg-slate-50/70 transition ${
                            isEditing ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {/* Transaction Date Column */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-28"
                              />
                            ) : (
                              <div>
                                <span className="font-mono text-slate-500 font-medium">
                                  {formatDateBRL(t.date)}
                                </span>
                                {t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment && t.purchaseDate && t.purchaseDate !== t.date && (
                                  <div className="text-[10px] text-purple-600 font-medium" title={`Compra efetuada em ${formatDateBRL(t.purchaseDate)} (Vencimento da Fatura em ${formatDateBRL(t.date)})`}>
                                    Compra: {formatDateBRL(t.purchaseDate)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Transaction Description Column */}
                          <td className="px-5 py-3.5">
                            {isEditing ? (
                              <div className="space-y-1.5 max-w-xs">
                                <input
                                  type="text"
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                />
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={editPaymentMethod}
                                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                                    className="text-[11px] bg-white border border-slate-300 rounded px-2 py-0.5 outline-none font-semibold text-slate-700"
                                  >
                                    <option value="dinheiro">💵 Dinheiro</option>
                                    <option value="pix">⚡ PIX</option>
                                    <option value="cartao_credito">💳 Cartão de Crédito</option>
                                    <option value="cartao_debito">💳 Cartão de Débito</option>
                                    <option value="boleto">📄 Boleto</option>
                                    <option value="outros">🔄 Outros</option>
                                  </select>

                                  {editPaymentMethod === "cartao_credito" && activeCards.length > 0 && (
                                    <select
                                      value={editCardId}
                                      onChange={(e) => setEditCardId(e.target.value)}
                                      className="text-[11px] bg-white border border-slate-300 rounded px-2 py-0.5 outline-none font-semibold text-slate-700"
                                    >
                                      <option value="">Sem cartão</option>
                                      {activeCards.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-700 leading-snug">
                                  {t.description}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {t.paymentMethod && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                      t.paymentMethod === "pix"
                                        ? "bg-teal-50 text-teal-700 border-teal-200"
                                        : t.paymentMethod === "cartao_credito"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : t.paymentMethod === "cartao_debito"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : t.paymentMethod === "boleto"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                      {t.paymentMethod === "pix" && "⚡ PIX"}
                                      {t.paymentMethod === "dinheiro" && "💵 Dinheiro"}
                                      {t.paymentMethod === "cartao_credito" && (
                                        <>
                                          💳 Cartão
                                          {t.cardId && creditCards.find(c => c.id === t.cardId) && (
                                            <span className="font-normal opacity-90">({creditCards.find(c => c.id === t.cardId)?.name})</span>
                                          )}
                                          {t.invoicePeriod && (
                                            <span className="ml-1 text-[9px] font-mono font-semibold bg-purple-100/90 text-purple-800 px-1.5 py-0.2 rounded border border-purple-200">
                                              Fatura {t.invoicePeriod.split('-')[1]}/{t.invoicePeriod.split('-')[0]}
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {t.paymentMethod === "cartao_debito" && "💳 Débito"}
                                      {t.paymentMethod === "boleto" && "📄 Boleto"}
                                      {t.paymentMethod === "outros" && "🔄 Outros"}
                                    </span>
                                  )}
                                  {t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment && (
                                    t.invoicePaid ? (
                                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                        ✓ Fatura Quitada
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                        ⏳ Fatura Aberta
                                      </span>
                                    )
                                  )}
                                  {t.isCardInvoicePayment && (
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                      📑 Baixa de Fatura ({t.invoicePeriod ? `${t.invoicePeriod.split('-')[1]}/${t.invoicePeriod.split('-')[0]}` : ''})
                                    </span>
                                  )}
                                  {t.installments && (
                                    <span className="text-[10px] font-bold font-mono text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                      Parcela {t.installments.current}/{t.installments.total}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Transaction Category Badge Column */}
                          <td className="px-5 py-3.5">
                            {isEditing ? (
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                              >
                                {categories.filter(c => c.type === editType).map(cat => (
                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-3xs"
                                style={getCategoryBadgeInlineStyle(t.category, t.type)}
                              >
                                <span 
                                  className="h-1.5 w-1.5 rounded-full shrink-0 border border-black/10 shadow-3xs"
                                  style={{ backgroundColor: getCategoryColorHex(t.category) }}
                                />
                                <span>{t.category}</span>
                              </span>
                            )}
                          </td>

                          {/* Transaction Inflows Column */}
                          <td className="px-5 py-3.5 text-right font-semibold">
                            {isEditing && editType === "entrada" ? (
                              <input
                                type="text"
                                value={editAmountStr}
                                onChange={(e) => setEditAmountStr(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-20 text-right"
                              />
                            ) : (
                              t.type === "entrada" ? (
                                <span className="text-emerald-600 font-mono text-sm">
                                  + R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono text-sm">-</span>
                              )
                            )}
                          </td>

                          {/* Transaction Outflows Column */}
                          <td className="px-5 py-3.5 text-right font-semibold">
                            {isEditing && editType === "saida" ? (
                              <input
                                type="text"
                                value={editAmountStr}
                                onChange={(e) => setEditAmountStr(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-20 text-right"
                              />
                            ) : (
                              t.type === "saida" ? (
                                t.paymentMethod === "cartao_credito" && !t.isCardInvoicePayment ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-purple-600 font-mono text-sm font-semibold">
                                      - R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-purple-500 font-sans font-medium">
                                      (fatura cartão)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-rose-600 font-mono text-sm">
                                    - R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-300 font-mono text-sm">-</span>
                              )
                            )}
                          </td>

                          {/* Transaction Actions Column */}
                          <td className="px-5 py-3.5 text-center">
                            {isEditing ? (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                                  title="Confirmar alteração"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingTransactionId(null)}
                                  className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                                  title="Cancelar edição"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-center opacity-70 hover:opacity-100 transition">
                                <button
                                  onClick={() => startEditTransaction(t)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Editar lançamento"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(t.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="Deletar lançamento"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                        <div className="max-w-xs mx-auto flex flex-col items-center">
                          <span className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3 select-none">
                            <HelpCircle size={22} className="stroke-1" />
                          </span>
                          <span>Nenhuma transação nesta aba para o período selecionado.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                </tbody>
              </table>
            </div>
          ) : subTab === "fixas" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Form to create fixed templates manually */}
              <div className="lg:col-span-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                      <Repeat size={15} />
                    </span>
                    <h3 className="font-bold text-sm text-slate-800">Novo Lançamento Fixo</h3>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-4 text-xs font-medium">
                    {/* Switch Entry Type */}
                    <div>
                      <label className="text-slate-400 block mb-1">Tipo de Lançamento</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setTplType("entrada");
                            setTplCategory(getDefaultCategoryForType("entrada"));
                          }}
                          className={`py-1.5 text-center font-bold rounded-lg cursor-pointer ${
                            tplType === "entrada"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          🟢 Renda Fixa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTplType("saida");
                            setTplCategory(getDefaultCategoryForType("saida"));
                          }}
                          className={`py-1.5 text-center font-bold rounded-lg cursor-pointer ${
                            tplType === "saida"
                              ? "bg-rose-600 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          🔴 Despesa Fixa
                        </button>
                      </div>
                    </div>

                    {/* Template description */}
                    <div>
                      <label className="text-slate-400 block mb-1">Descrição</label>
                      <input
                        type="text"
                        placeholder="Ex: Aluguel Office, Luz, Combustível"
                        value={tplDescription}
                        onChange={(e) => setTplDescription(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2.5 text-slate-800 outline-none transition"
                        maxLength={40}
                      />
                    </div>

                    {/* Template Amount and Due Day Side by Side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 block mb-1">Valor Fixo (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={tplAmountStr}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9,.]/g, "");
                            setTplAmountStr(clean);
                          }}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2.5 text-slate-800 font-semibold outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1">Dia do Vencimento</label>
                        <select
                          value={tplDueDay}
                          onChange={(e) => setTplDueDay(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2.5 text-slate-800 outline-none transition cursor-pointer"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Dia {day}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Template Category selection selector */}
                    <div>
                      <label className="text-slate-400 block mb-1">Categoria</label>
                      <select
                        value={tplCategory}
                        onChange={(e) => setTplCategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2.5 text-slate-800 outline-none transition cursor-pointer"
                      >
                        {categories.filter(c => c.type === tplType).map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddFixedTemplate}
                  className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition duration-150 active:scale-95 cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  Cadastrar Recorrência
                </button>
              </div>

              {/* Bento Grid Lists displays of templates categorized into Inward & Outward */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[480px] overflow-y-auto pr-1">
                
                {/* RENDAS FIXAS COLUMN */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-indigo-50 pb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                      Rendas Fixas
                    </h3>
                  </div>

                  {fixedTemplates.filter(t => t.type === "entrada" && (!t.caixaId || t.caixaId === activeCaixaId)).length > 0 ? (
                    fixedTemplates
                      .filter(t => t.type === "entrada" && (!t.caixaId || t.caixaId === activeCaixaId))
                      .map(tpl => (
                        <div key={tpl.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl hover:border-emerald-200 hover:shadow-sm transition flex items-center justify-between gap-3 relative group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                                <Clock size={10} />
                                Todo Dia {tpl.dueDay}
                              </span>
                              {(() => {
                                const targetYear = filterYear !== "todos" ? filterYear : String(new Date().getFullYear());
                                const targetMonth = filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0");
                                const isPosted = transactions.some(t => 
                                  t.caixaId === activeCaixaId && 
                                  t.type === "entrada" && 
                                  t.description.toLowerCase().includes(tpl.description.toLowerCase()) && 
                                  t.date.startsWith(`${targetYear}-${targetMonth}`)
                                );
                                return isPosted ? (
                                  <button
                                    type="button"
                                    onClick={() => openLaunchFixedModal(tpl)}
                                    className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                                    title="Clique para editar ou sincronizar o valor já lançado neste mês"
                                  >
                                    <span>✓ Lançado no mês</span>
                                    <span className="underline font-normal text-[8px]">(ajustar)</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    Pendente
                                  </span>
                                );
                              })()}
                            </div>
                            <h4 className="font-bold text-slate-800 text-xs truncate leading-tight mb-1" title={tpl.description}>
                              {tpl.description}
                            </h4>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">{tpl.category}</span>
                          </div>

                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-emerald-600 font-mono font-bold text-xs sm:text-sm">
                              R$ {tpl.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openLaunchFixedModal(tpl)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                title="Inserir ou atualizar lançamento no fluxo do mês"
                              >
                                ⚡ Lançar
                              </button>
                              <button
                                onClick={() => openEditFixedModal(tpl)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Editar dados cadastrais deste fixo (descrição, valor base, dia, categoria)"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteFixedTemplate(tpl.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Apagar recorrência"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="py-12 border border-dashed border-slate-250 rounded-2xl flex flex-col items-center justify-center text-center text-slate-400">
                      <HelpCircle size={20} className="stroke-1 text-slate-300 mb-1.5" />
                      <span className="text-[11px] font-light max-w-2xs leading-normal">Nenhuma Renda Fixa cadastrada para este caixa ainda. Use o painel ao lado para registrar.</span>
                    </div>
                  )}
                </div>

                {/* DESPESAS FIXAS COLUMN */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-indigo-50 pb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                    <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                      Despesas Fixas
                    </h3>
                  </div>

                  {fixedTemplates.filter(t => t.type === "saida" && (!t.caixaId || t.caixaId === activeCaixaId)).length > 0 ? (
                    fixedTemplates
                      .filter(t => t.type === "saida" && (!t.caixaId || t.caixaId === activeCaixaId))
                      .map(tpl => (
                        <div key={tpl.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl hover:border-rose-200 hover:shadow-sm transition flex items-center justify-between gap-3 relative group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                                <Clock size={10} />
                                Vence Dia {tpl.dueDay}
                              </span>
                              {(() => {
                                const targetYear = filterYear !== "todos" ? filterYear : String(new Date().getFullYear());
                                const targetMonth = filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0");
                                const isPosted = transactions.some(t => 
                                  t.caixaId === activeCaixaId && 
                                  t.type === "saida" && 
                                  t.description.toLowerCase().includes(tpl.description.toLowerCase()) && 
                                  t.date.startsWith(`${targetYear}-${targetMonth}`)
                                );
                                return isPosted ? (
                                  <button
                                    type="button"
                                    onClick={() => openLaunchFixedModal(tpl)}
                                    className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                                    title="Clique para editar ou sincronizar o valor já lançado neste mês"
                                  >
                                    <span>✓ Lançado no mês</span>
                                    <span className="underline font-normal text-[8px]">(ajustar)</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    Pendente
                                  </span>
                                );
                              })()}
                            </div>
                            <h4 className="font-bold text-slate-800 text-xs truncate leading-tight mb-1" title={tpl.description}>
                              {tpl.description}
                            </h4>
                            <span className="text-[10px] text-slate-550 uppercase font-bold">{tpl.category}</span>
                          </div>

                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-rose-600 font-mono font-bold text-xs sm:text-sm">
                              R$ {tpl.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openLaunchFixedModal(tpl)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                title="Registrar ou ajustar lançamento no extrato do mês (com ajuste de centavos)"
                              >
                                ⚡ Lançar
                              </button>
                              <button
                                onClick={() => openEditFixedModal(tpl)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Editar dados cadastrais deste fixo (descrição, valor base, dia, categoria)"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteFixedTemplate(tpl.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Apagar recorrência"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="py-12 border border-dashed border-slate-250 rounded-2xl flex flex-col items-center justify-center text-center text-slate-400">
                      <HelpCircle size={20} className="stroke-1 text-slate-300 mb-1.5" />
                      <span className="text-[11px] font-light max-w-2xs leading-normal">Nenhuma Despesa Fixa cadastrada para este caixa ainda. Use o painel ao lado para registrar.</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : subTab === "cartoes" ? (
            <CreditCardsManager
              creditCards={creditCards}
              onSaveCard={handleSaveCreditCard}
              onDeleteCard={handleDeleteCreditCard}
              transactions={transactions}
              activeCaixaId={activeCaixaId}
              filterMonth={filterMonth}
              filterYear={filterYear}
              monthsList={monthsList}
              onPostInvoiceToLedger={handlePostCardInvoiceToLedger}
            />
          ) : subTab === "alugueis" ? (
            /* SubTab "alugueis": Rental Properties (LF) Panel */
            <div className="flex flex-col gap-6 w-full">
              
              {/* Metric cards for Rental tab specifically */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Imóveis Ativos</span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId).length}
                  </span>
                  <span className="text-[10px] text-indigo-600 mt-0.5">Sob gestão do caixa</span>
                </div>
                <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-450 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Quitações de {formatPeriodBRL(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`).split(" de ")[0]}
                  </span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {rentals.filter(r => (!r.caixaId || r.caixaId === activeCaixaId) && r.paidPeriods.includes(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)).length} de {rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId).length}
                  </span>
                  <span className="text-[10px] text-emerald-600 mt-0.5 font-semibold">
                    R$ {rentals
                          .filter(r => (!r.caixaId || r.caixaId === activeCaixaId) && r.paidPeriods.includes(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`))
                          .reduce((sum, r) => sum + getRentalExpectedAmount(r), 0)
                          .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pagos
                  </span>
                </div>
                <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-455 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Pendentes
                  </span>
                  <span className="text-xl font-extrabold text-amber-700">
                    {rentals.filter(r => (!r.caixaId || r.caixaId === activeCaixaId) && !r.paidPeriods.includes(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)).length} contratos
                  </span>
                  <span className="text-[10px] text-amber-600 font-bold mt-0.5">
                    R$ {rentals
                          .filter(r => (!r.caixaId || r.caixaId === activeCaixaId) && !r.paidPeriods.includes(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`))
                          .reduce((sum, r) => sum + getRentalExpectedAmount(r), 0)
                          .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em aberto
                  </span>
                </div>
                <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-450 font-semibold text-slate-800">Totalizável Líquido</span>
                  <span className="text-lg font-mono font-bold text-indigo-700">
                    R$ {rentals
                          .filter(r => !r.caixaId || r.caixaId === activeCaixaId)
                          .reduce((sum, r) => sum + getRentalExpectedAmount(r), 0)
                          .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-indigo-500 mt-0.5">Mês: {formatPeriodBRL(filterYear !== "todos" && filterMonth !== "todos" ? `${filterYear}-${filterMonth}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)}</span>
                </div>
              </div>

              {/* Cauções Central strip summary if active */}
              {(() => {
                const activeRentals = rentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId);
                const rentalsWithDeposit = activeRentals.filter(r => r.hasDeposit);
                if (rentalsWithDeposit.length === 0) return null;

                const totalInitialDeposit = rentalsWithDeposit.reduce((sum, r) => sum + (r.depositAmount || 0), 0);
                
                // Calculate today's value for each deposit compiled (poupança compound index)
                const todayStr = getLocalDateInputValue();
                const totalAdjustedDeposit = rentalsWithDeposit.reduce((sum, r) => {
                  const months = calculateMonthsDifference(r.depositStartDate || todayStr, todayStr);
                  const rateDecimal = (r.depositInterestRate || 0.5) / 100;
                  const compoundFactor = Math.pow(1 + rateDecimal, months);
                  return sum + ((r.depositAmount || 0) * compoundFactor);
                }, 0);

                return (
                  <div className="bg-amber-50/40 border border-amber-200/60 rounded-3xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-850 font-extrabold text-xs">
                        <Lock size={13} className="text-amber-600" />
                        <span>Central de Garantias por Caução (Simulador)</span>
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-850 text-[8px] font-extrabold rounded-md">VALOR ESTIMADO</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Há <strong>{rentalsWithDeposit.length} contratos</strong> com caução ativa. Os rendimentos mostrados são estimativas de planejamento simulando reajustes mensais compostos sob regras de data-base da poupança.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-4 font-mono text-xs">
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-150 shadow-2xs">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Custódia Original</span>
                        <span className="font-bold text-slate-700">R$ {totalInitialDeposit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-slate-50 shadow-sm relative overflow-hidden">
                        <span className="text-[9px] uppercase font-bold text-amber-400 block font-sans">Est. Corrigido Hoje (Aprox.)</span>
                        <span className="font-extrabold text-emerald-400">R$ {totalAdjustedDeposit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Split tables: Separating Received Rentals section below the pending ones */}
              {(() => {
                const activePeriodStr = filterYear !== "todos" && filterMonth !== "todos" 
                  ? `${filterYear}-${filterMonth}` 
                  : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

                // Filter by active caixa ID if needed
                const activeRentals = sortedRentals.filter(r => !r.caixaId || r.caixaId === activeCaixaId);
                const pendingRentals = activeRentals.filter(r => !r.paidPeriods.includes(activePeriodStr));
                const receivedRentals = activeRentals.filter(r => r.paidPeriods.includes(activePeriodStr));

                return (
                  <div className="space-y-8 w-full">
                    {/* SECTION 1: PENDING RENTALS */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/50 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-tight">
                            Contratos Pendentes / Em Aberto ({pendingRentals.length})
                          </h3>
                        </div>
                        <span className="text-[10px] bg-amber-150 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                          Mês de Competência: {formatPeriodBRL(activePeriodStr)}
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
                        <table className="min-w-full text-left border-collapse text-xs select-none">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                              <th 
                                className="p-3 text-center whitespace-nowrap w-16 cursor-pointer hover:bg-slate-100/90 hover:text-slate-700 transition duration-150"
                                onClick={() => handleRequestSort("lfCode")}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <span>LF</span>
                                  {renderSortIcon("lfCode")}
                                </div>
                              </th>
                              <th 
                                className="p-3 whitespace-nowrap min-w-[200px] cursor-pointer hover:bg-slate-100/90 hover:text-slate-700 transition duration-150"
                                onClick={() => handleRequestSort("tenantName")}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>Inquilino / Endereço</span>
                                  {renderSortIcon("tenantName")}
                                </div>
                              </th>
                              <th 
                                className="p-3 text-center whitespace-nowrap w-14 cursor-pointer hover:bg-slate-100/90 hover:text-slate-700 transition duration-150"
                                onClick={() => handleRequestSort("dueDay")}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <span>Venc.</span>
                                  {renderSortIcon("dueDay")}
                                </div>
                              </th>
                              <th 
                                className="p-3 text-right whitespace-nowrap bg-indigo-50/25 text-indigo-700 w-24 cursor-pointer hover:bg-indigo-100/30 hover:text-indigo-900 transition duration-150"
                                onClick={() => handleRequestSort("rentAmount")}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>Aluguel</span>
                                  {renderSortIcon("rentAmount")}
                                </div>
                              </th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Água</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">IPTU</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Lixo</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Luz</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Multa</th>
                              <th className="p-3 text-right whitespace-nowrap w-28 bg-indigo-50/20 text-indigo-900 font-bold">Ajustes (+/-)</th>
                              <th className="p-3 text-right whitespace-nowrap text-rose-550 w-24 bg-rose-50/25 font-bold">Tx Admin</th>
                              <th className="p-3 text-right whitespace-nowrap text-slate-700 bg-slate-50/30 w-24 font-bold">Total Somado</th>
                              <th 
                                className="p-3 text-right whitespace-nowrap text-indigo-900 bg-indigo-50/40 w-28 font-extrabold cursor-pointer hover:bg-indigo-100/40 transition duration-150"
                                onClick={() => handleRequestSort("totalReceivable")}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>Recebível Líquido</span>
                                  {renderSortIcon("totalReceivable")}
                                </div>
                              </th>
                              <th className="p-3 text-center whitespace-nowrap w-36">Conciliar Caixa</th>
                              <th className="p-3 text-center whitespace-nowrap w-12 font-bold">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 animate-fadeIn">
                            {pendingRentals.length > 0 ? (
                              pendingRentals.map(rental => {
                                const totalSummed = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount;
                                const totalPropertyReceivable = getRentalExpectedAmount(rental, activePeriodStr);
                                const pendingCarryover = getPendingRentalCarryover(rental, activePeriodStr);

                                return (
                                  <tr key={rental.id} className="hover:bg-slate-50/65 transition-colors duration-155 bg-white">
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase inline-block bg-indigo-150 text-indigo-805">
                                        {rental.lfCode}
                                      </span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 leading-snug">{rental.tenantName}</span>
                                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate flex items-center gap-1" title={rental.address}>
                                          <MapPin size={10} className="flex-shrink-0 text-slate-350" />
                                          <span>{rental.address}</span>
                                        </div>
                                        
                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                          {rental.guaranteeType === "fiador" || (!rental.hasDeposit && rental.guarantorName) ? (
                                            <span
                                              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-amber-200"
                                              title={`Fiador: ${rental.guarantorName || "Cadastrado"}${rental.guarantorPhone ? ` | Tel: ${rental.guarantorPhone}` : ""}${rental.guarantorCpf ? ` | CPF: ${rental.guarantorCpf}` : ""}`}
                                            >
                                              <ShieldCheck size={9} className="text-amber-600" />
                                              <span>Fiador: {rental.guarantorName || "Cadastrado"}</span>
                                            </span>
                                          ) : rental.hasDeposit ? (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedDepositRental(rental)}
                                              className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer select-none active:scale-95"
                                              title="Clique para ver extrato e reajuste da Caução em tempo real"
                                            >
                                              <Lock size={9} className="text-emerald-600" />
                                              <span>Caução: R$ {rental.depositAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                              <span className="opacity-60 font-medium">| ver</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => startEditingRental(rental)}
                                              className="inline-flex items-center gap-0.5 bg-slate-50 hover:bg-indigo-50/70 hover:text-indigo-700 text-slate-450 font-bold text-[8.5px] px-1.5 py-0.5 rounded-md border border-slate-200 hover:border-indigo-200 transition cursor-pointer select-none active:scale-95"
                                              title="Clique para definir garantia deste contrato"
                                            >
                                              <ShieldCheck size={8} className="opacity-50" />
                                              <span>Definir Garantia</span>
                                            </button>
                                          )}

                                          {(() => {
                                            const applicableAdjs = getRentalApplicableAdjustments(rental, activePeriodStr);
                                            if (applicableAdjs.length === 0) return null;
                                            const net = getRentalAdjustmentsNetTotal(rental, activePeriodStr);
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => setManagingAdjustmentsRental(rental)}
                                                className={`inline-flex items-center gap-1 font-bold text-[9px] px-1.5 py-0.5 rounded-md border cursor-pointer select-none transition hover:opacity-85 ${
                                                  net < 0
                                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                }`}
                                                title={`Clique para gerenciar ajustes: ${applicableAdjs.length} ajuste(s) ativo(s)`}
                                              >
                                                <span>{net < 0 ? "➖" : "➕"}</span>
                                                <span>{net < 0 ? "-" : "+"} R$ {Math.abs(net).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                                <span className="opacity-70 font-normal">({applicableAdjs.length > 1 ? `${applicableAdjs.length} ajustes` : applicableAdjs[0].description})</span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                        {pendingCarryover > 0 && (
                                          <div className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-900">
                                            <AlertTriangle size={10} />
                                            <span>Diferença anterior a cobrar: R$ {pendingCarryover.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap font-medium text-slate-600">
                                      Dia {rental.dueDay}
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium text-slate-800 bg-indigo-50/5">
                                      R$ {rental.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.waterAmount > 0 ? `R$ ${rental.waterAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.iptuAmount > 0 ? `R$ ${rental.iptuAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.garbageAmount > 0 ? `R$ ${rental.garbageAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.lightAmount > 0 ? `R$ ${rental.lightAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.fineAmount > 0 ? `R$ ${rental.fineAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {(() => {
                                        const applicableAdjs = getRentalApplicableAdjustments(rental, activePeriodStr);
                                        const netAdj = getRentalAdjustmentsNetTotal(rental, activePeriodStr);
                                        if (applicableAdjs.length > 0) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => setManagingAdjustmentsRental(rental)}
                                              className={`group inline-flex flex-col items-end px-2 py-1 rounded-lg border text-right transition cursor-pointer select-none shadow-2xs ${
                                                netAdj >= 0
                                                  ? "bg-emerald-50 border-emerald-250 text-emerald-800 hover:bg-emerald-100"
                                                  : "bg-rose-50 border-rose-250 text-rose-800 hover:bg-rose-100"
                                              }`}
                                              title="Clique para gerenciar ajustes de valor (adicionar, subtrair, fixo ou pontual)"
                                            >
                                              <span className="font-mono font-bold text-[11px] flex items-center gap-1">
                                                {netAdj >= 0 ? `+ R$ ${netAdj.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `- R$ ${Math.abs(netAdj).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                <span className="text-[9px] px-1 rounded-full bg-white font-bold border border-slate-200">
                                                  {applicableAdjs.length}
                                                </span>
                                              </span>
                                              <span className="text-[8.5px] opacity-75 font-medium group-hover:underline">
                                                {applicableAdjs.some(a => a.recurrence === "pontual") ? "pontual" : "fixo"} • gerenciar
                                              </span>
                                            </button>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => setManagingAdjustmentsRental(rental)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 font-bold text-[10px] transition cursor-pointer select-none"
                                            title="Clique para adicionar ajuste de valor (acréscimo ou abatimento pontual ou fixo)"
                                          >
                                            <SlidersHorizontal size={11} className="text-slate-400" />
                                            <span>+ Ajuste</span>
                                          </button>
                                        );
                                      })()}
                                    </td>
                                    <td className="p-3 text-right text-rose-600 bg-rose-50/10">
                                      <div className="flex flex-col items-end gap-1 select-none">
                                        <div className="flex items-center gap-1 bg-white border border-rose-200 focus-within:border-rose-400 rounded-lg pl-1.5 pr-1 py-0.5 max-w-[65px] shadow-2xs">
                                          <input
                                            type="text"
                                            value={rental.adminFeePercent !== undefined ? rental.adminFeePercent : Math.round((rental.adminFeeAmount / rental.rentAmount) * 100) || 10}
                                            onChange={(e) => {
                                              const cleanVal = e.target.value.replace(/[^0-9,.]/g, "").replace(",", ".");
                                              const parsed = parseFloat(cleanVal);
                                              if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                                                handleUpdateAdminFeePercent(rental.id, parsed);
                                              } else if (cleanVal === "") {
                                                handleUpdateAdminFeePercent(rental.id, 0);
                                              }
                                            }}
                                            className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-rose-700 text-right p-0 focus:ring-0"
                                            title="Ajustar % da Taxa Administrativa"
                                          />
                                          <span className="text-[10px] font-bold text-rose-500">%</span>
                                        </div>
                                        <span className="text-[9px] text-slate-405 font-mono">
                                          - R$ {rental.adminFeeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-700 bg-slate-50/10">
                                      R$ {totalSummed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono font-extrabold text-indigo-700 bg-indigo-50/15">
                                      R$ {totalPropertyReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRentalPaid(rental)}
                                        className="px-3 py-1.5 rounded-xl font-bold text-[10px] transition duration-150 flex items-center gap-1.5 mx-auto cursor-pointer select-none border shadow-xs bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-750 hover:border-emerald-250 animate-pulse-subtle"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={false}
                                          onChange={() => {}} 
                                          className="h-3 w-3 rounded pointer-events-none text-slate-400"
                                        />
                                        <span>Já Recebido</span>
                                      </button>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        {/* Edit action */}
                                        <button
                                          type="button"
                                          onClick={() => startEditingRental(rental)}
                                          className="p-1.5 text-slate-400 hover:text-amber-650 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                          title="Editar dados cadastrais, encargos ou caução"
                                        >
                                          <Edit2 size={13} />
                                        </button>

                                        {/* Individual Report/Receipt PDF button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedRentalIdForReport(rental.id);
                                            setIsRentalReportOpen(true);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                          title="Imprimir Recibo / Demonstrativo Individual de Locação"
                                        >
                                          <Printer size={13} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRentalProperty(rental.id)}
                                          className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                          title="Apagar contrato do imóvel"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={15} className="p-12 text-center text-slate-400">
                                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                    <span className="text-xl mb-1">🎉</span>
                                    <span className="text-xs font-semibold text-emerald-800">Tudo Recebido!</span>
                                    <span className="text-[10px] text-slate-450 font-light mt-0.5 leading-snug">Não há aluguéis com pagamentos pendentes no período de competência selecionado.</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SECTION 2: RECEIVED AND CONCILIATED RENTALS */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-250/50 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
                          <h3 className="font-extrabold text-emerald-950 text-xs sm:text-sm uppercase tracking-tight">
                            Contratos Recebidos & Quitados ({receivedRentals.length})
                          </h3>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md">
                          Planilha Conciliada
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-emerald-100/70 bg-emerald-50/5 shadow-inner">
                        <table className="min-w-full text-left border-collapse text-xs select-none">
                          <thead>
                            <tr className="bg-emerald-50/20 border-b border-emerald-100/70 text-slate-450 font-bold uppercase text-[10px] tracking-wider">
                              <th className="p-3 text-center whitespace-nowrap w-16">LF</th>
                              <th className="p-3 whitespace-nowrap min-w-[200px]">Inquilino / Endereço</th>
                              <th className="p-3 text-center whitespace-nowrap w-14">Venc.</th>
                              <th className="p-3 text-right whitespace-nowrap bg-emerald-50/15 text-emerald-900 w-24">Aluguel</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Água</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">IPTU</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Lixo</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Luz</th>
                              <th className="p-3 text-right whitespace-nowrap w-20">Multa</th>
                              <th className="p-3 text-right whitespace-nowrap w-28 bg-emerald-50/20 text-emerald-950 font-bold">Ajustes (+/-)</th>
                              <th className="p-3 text-right whitespace-nowrap text-rose-700/80 w-24">Tx Admin</th>
                              <th className="p-3 text-right whitespace-nowrap text-slate-550 w-24">Total Somado</th>
                              <th className="p-3 text-right whitespace-nowrap text-emerald-900 bg-emerald-50/25 w-28 font-extrabold">Recebível Líquido</th>
                              <th className="p-3 text-center whitespace-nowrap w-36">Conciliar Caixa</th>
                              <th className="p-3 text-center whitespace-nowrap w-12 font-bold">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-100/50 text-slate-550 animate-fadeIn">
                            {receivedRentals.length > 0 ? (
                              receivedRentals.map(rental => {
                                const totalSummed = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount;
                                const totalPropertyReceivable = getRentalExpectedAmount(rental, activePeriodStr);
                                const currentAdjustment = rental.paymentAdjustments?.[activePeriodStr];
                                const receivedAmount = rental.paymentAmounts?.[activePeriodStr] ?? totalPropertyReceivable;

                                return (
                                  <tr key={rental.id} className="hover:bg-emerald-50/15 transition-colors duration-155 bg-emerald-50/5">
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase inline-block bg-emerald-100 text-emerald-800">
                                        {rental.lfCode} ✓
                                      </span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 leading-snug line-through decoration-emerald-300/60">{rental.tenantName}</span>
                                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate flex items-center gap-1" title={rental.address}>
                                          <MapPin size={10} className="flex-shrink-0 text-slate-300" />
                                          <span>{rental.address}</span>
                                        </div>
                                        
                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                          {rental.guaranteeType === "fiador" || (!rental.hasDeposit && rental.guarantorName) ? (
                                            <span
                                              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-amber-200"
                                              title={`Fiador: ${rental.guarantorName || "Cadastrado"}${rental.guarantorPhone ? ` | Tel: ${rental.guarantorPhone}` : ""}${rental.guarantorCpf ? ` | CPF: ${rental.guarantorCpf}` : ""}`}
                                            >
                                              <ShieldCheck size={9} className="text-amber-600" />
                                              <span>Fiador: {rental.guarantorName || "Cadastrado"}</span>
                                            </span>
                                          ) : rental.hasDeposit ? (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedDepositRental(rental)}
                                              className="inline-flex items-center gap-1 bg-emerald-100/50 hover:bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer select-none active:scale-95"
                                            >
                                              <Lock size={9} className="text-emerald-600" />
                                              <span>Caução vinculada</span>
                                            </button>
                                          ) : null}

                                          {(() => {
                                            const applicableAdjs = getRentalApplicableAdjustments(rental, activePeriodStr);
                                            if (applicableAdjs.length === 0) return null;
                                            const net = getRentalAdjustmentsNetTotal(rental, activePeriodStr);
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => setManagingAdjustmentsRental(rental)}
                                                className={`inline-flex items-center gap-1 font-bold text-[9px] px-1.5 py-0.5 rounded-md border cursor-pointer select-none transition hover:opacity-85 ${
                                                  net < 0
                                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                }`}
                                                title={`Clique para gerenciar ajustes: ${applicableAdjs.length} ajuste(s) ativo(s)`}
                                              >
                                                <span>{net < 0 ? "➖" : "➕"}</span>
                                                <span>{net < 0 ? "-" : "+"} R$ {Math.abs(net).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                                <span className="opacity-70 font-normal">({applicableAdjs.length > 1 ? `${applicableAdjs.length} ajustes` : applicableAdjs[0].description})</span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                        {/* Exibicao das Partes de Pagamento se houver mais de 1 parte */}
                                        {currentAdjustment?.parts && currentAdjustment.parts.length > 1 && (
                                          <div className="mt-1.5 flex flex-col gap-1 p-1.5 rounded-lg bg-emerald-100/50 border border-emerald-250 text-[9px]">
                                            <span className="font-bold text-emerald-900 uppercase text-[8.5px]">Pagamento Quitado em {currentAdjustment.parts.length} Partes:</span>
                                            <div className="space-y-0.5">
                                              {currentAdjustment.parts.map((p, idx) => (
                                                <div key={p.id || idx} className="flex items-center justify-between gap-1 text-slate-700">
                                                  <span className="font-semibold text-emerald-800">
                                                    {idx + 1}ª: {getRentalPaymentMethodLabel(p.paymentMethod).split(" ")[0]} ({p.date.split("-").reverse().join("/")})
                                                  </span>
                                                  <span className="font-mono font-bold text-slate-900">
                                                    R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {currentAdjustment && Math.abs(currentAdjustment.difference) >= 0.01 && (
                                          <div className={`mt-1.5 rounded-xl border p-2 text-[9px] font-bold ${
                                            currentAdjustment.difference > 0
                                              ? "border-amber-200 bg-amber-50/90 text-amber-900"
                                              : "border-sky-200 bg-sky-50 text-sky-800"
                                          }`}>
                                            <div className="flex items-center justify-between">
                                              <span>
                                                {currentAdjustment.difference > 0
                                                  ? `Saldo devedor: R$ ${currentAdjustment.difference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                                  : `Recebido a mais: R$ ${Math.abs(currentAdjustment.difference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                              </span>
                                              <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full border ${
                                                currentAdjustment.status === "pending" ? "bg-amber-200/80 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-650"
                                              }`}>
                                                {currentAdjustment.status === "pending" ? "Aberto" : "Aliviado"}
                                              </span>
                                            </div>

                                            {currentAdjustment.difference > 0 && currentAdjustment.status === "pending" && (
                                              <div className="mt-2 flex flex-col gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => openPayShortfallModal(rental, activePeriodStr, currentAdjustment.difference)}
                                                  className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                                                  title="Marcar como recebida a 2ª parte para outra data deste mesmo mês"
                                                >
                                                  <span>💵 Quitar 2ª Parte</span>
                                                  <span className="font-mono">(R$ {currentAdjustment.difference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                                                </button>

                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleResolveRentalDifference(rental.id, activePeriodStr, "charged")}
                                                    className="flex-1 rounded-md bg-amber-600 hover:bg-amber-700 px-1.5 py-0.5 text-white text-[9px] font-semibold transition cursor-pointer"
                                                  >
                                                    Cobrar depois
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleResolveRentalDifference(rental.id, activePeriodStr, "forgiven")}
                                                    className="flex-1 rounded-md bg-white hover:bg-slate-50 px-1.5 py-0.5 text-slate-650 border border-slate-200 text-[9px] font-semibold transition cursor-pointer"
                                                  >
                                                    Aliviar saldo
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap font-medium text-slate-500">
                                      Dia {rental.dueDay}
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium text-slate-650 bg-emerald-50/10">
                                      R$ {rental.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.waterAmount > 0 ? `R$ ${rental.waterAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.iptuAmount > 0 ? `R$ ${rental.iptuAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.garbageAmount > 0 ? `R$ ${rental.garbageAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.lightAmount > 0 ? `R$ ${rental.lightAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {rental.fineAmount > 0 ? `R$ ${rental.fineAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {(() => {
                                        const applicableAdjs = getRentalApplicableAdjustments(rental, activePeriodStr);
                                        const netAdj = getRentalAdjustmentsNetTotal(rental, activePeriodStr);
                                        if (applicableAdjs.length > 0) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => setManagingAdjustmentsRental(rental)}
                                              className={`group inline-flex flex-col items-end px-2 py-1 rounded-lg border text-right transition cursor-pointer select-none shadow-2xs ${
                                                netAdj >= 0
                                                  ? "bg-emerald-100/50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                                                  : "bg-rose-100/50 border-rose-300 text-rose-900 hover:bg-rose-100"
                                              }`}
                                              title="Clique para gerenciar ajustes de valor (adicionar, subtrair, fixo ou pontual)"
                                            >
                                              <span className="font-mono font-bold text-[11px] flex items-center gap-1">
                                                {netAdj >= 0 ? `+ R$ ${netAdj.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `- R$ ${Math.abs(netAdj).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                <span className="text-[9px] px-1 rounded-full bg-white font-bold border border-slate-200">
                                                  {applicableAdjs.length}
                                                </span>
                                              </span>
                                              <span className="text-[8.5px] opacity-75 font-medium group-hover:underline">
                                                {applicableAdjs.some(a => a.recurrence === "pontual") ? "pontual" : "fixo"} • gerenciar
                                              </span>
                                            </button>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => setManagingAdjustmentsRental(rental)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-emerald-200 hover:border-emerald-400 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-800 font-bold text-[10px] transition cursor-pointer select-none"
                                            title="Clique para adicionar ajuste de valor (acréscimo ou abatimento pontual ou fixo)"
                                          >
                                            <SlidersHorizontal size={11} className="text-emerald-500" />
                                            <span>+ Ajuste</span>
                                          </button>
                                        );
                                      })()}
                                    </td>
                                    <td className="p-3 text-right text-rose-650/85">
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="font-bold text-[10px]">{rental.adminFeePercent ?? 10}%</span>
                                        <span className="text-[9px] text-slate-400 font-mono">
                                          - R$ {rental.adminFeeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-500 bg-slate-50/5">
                                      R$ {totalSummed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/10">
                                      <div>R$ {totalPropertyReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                      <div className="text-[9px] text-slate-400 font-sans">Recebido: R$ {receivedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRentalPaid(rental)}
                                        className="px-3 py-1.5 rounded-xl font-bold text-[10px] transition duration-155 flex items-center gap-1.5 mx-auto cursor-pointer select-none border border-emerald-250 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-2xs"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={true}
                                          onChange={() => {}} 
                                          className="h-3 w-3 rounded pointer-events-none text-emerald-600"
                                        />
                                        <span>Recebido</span>
                                      </button>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        {/* Edit action */}
                                        <button
                                          type="button"
                                          onClick={() => startEditingRental(rental)}
                                          className="p-1.5 text-slate-400 hover:text-amber-650 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                          title="Editar contrato de aluguel"
                                        >
                                          <Edit2 size={13} />
                                        </button>

                                        {/* Individual Report/Receipt PDF button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedRentalIdForReport(rental.id);
                                            setIsRentalReportOpen(true);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                          title="Imprimir Recibo / Demonstrativo Individual de Locação"
                                        >
                                          <Printer size={13} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRentalProperty(rental.id)}
                                          className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                          title="Apagar contrato do imóvel"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={15} className="p-8 text-center text-slate-400">
                                  <span className="text-[11px] font-sans italic">Nenhum aluguel quitado/recebido no período ativo de {formatPeriodBRL(activePeriodStr)} ainda.</span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* OVERLAY MODAL DIALOG: Register New Property */}
              <AnimatePresence>
                {showNewRentForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowNewRentForm(false)}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                    />
                    
                    {/* Modal Content Card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      transition={{ type: "spring", duration: 0.35 }}
                      className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative z-10 p-6 flex flex-col"
                    >
                      {/* Close Header Button */}
                      <button
                        type="button"
                        onClick={() => setShowNewRentForm(false)}
                        className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                      >
                        <X size={15} />
                      </button>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                          <Building size={15} />
                        </span>
                        <h3 className="font-bold text-sm text-slate-800">Novo Cadastro Aluguel LF</h3>
                      </div>

                      <p className="text-xs text-slate-450 mb-4 leading-normal">
                        Configure as despesas e receitas de contratos fixos de locação imobiliária. O imóvel será vinculado ao subcaixa ativo.
                      </p>

                      <div className="space-y-3 text-xs flex-1">
                        
                        {/* Imovel LF and Due Day - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Cód. Imóvel (LF)</label>
                            <input
                              type="text"
                              placeholder="Ex: LF04"
                              value={newRentLf}
                              onChange={(e) => setNewRentLf(e.target.value)}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Dia do Vencimento</label>
                            <select
                              value={newRentDueDay}
                              onChange={(e) => setNewRentDueDay(Number(e.target.value))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px]"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={d}>Dia {d}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Tenant Name */}
                        <div className="flex flex-col">
                          <label className="font-bold text-slate-500 mb-1">Inquilino</label>
                          <input
                            type="text"
                            placeholder="Nome do Inquilino"
                            value={newRentTenant}
                            onChange={(e) => setNewRentTenant(e.target.value)}
                            className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px]"
                          />
                        </div>

                        {/* Address Name */}
                        <div className="flex flex-col">
                          <label className="font-bold text-slate-400 mb-1">Endereço do Imóvel</label>
                          <input
                            type="text"
                            placeholder="Rua, Número, Bairro"
                            value={newRentAddress}
                            onChange={(e) => setNewRentAddress(e.target.value)}
                            className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px]"
                          />
                        </div>

                        {/* Rent Value and Water - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Aluguel do Imóvel (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentAmountStr}
                              onChange={(e) => setNewRentAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Água (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentWaterStr}
                              onChange={(e) => setNewRentWaterStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* IPTU and Garbage Tax - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">IPTU (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentIptuStr}
                              onChange={(e) => setNewRentIptuStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Taxa de Lixo (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentGarbageStr}
                              onChange={(e) => setNewRentGarbageStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Electricity and Fines - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Luz / Conta Elétrica (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentLightStr}
                              onChange={(e) => setNewRentLightStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Comissão / Multa (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={newRentFineStr}
                              onChange={(e) => setNewRentFineStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Administration Fee */}
                        <div className="flex flex-col bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                          <div className="flex justify-between mb-1 text-[11px]">
                            <label className="font-bold text-amber-800">Taxa Administração Imobiliária (%)</label>
                            <span className="font-mono text-amber-950 font-extrabold">
                              R$ {(((parseFloat(newRentAmountStr.replace(",", ".")) || 0) * (parseFloat(newRentAdminFeePercentStr.replace(",", ".")) || 0)) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Ex: 10"
                              value={newRentAdminFeePercentStr}
                              onChange={(e) => setNewRentAdminFeePercentStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 pr-8 outline-none font-semibold text-[11px] w-full"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">%</span>
                          </div>
                          <span className="text-[10px] text-amber-600 mt-1">Este percentual da taxa de administração será cobrado sobre o valor base do aluguel.</span>
                        </div>

                        {/* GARANTIA LOCATÍCIA (CAUÇÃO / FIADOR / NENHUMA) */}
                        <div className="flex flex-col bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                              <ShieldCheck size={13} className="text-indigo-600" />
                              <span>Garantia Locatícia</span>
                            </label>
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRentGuaranteeType("caucao");
                                  setNewRentHasDeposit(true);
                                  const rentVal = parseFloat(newRentAmountStr.replace(",", ".")) || 0;
                                  if (!newRentDepositAmountStr) {
                                    setNewRentDepositAmountStr((rentVal * newRentDepositMonths).toFixed(2).replace(".", ","));
                                  }
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  newRentGuaranteeType === "caucao" || (newRentHasDeposit && newRentGuaranteeType !== "fiador" && newRentGuaranteeType !== "nenhuma")
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Caução
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRentGuaranteeType("fiador");
                                  setNewRentHasDeposit(false);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  newRentGuaranteeType === "fiador"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Fiador
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRentGuaranteeType("nenhuma");
                                  setNewRentHasDeposit(false);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  newRentGuaranteeType === "nenhuma" && !newRentHasDeposit
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Nenhuma
                              </button>
                            </div>
                          </div>

                          {/* FIADOR FORM */}
                          {newRentGuaranteeType === "fiador" && (
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                              <div className="flex flex-col">
                                <label className="font-bold text-slate-500 mb-1 text-[10px]">Nome Completo do Fiador</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Carlos Eduardo de Oliveira"
                                  value={newRentGuarantorName}
                                  onChange={(e) => setNewRentGuarantorName(e.target.value)}
                                  className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">CPF do Fiador</label>
                                  <input
                                    type="text"
                                    placeholder="000.000.000-00"
                                    value={newRentGuarantorCpf}
                                    onChange={(e) => setNewRentGuarantorCpf(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">Telefone / WhatsApp</label>
                                  <input
                                    type="text"
                                    placeholder="(00) 00000-0000"
                                    value={newRentGuarantorPhone}
                                    onChange={(e) => setNewRentGuarantorPhone(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CAUÇÃO FORM */}
                          {(newRentGuaranteeType === "caucao" || newRentHasDeposit) && newRentGuaranteeType !== "fiador" && newRentGuaranteeType !== "nenhuma" && (
                            <div className="mt-1 space-y-3 pt-2 border-t border-slate-200 overflow-hidden">
                              {/* Quantity of months selector */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Quantidade de Meses do Aluguel</label>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {[1, 2, 3].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => {
                                        setNewRentDepositMonths(m);
                                        const rentVal = parseFloat(newRentAmountStr.replace(",", ".")) || 0;
                                        setNewRentDepositAmountStr((rentVal * m).toFixed(2).replace(".", ","));
                                      }}
                                      className={`py-1 px-1.5 text-[10px] font-bold rounded-md border text-center transition cursor-pointer select-none ${
                                        newRentDepositMonths === m
                                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold"
                                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                                      }`}
                                    >
                                      {m} {m === 1 ? "Mês" : "Meses"}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setNewRentDepositMonths(0)}
                                    className={`py-1 px-1.5 text-[10px] font-bold rounded-md border text-center transition cursor-pointer select-none ${
                                      newRentDepositMonths === 0
                                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold"
                                        : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                                    }`}
                                  >
                                    Outro
                                  </button>
                                </div>
                              </div>

                              {/* Value input & Suggested placeholder helper */}
                              <div>
                                <div className="flex justify-between mb-1 text-[10px]">
                                  <label className="font-bold text-slate-500">Valor Inicial da Caução (R$)</label>
                                  {newRentDepositMonths > 0 && (
                                    <span className="text-slate-400 font-medium font-sans">
                                      Sugerido: {newRentDepositMonths}x aluguel
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  placeholder="Ex: 2.700,00"
                                  value={newRentDepositAmountStr}
                                  onChange={(e) => setNewRentDepositAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                  className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px] w-full"
                                />
                              </div>

                              {/* Grid: Start Date and Poupança Rate */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1">Data do Depósito</label>
                                  <input
                                    type="date"
                                    value={newRentDepositStartDate}
                                    onChange={(e) => setNewRentDepositStartDate(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px] font-medium cursor-pointer"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1">Taxa Poupança (% ao mês)</label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      placeholder="Ex: 0,5"
                                      value={newRentDepositInterestRateStr}
                                      onChange={(e) => setNewRentDepositInterestRateStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                      className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 pr-6 outline-none font-semibold text-[11px] w-full"
                                    />
                                    <span className="absolute right-2 top-2 text-slate-400 font-bold text-[10px]">%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* BOTÃO DE AJUSTE DE VALOR (+ / -) */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <SlidersHorizontal size={14} className="text-indigo-600" />
                              <span className="font-bold text-[11px]">Ajuste de Valor (+ / -)</span>
                              {newRentAdjustmentActive && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  newRentAdjustmentMode === "subtract" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {newRentAdjustmentMode === "subtract" ? "Abatimento Ativo" : "Acréscimo Ativo"}
                                </span>
                              )}
                            </div>
                            {!newRentAdjustmentActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRentAdjustmentActive(true);
                                  if (!newRentAdjustmentMode) setNewRentAdjustmentMode("add");
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus size={11} />
                                <span>Adicionar Ajuste</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRentAdjustmentActive(false);
                                  setNewRentAdjustmentAmountStr("");
                                  setNewRentAdjustmentReason("");
                                }}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-[9px] font-bold rounded-md transition cursor-pointer"
                                title="Desativar e remover ajuste de valor"
                              >
                                Remover Ajuste
                              </button>
                            )}
                          </div>

                          {newRentAdjustmentActive && (
                            <div className="pt-2 border-t border-slate-200 space-y-2.5">
                              {/* Mode Selector */}
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setNewRentAdjustmentMode("add")}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                    newRentAdjustmentMode === "add"
                                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>➕ Adicionar ao Valor (+)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewRentAdjustmentMode("subtract")}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                    newRentAdjustmentMode === "subtract"
                                      ? "bg-rose-600 border-rose-600 text-white shadow-xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>➖ Subtrair / Abater (-)</span>
                                </button>
                              </div>

                              {/* Inputs: Amount and Reason */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-1 flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">
                                    {newRentAdjustmentMode === "subtract" ? "Valor do Abatimento (R$)" : "Valor do Acréscimo (R$)"}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={newRentAdjustmentAmountStr}
                                    onChange={(e) => setNewRentAdjustmentAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-bold text-[11px] text-slate-800"
                                  />
                                </div>
                                <div className="sm:col-span-2 flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">Observação / Motivo</label>
                                  <input
                                    type="text"
                                    placeholder={newRentAdjustmentMode === "subtract" ? "Ex: Reembolso sacos de lixo (autorizado)" : "Ex: Parcela de acordo de dívida"}
                                    value={newRentAdjustmentReason}
                                    onChange={(e) => setNewRentAdjustmentReason(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px] text-slate-800"
                                  />
                                </div>
                              </div>
                              <p className="text-[9.5px] text-slate-400 italic">
                                {newRentAdjustmentMode === "subtract"
                                  ? "* Este valor será abatido do recebimento líquido sem gerar débito no sistema."
                                  : "* Este valor será somado ao recebimento líquido sem alterar a base de cálculo da taxa de administração."}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* PREVIEW MATH BLOCK */}
                        {(() => {
                          const rentVal = parseFloat(newRentAmountStr.replace(",", ".")) || 0;
                          const waterVal = parseFloat(newRentWaterStr.replace(",", ".")) || 0;
                          const iptuVal = parseFloat(newRentIptuStr.replace(",", ".")) || 0;
                          const garbageVal = parseFloat(newRentGarbageStr.replace(",", ".")) || 0;
                          const lightVal = parseFloat(newRentLightStr.replace(",", ".")) || 0;
                          const fineVal = parseFloat(newRentFineStr.replace(",", ".")) || 0;
                          const chargesVal = waterVal + iptuVal + garbageVal + lightVal + fineVal;
                          const adminPercent = parseFloat(newRentAdminFeePercentStr.replace(",", ".")) || 0;
                          const adminVal = (rentVal * adminPercent) / 100;
                          const adjAmount = newRentAdjustmentActive ? (parseFloat(newRentAdjustmentAmountStr.replace(",", ".")) || 0) : 0;
                          const baseNet = rentVal + chargesVal - adminVal;
                          const netReceived = newRentAdjustmentMode === "subtract" ? baseNet - adjAmount : baseNet + adjAmount;

                          return (
                            <div className="bg-indigo-950 text-indigo-100 p-4 rounded-xl space-y-2 mt-4 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-90 border-b border-indigo-900 pb-1.5">
                                <span>Resumo Detalhado</span>
                                <span>Visualização Líquida</span>
                              </div>
                              <div className="space-y-1 font-mono text-[11px] opacity-80 leading-normal">
                                <div className="flex justify-between">
                                  <span>Aluguel:</span>
                                  <span>R$ {rentVal.toFixed(2)}</span>
                                </div>
                                {chargesVal > 0 && (
                                  <div className="flex justify-between">
                                    <span>Encargos (Consumo/Tributos):</span>
                                    <span>R$ {chargesVal.toFixed(2)}</span>
                                  </div>
                                )}
                                {adminVal > 0 && (
                                  <div className="flex justify-between text-rose-300">
                                    <span>(-) Taxa Administração ({adminPercent}%):</span>
                                    <span>- R$ {adminVal.toFixed(2)}</span>
                                  </div>
                                )}
                                {adjAmount > 0 && (
                                  <div className={`flex justify-between ${newRentAdjustmentMode === "subtract" ? "text-amber-300" : "text-emerald-300"}`}>
                                    <span>{newRentAdjustmentMode === "subtract" ? "(-) Abatimento / Ajuste:" : "(+) Acréscimo / Ajuste:"}</span>
                                    <span>{newRentAdjustmentMode === "subtract" ? "- " : "+ "}R$ {adjAmount.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-indigo-900 font-bold">
                                <span className="text-xs uppercase">Recebimento Líquido</span>
                                <span className="text-sm font-mono text-emerald-300">
                                  R$ {netReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowNewRentForm(false)}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-850 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddRentalProperty}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer"
                        >
                          Cadastrar Imóvel (LF)
                        </button>
                      </div>

                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* OVERLAY MODAL DIALOG: Edit Rental Property (LF) */}
              <AnimatePresence>
                {editingRental !== null && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingRental(null)}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                    />
                    
                    {/* Modal Content Card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      transition={{ type: "spring", duration: 0.35 }}
                      className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative z-10 p-6 flex flex-col"
                    >
                      {/* Close Header Button */}
                      <button
                        type="button"
                        onClick={() => setEditingRental(null)}
                        className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                      >
                        <X size={15} />
                      </button>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-1.5 bg-amber-50 text-amber-755 rounded-lg">
                          <Edit2 size={15} />
                        </span>
                        <h3 className="font-bold text-sm text-slate-800">Editar Imóvel (Contrato {editRentLf})</h3>
                      </div>

                      <p className="text-xs text-slate-450 mb-4 leading-normal">
                        Altere os dados cadastrais, cobranças fixas ou vincule uma poupança de caução. As mudanças serão reﬂetidas imediatamente nas planilhas.
                      </p>

                      <div className="space-y-3 text-xs flex-1">
                        
                        {/* Imovel LF and Due Day - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Cód. Imóvel (LF)</label>
                            <input
                              type="text"
                              placeholder="Ex: LF04"
                              value={editRentLf}
                              onChange={(e) => setEditRentLf(e.target.value)}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Dia do Vencimento</label>
                            <select
                              value={editRentDueDay}
                              onChange={(e) => setEditRentDueDay(Number(e.target.value))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px] font-medium"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                <option key={day} value={day}>Dia {day}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Tenant Name Input */}
                        <div className="flex flex-col">
                          <label className="font-bold text-slate-500 mb-1">Nome Completo do Inquilino</label>
                          <input
                            type="text"
                            placeholder="Ex: Carlos Eduardo de Souza"
                            value={editRentTenant}
                            onChange={(e) => setEditRentTenant(e.target.value)}
                            className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                          />
                        </div>

                        {/* Address Input */}
                        <div className="flex flex-col">
                          <label className="font-bold text-slate-500 mb-1">Endereço do Imóvel</label>
                          <input
                            type="text"
                            placeholder="Ex: Av. Atlântica, 1420 - Ap 302"
                            value={editRentAddress}
                            onChange={(e) => setEditRentAddress(e.target.value)}
                            className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                          />
                        </div>

                        {/* Grid: rent and water */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Valor do Aluguel Base (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentAmountStr}
                              onChange={(e) => setEditRentAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-bold text-[11px] text-slate-800"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Valor de Água Fixo (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentWaterStr}
                              onChange={(e) => setEditRentWaterStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Grid: IPTU and Garbage */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">IPTU Mensal (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentIptuStr}
                              onChange={(e) => setEditRentIptuStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Taxas de Lixo / Comum (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentGarbageStr}
                              onChange={(e) => setEditRentGarbageStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Electricity and Fines - Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Luz / Conta Elétrica (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentLightStr}
                              onChange={(e) => setEditRentLightStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-bold text-slate-500 mb-1">Comissão / Multa (R$)</label>
                            <input
                              type="text"
                              placeholder="0,00"
                              value={editRentFineStr}
                              onChange={(e) => setEditRentFineStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Administration Fee */}
                        <div className="flex flex-col bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                          <div className="flex justify-between mb-1 text-[11px]">
                            <label className="font-bold text-amber-800">Taxa Administração Imobiliária (%)</label>
                            <span className="font-mono text-amber-950 font-extrabold">
                              R$ {(((parseFloat(editRentAmountStr.replace(".", ",").replace(",", ".")) || 0) * (parseFloat(editRentAdminFeePercentStr.replace(".", ",").replace(",", ".")) || 0)) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Ex: 10"
                              value={editRentAdminFeePercentStr}
                              onChange={(e) => setEditRentAdminFeePercentStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 pr-8 outline-none font-semibold text-[11px] w-full"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">%</span>
                          </div>
                          <span className="text-[10px] text-amber-600 mt-1">Este percentual da taxa de administração será cobrado sobre o valor base do aluguel.</span>
                        </div>

                        {/* GARANTIA LOCATÍCIA (CAUÇÃO / FIADOR / NENHUMA) */}
                        <div className="flex flex-col bg-slate-50 p-3 rounded-xl border border-slate-205 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                              <ShieldCheck size={13} className="text-indigo-600" />
                              <span>Garantia Locatícia</span>
                            </label>
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditRentGuaranteeType("caucao");
                                  setEditRentHasDeposit(true);
                                  const rentVal = parseFloat(editRentAmountStr.replace(",", ".")) || 0;
                                  if (!editRentDepositAmountStr) {
                                    setEditRentDepositAmountStr((rentVal * editRentDepositMonths).toFixed(2).replace(".", ","));
                                  }
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  editRentGuaranteeType === "caucao" || (editRentHasDeposit && editRentGuaranteeType !== "fiador" && editRentGuaranteeType !== "nenhuma")
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Caução
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditRentGuaranteeType("fiador");
                                  setEditRentHasDeposit(false);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  editRentGuaranteeType === "fiador"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Fiador
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditRentGuaranteeType("nenhuma");
                                  setEditRentHasDeposit(false);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                                  editRentGuaranteeType === "nenhuma" && !editRentHasDeposit
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Nenhuma
                              </button>
                            </div>
                          </div>

                          {/* FIADOR FORM */}
                          {editRentGuaranteeType === "fiador" && (
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                              <div className="flex flex-col">
                                <label className="font-bold text-slate-500 mb-1 text-[10px]">Nome Completo do Fiador</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Carlos Eduardo de Oliveira"
                                  value={editRentGuarantorName}
                                  onChange={(e) => setEditRentGuarantorName(e.target.value)}
                                  className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">CPF do Fiador</label>
                                  <input
                                    type="text"
                                    placeholder="000.000.000-00"
                                    value={editRentGuarantorCpf}
                                    onChange={(e) => setEditRentGuarantorCpf(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">Telefone / WhatsApp</label>
                                  <input
                                    type="text"
                                    placeholder="(00) 00000-0000"
                                    value={editRentGuarantorPhone}
                                    onChange={(e) => setEditRentGuarantorPhone(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px]"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CAUÇÃO FORM */}
                          {(editRentGuaranteeType === "caucao" || editRentHasDeposit) && editRentGuaranteeType !== "fiador" && editRentGuaranteeType !== "nenhuma" && (
                            <div className="mt-1 space-y-3 pt-2 border-t border-slate-200 overflow-hidden">
                              {/* Quantity of months selector */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Quantidade de Meses do Aluguel</label>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {[1, 2, 3, 6].map((num) => (
                                    <button
                                      type="button"
                                      key={num}
                                      onClick={() => {
                                        setEditRentDepositMonths(num);
                                        const rentVal = parseFloat(editRentAmountStr.replace(",", ".")) || 0;
                                        setEditRentDepositAmountStr((rentVal * num).toFixed(2).replace(".", ","));
                                      }}
                                      className={`py-1 rounded-lg border font-bold text-[10px] transition cursor-pointer select-none ${
                                        editRentDepositMonths === num
                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
                                      }`}
                                    >
                                      {num} {num === 1 ? "mês" : "meses"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Custody Value Input */}
                              <div className="flex flex-col">
                                <label className="font-bold text-slate-500 mb-1">Valor da Caução Depositada (R$)</label>
                                <input
                                  type="text"
                                  placeholder="0,00"
                                  value={editRentDepositAmountStr}
                                  onChange={(e) => setEditRentDepositAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                  className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-bold text-[11px] text-emerald-700"
                                />
                              </div>

                              {/* Grid: Start Date and Poupança Rate */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1">Data do Depósito</label>
                                  <input
                                    type="date"
                                    value={editRentDepositStartDate}
                                    onChange={(e) => setEditRentDepositStartDate(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none text-[11px] font-medium cursor-pointer"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1">Taxa Poupança (% ao mês)</label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      placeholder="Ex: 0,5"
                                      value={editRentDepositInterestRateStr}
                                      onChange={(e) => setEditRentDepositInterestRateStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                      className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 pr-6 outline-none font-semibold text-[11px] w-full"
                                    />
                                    <span className="absolute right-2 top-2 text-slate-400 font-bold text-[10px]">%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* BOTÃO DE AJUSTE DE VALOR (+ / -) */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <SlidersHorizontal size={14} className="text-indigo-600" />
                              <span className="font-bold text-[11px]">Ajuste de Valor (+ / -)</span>
                              {editRentAdjustmentActive && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  editRentAdjustmentMode === "subtract" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {editRentAdjustmentMode === "subtract" ? "Abatimento Ativo" : "Acréscimo Ativo"}
                                </span>
                              )}
                            </div>
                            {!editRentAdjustmentActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditRentAdjustmentActive(true);
                                  if (!editRentAdjustmentMode) setEditRentAdjustmentMode("add");
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus size={11} />
                                <span>Adicionar Ajuste</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditRentAdjustmentActive(false);
                                  setEditRentAdjustmentAmountStr("");
                                  setEditRentAdjustmentReason("");
                                }}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-[9px] font-bold rounded-md transition cursor-pointer"
                                title="Desativar e remover ajuste de valor"
                              >
                                Remover Ajuste
                              </button>
                            )}
                          </div>

                          {editRentAdjustmentActive && (
                            <div className="pt-2 border-t border-slate-200 space-y-2.5">
                              {/* Mode Selector */}
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditRentAdjustmentMode("add")}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                    editRentAdjustmentMode === "add"
                                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>➕ Adicionar ao Valor (+)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditRentAdjustmentMode("subtract")}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                    editRentAdjustmentMode === "subtract"
                                      ? "bg-rose-600 border-rose-600 text-white shadow-xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>➖ Subtrair / Abater (-)</span>
                                </button>
                              </div>

                              {/* Inputs: Amount and Reason */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-1 flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">
                                    {editRentAdjustmentMode === "subtract" ? "Valor do Abatimento (R$)" : "Valor do Acréscimo (R$)"}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={editRentAdjustmentAmountStr}
                                    onChange={(e) => setEditRentAdjustmentAmountStr(e.target.value.replace(/[^0-9,.]/g, ""))}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-bold text-[11px] text-slate-800"
                                  />
                                </div>
                                <div className="sm:col-span-2 flex flex-col">
                                  <label className="font-bold text-slate-500 mb-1 text-[10px]">Observação / Motivo</label>
                                  <input
                                    type="text"
                                    placeholder={editRentAdjustmentMode === "subtract" ? "Ex: Reembolso sacos de lixo (autorizado)" : "Ex: Parcela de acordo de dívida"}
                                    value={editRentAdjustmentReason}
                                    onChange={(e) => setEditRentAdjustmentReason(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-indigo-400 rounded-lg p-2 outline-none font-semibold text-[11px] text-slate-800"
                                  />
                                </div>
                              </div>
                              <p className="text-[9.5px] text-slate-400 italic">
                                {editRentAdjustmentMode === "subtract"
                                  ? "* Este valor será abatido do recebimento líquido do contrato sem gerar débitos indevidos."
                                  : "* Este valor será somado ao recebimento líquido sem alterar a base de cálculo da taxa de administração."}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* PREVIEW MATH BLOCK */}
                        {(() => {
                          const rentVal = parseFloat(editRentAmountStr.replace(",", ".")) || 0;
                          const waterVal = parseFloat(editRentWaterStr.replace(",", ".")) || 0;
                          const iptuVal = parseFloat(editRentIptuStr.replace(",", ".")) || 0;
                          const garbageVal = parseFloat(editRentGarbageStr.replace(",", ".")) || 0;
                          const lightVal = parseFloat(editRentLightStr.replace(",", ".")) || 0;
                          const fineVal = parseFloat(editRentFineStr.replace(",", ".")) || 0;
                          const chargesVal = waterVal + iptuVal + garbageVal + lightVal + fineVal;
                          const adminPercent = parseFloat(editRentAdminFeePercentStr.replace(",", ".")) || 0;
                          const adminVal = (rentVal * adminPercent) / 100;
                          const adjAmount = editRentAdjustmentActive ? (parseFloat(editRentAdjustmentAmountStr.replace(",", ".")) || 0) : 0;
                          const baseNet = rentVal + chargesVal - adminVal;
                          const netReceived = editRentAdjustmentMode === "subtract" ? baseNet - adjAmount : baseNet + adjAmount;

                          return (
                            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-2 mt-4 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-90 border-b border-slate-800 pb-1.5">
                                <span>Resumo Detalhado (Editado)</span>
                                <span>Visualização Líquida</span>
                              </div>
                              <div className="space-y-1 font-mono text-[11px] opacity-80 leading-normal">
                                <div className="flex justify-between">
                                  <span>Aluguel:</span>
                                  <span>R$ {rentVal.toFixed(2)}</span>
                                </div>
                                {chargesVal > 0 && (
                                  <div className="flex justify-between">
                                    <span>Encargos (Consumo/Tributos):</span>
                                    <span>R$ {chargesVal.toFixed(2)}</span>
                                  </div>
                                )}
                                {adminVal > 0 && (
                                  <div className="flex justify-between text-rose-350">
                                    <span>(-) Taxa Administração ({adminPercent}%):</span>
                                    <span>- R$ {adminVal.toFixed(2)}</span>
                                  </div>
                                )}
                                {adjAmount > 0 && (
                                  <div className={`flex justify-between ${editRentAdjustmentMode === "subtract" ? "text-amber-400" : "text-emerald-400"}`}>
                                    <span>{editRentAdjustmentMode === "subtract" ? "(-) Abatimento / Ajuste:" : "(+) Acréscimo / Ajuste:"}</span>
                                    <span>{editRentAdjustmentMode === "subtract" ? "- " : "+ "}R$ {adjAmount.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold">
                                <span className="text-xs uppercase">Recebimento Líquido</span>
                                <span className="text-sm font-mono text-emerald-400">
                                  R$ {netReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingRental(null)}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-850 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditedRental}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer"
                        >
                          Salvar Alterações
                        </button>
                      </div>

                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>
          ) : subTab === "relatorio" ? (
            <div className="w-full">
              {renderRelatorioImobiliaria()}
            </div>
          ) : subTab === "categorias" ? (
            <div className="w-full">
              <CategoriesManager
                categories={categories}
                onCreate={handleCreateCategory}
                onUpdate={handleUpdateCategory}
                onDelete={handleDeleteCategory}
                onOpenTransfer={(sourceCatId) => {
                  setCategoryModalMode("transfer");
                  setCategoryModalSourceId(sourceCatId || categories[0]?.id || "");
                  setIsCategoryModalOpen(true);
                }}
              />
            </div>
          ) : (
            <div className="w-full font-sans">
              <ActivityLogPanel
                logs={activityLogs}
                onClearLogs={() => setActivityLogs([])}
                activeCaixa={activeCaixa}
                caixas={caixas}
              />
            </div>
          )}

        </div>

        {/* Leadpage Analytics Dashboard */}
        <LeadpageDashboard
          transactions={transactions}
          activeCaixaId={activeCaixaId}
          activeCaixaName={activeCaixa.name}
          monthsList={monthsList}
          filterYear={filterYear}
          filterMonth={filterMonth}
          rentals={rentals}
        />

      </div>

      {/* AI Assistant Sidebar Panel - Slidez from right */}
      <AnimatePresence>
        {isAiPanelOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-100 flex justify-end">
            {/* Backdrop click closer */}
            <div className="absolute inset-0" onClick={() => setIsAiPanelOpen(false)}></div>
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col justify-between z-110"
            >
              <div>
                {/* Header panel */}
                <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-950/40 rounded-lg text-emerald-400">
                      <Sparkles size={18} className="animate-pulse" />
                    </span>
                    <div>
                      <h3 className="font-bold text-base leading-snug">Assessoria Inteligente</h3>
                      <p className="text-[10px] text-blue-100/80">Gemini AI Financial Insights</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAiPanelOpen(false)}
                    className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition outline-none"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body Content AI output */}
                <div className="p-6 overflow-y-auto max-h-[calc(100vh-140px)] leading-relaxed">
                  
                  {isGeneratingAI && (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                      <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-sm font-semibold text-slate-700">Analisando faturamento e despesas do caixa...</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-normal">Esta consulta segura faz uso do modelo Inteligente Gemini para verificar sua eficiência orçamentária.</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex gap-2">
                      <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-600" />
                      <div>
                        <strong className="font-bold block mb-1">Erro na Chamada AI</strong>
                        {aiError}
                        <button 
                          onClick={handleGenerateAIInsights}
                          className="mt-3 block bg-rose-200 hover:bg-rose-300 transition px-3 py-1 rounded font-bold text-rose-800"
                        >
                          Tentar Novamente
                        </button>
                      </div>
                    </div>
                  )}

                  {aiInsights && (
                    <div className="text-slate-700 text-sm space-y-4">
                      
                      {/* Sub-header card */}
                      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl mb-4 select-none">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase">Relatório Gerado</span>
                        <div className="text-xs text-slate-500 mt-1.5">
                          Referência: <strong>{activeCaixa.name}</strong> • Month: <strong>{filterMonth !== "todos" ? monthsList.find(m => m.value === filterMonth)?.label : "Ano Completo"}</strong>
                        </div>
                      </div>

                      {/* Decoded insights block with styling */}
                      <div className="prose prose-sm max-w-none prose-slate">
                        <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate-700">
                          {aiInsights}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>

              {/* Powered footer tag */}
              <div className="p-4 border-t border-slate-100 text-center bg-slate-50 select-none">
                <span className="text-[10px] text-slate-400 font-semibold font-mono">
                  PROVEDOR DE INTELIGÊNCIA: GEMINI-3-FLASH
                </span>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Criar Novo Caixa */}
      <AnimatePresence>
        {isNewCaixaModalOpen && (
          <div 
            onClick={() => setIsNewCaixaModalOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full cursor-default"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Novo Caixa / Conta</h3>
                <button onClick={() => setIsNewCaixaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4 font-light">
                Crie um novo caixa ou aba de conta para gerenciar lançamentos financeiros independentes (ex: Caixa Físico, Banco S/A, Cartão de Crédito).
              </p>
              <input
                type="text"
                placeholder="Nome do Caixa (ex: Caixa Banco Premium)"
                value={newCaixaName}
                onChange={(e) => setNewCaixaName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl p-3.5 text-sm mb-5 outline-none transition"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCaixa();
                }}
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setIsNewCaixaModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCaixa}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Criar Aba de Caixa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Configurar e Gerenciar Caixa Ativo */}
      <AnimatePresence>
        {isRenameCaixaModalOpen && (
          <div 
            onClick={() => setIsRenameCaixaModalOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full cursor-default"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Settings size={18} className="text-slate-550" />
                  Gerenciar Caixa Ativo
                </h3>
                <button onClick={() => setIsRenameCaixaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Renomear Caixa:</label>
                  <input
                    type="text"
                    value={renameCaixaName}
                    onChange={(e) => setRenameCaixaName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl p-3.5 text-sm outline-none transition"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                <button
                  onClick={() => {
                    if (confirm("Você quer mesmo deletar este caixa por completo? Essa ação apagará todos os lançamentos atrelados a ele.")) {
                      handleDeleteCaixa();
                      setIsRenameCaixaModalOpen(false);
                    }
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  Remover Caixa
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRenameCaixaModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRenameCaixa}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG: Delete Transaction */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div 
            onClick={() => setIsDeleteConfirmOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full cursor-default"
            >
              <h3 className="text-base font-bold text-slate-800 mb-2">Excluir Lançamento?</h3>
              <p className="text-xs text-slate-550 leading-relaxed mb-6">Esta operação é definitiva e alterará os relatórios e saldos finais deste caixa. Confirma a exclusão?</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  Manter
                </button>
                <button
                  onClick={confirmDeleteTransaction}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Deletar Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG: Reset Data */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <div 
            onClick={() => setIsResetConfirmOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full cursor-default"
            >
              <h3 className="text-base font-bold text-slate-800 mb-2 text-rose-600 flex items-center gap-1">
                <AlertCircle size={18} />
                Limpar Todos os Caixas?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed mb-6">Isso apagará todas as contas, movimentações, contratos, modelos fixos e logs cadastrados, deixando o sistema em branco para recomeçar. Prosseguir?</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  Não, voltar
                </button>
                <button
                  onClick={handleResetData}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Sim, Limpar Banco Local
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Configurar Sincronização do Google Drive */}
      <AnimatePresence>
        {isGoogleConfigModalOpen && (
          <div 
            onClick={() => setIsGoogleConfigModalOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full cursor-default text-slate-800"
            >
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Database size={18} className="text-blue-600 animate-pulse" />
                  Sincronização em Nuvem (Google Drive)
                </h3>
                <button onClick={() => setIsGoogleConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 mb-6 text-xs text-slate-600">
                <p className="leading-relaxed">
                  Para habilitar a sincronização automática e usar o app em múltiplos computadores de forma gratuita, você precisa fornecer o seu próprio <strong>Google OAuth Client ID</strong>.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-700 block text-xs">Como criar seu Google Client ID gratuitamente:</span>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                    <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">Google Cloud Console</a>.</li>
                    <li>Crie um projeto gratuito para o seu app.</li>
                    <li>No menu lateral, vá em <strong>APIs e Serviços &gt; Biblioteca</strong>, busque por <strong>Google Drive API</strong> e ative-a.</li>
                    <li>Vá em <strong>Tela de consentimento OAuth</strong>, configure como "Externo", preencha as informações básicas do app e adicione o escopo <code>https://www.googleapis.com/auth/drive.appdata</code>.</li>
                    <li>Vá em <strong>Credenciais &gt; Criar Credenciais &gt; ID do cliente OAuth</strong>.</li>
                    <li>Escolha <strong>Aplicativo da Web</strong>. Em <strong>Origens JavaScript autorizadas</strong>, adicione <code>http://localhost:3000</code> e <code>http://127.0.0.1:3000</code>.</li>
                    <li>Copie o ID do cliente gerado e cole no campo abaixo.</li>
                  </ol>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-550 uppercase block mb-1.5">
                    Seu Google Client ID:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: 1234567890-xxxxx.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setGoogleClientId(val);
                        localStorage.setItem("caixa_google_client_id", val);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl p-3 pl-9 text-xs outline-none transition font-mono"
                    />
                    <Key size={14} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setIsGoogleConfigModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setIsGoogleConfigModalOpen(false);
                    if (googleClientId) {
                      setTimeout(() => handleConnectGoogle(), 300);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Salvar e Conectar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACCOUNTANT / IR ORGANIZER REPORT MODAL */}
      <AccountantReportModal
        isOpen={isAccountantReportOpen}
        onClose={() => setIsAccountantReportOpen(false)}
        transactions={transactions}
        fixedTemplates={fixedTemplates}
        rentals={rentals}
        categories={categories}
        activeCaixa={activeCaixa}
        caixas={caixas}
      />

      {/* EXECUTIVE REPORT MODAL / PDF PRINT */}
      <ExecutiveReportModal
        isOpen={isExecutiveReportOpen}
        onClose={() => setIsExecutiveReportOpen(false)}
        transactions={transactions}
        activeCaixa={activeCaixa}
        caixas={caixas}
        rentals={rentals}
        categories={categories}
        activityLogs={activityLogs}
      />

      {/* RENTAL DETAILED PORTFOLIO REPORT MODAL / PDF PRINT */}
      <RentalReportModal
        isOpen={isRentalReportOpen}
        onClose={() => setIsRentalReportOpen(false)}
        rentals={rentals}
        activeCaixa={activeCaixa}
        caixas={caixas}
        initialSelectedRentalId={selectedRentalIdForReport}
      />

      {/* DEPOSIT CAUÇÃO DETAILS MODAL */}
      <DepositDetailModal
        isOpen={selectedDepositRental !== null}
        onClose={() => setSelectedDepositRental(null)}
        rental={selectedDepositRental}
        onUpdateRentalDeposit={handleUpdateRentalDeposit}
        onRefundDeposit={handleRefundRentalDeposit}
        sgsRates={sgsRates}
        sgsLoading={sgsLoading}
        sgsError={sgsError}
      />

      {/* RENTAL ADJUSTMENTS MANAGER MODAL */}
      <AnimatePresence>
        {managingAdjustmentsRental && (() => {
          const rental = managingAdjustmentsRental;
          const applicableAdjs = getRentalApplicableAdjustments(rental, activePeriodStr);
          const allAdjs = rental.adjustments && Array.isArray(rental.adjustments)
            ? rental.adjustments
            : (rental.adjustmentAmount && rental.adjustmentAmount > 0
                ? [{
                    id: "legacy-adj-" + rental.id,
                    mode: rental.adjustmentMode || "add",
                    amount: rental.adjustmentAmount,
                    description: rental.adjustmentReason || "Ajuste de valor",
                    recurrence: "fixo" as const
                  }]
                : []);
          const netAdj = getRentalAdjustmentsNetTotal(rental, activePeriodStr);
          const expectedReceivable = getRentalExpectedAmount(rental, activePeriodStr);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-900 dark:text-slate-100 relative max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <SlidersHorizontal size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md uppercase bg-indigo-150 text-indigo-800">
                          {rental.lfCode}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                          {rental.tenantName}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ajustes de valor • Competência: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatPeriodBRL(activePeriodStr)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingAdjustmentsRental(null);
                      setAdjFormAmountStr("");
                      setAdjFormDesc("");
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Content body - scrollable */}
                <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
                  {/* Summary bar */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Aluguel Base</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        R$ {rental.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Ajustes</span>
                      <span className={`font-mono font-bold text-xs ${netAdj > 0 ? "text-emerald-600" : netAdj < 0 ? "text-rose-600" : "text-slate-500"}`}>
                        {netAdj > 0 ? `+ R$ ${netAdj.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : netAdj < 0 ? `- R$ ${Math.abs(netAdj).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Líquido Mês</span>
                      <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                        R$ {expectedReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* List of existing adjustments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                        Ajustes Cadastrados ({allAdjs.length})
                      </span>
                      {allAdjs.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {applicableAdjs.length} ativo(s) neste mês
                        </span>
                      )}
                    </div>

                    {allAdjs.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 text-slate-400">
                        Nenhum ajuste cadastrado para este imóvel. Use o formulário abaixo para adicionar.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {allAdjs.map((adj) => {
                          const isApplicableThisMonth = adj.recurrence === "fixo" || adj.targetPeriod === activePeriodStr;
                          return (
                            <div
                              key={adj.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                                isApplicableThisMonth
                                  ? adj.mode === "add"
                                    ? "bg-emerald-50/40 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/40"
                                    : "bg-rose-50/40 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-800/40"
                                  : "bg-slate-50 border-slate-200 opacity-60 dark:bg-slate-800/40 dark:border-slate-700"
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span className={`px-1.5 py-0.5 rounded-md font-extrabold text-[10px] ${
                                  adj.mode === "add"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                                }`}>
                                  {adj.mode === "add" ? "➕ Acréscimo" : "➖ Desconto"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">
                                      {adj.mode === "subtract" ? "-" : "+"} R$ {adj.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                      adj.recurrence === "fixo"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                    }`}>
                                      {adj.recurrence === "fixo" ? "📌 Fixo (todo mês)" : `📅 Pontual (${adj.targetPeriod ? formatPeriodBRL(adj.targetPeriod) : "Mês atual"})`}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5" title={adj.description}>
                                    {adj.description}
                                  </p>
                                  {!isApplicableThisMonth && (
                                    <span className="text-[9px] text-slate-400 italic">
                                      Inativo nesta competência ({formatPeriodBRL(activePeriodStr)})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdjustmentFromRental(rental.id, adj.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition ml-2 flex-shrink-0 cursor-pointer"
                                title="Remover este ajuste"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Form to add a new adjustment */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider block">
                      + Adicionar Novo Ajuste
                    </span>

                    {/* Mode buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjFormMode("add")}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          adjFormMode === "add"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-1 ring-emerald-500"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span>➕</span>
                        <span>Acréscimo (+)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjFormMode("subtract")}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          adjFormMode === "subtract"
                            ? "bg-rose-50 border-rose-500 text-rose-800 shadow-xs ring-1 ring-rose-500"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span>➖</span>
                        <span>Abatimento (-)</span>
                      </button>
                    </div>

                    {/* Value and Description Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Valor do Ajuste (R$) *
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={adjFormAmountStr}
                          onChange={(e) => setAdjFormAmountStr(e.target.value)}
                          placeholder="0,00"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Descrição / Motivo
                        </label>
                        <input
                          type="text"
                          value={adjFormDesc}
                          onChange={(e) => setAdjFormDesc(e.target.value)}
                          placeholder={adjFormMode === "add" ? "Ex: Manutenção acordada, Taxa extra..." : "Ex: Desconto de pintura, Reparo..."}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    {/* Recurrence Selection: Pontual (some no próximo mês) vs Fixo */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                        Duração / Recorrência
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAdjFormRecurrence("pontual")}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            adjFormRecurrence === "pontual"
                              ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500 text-indigo-950 font-bold"
                              : "bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[11px]">
                            <span>📅 Pontual</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug font-normal">
                            Válido apenas em <strong>{formatPeriodBRL(activePeriodStr)}</strong>. Some no próximo mês.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAdjFormRecurrence("fixo")}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            adjFormRecurrence === "fixo"
                              ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500 text-indigo-950 font-bold"
                              : "bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[11px]">
                            <span>📌 Fixo Mensal</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug font-normal">
                            Aplica em todos os meses futuros automaticamente.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      type="button"
                      onClick={() => handleAddAdjustmentToRental(rental.id)}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <Plus size={14} />
                      <span>Inserir Ajuste no Imóvel</span>
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                  <span className="text-[11px] text-slate-400">
                    Ajustes refletem instantaneamente no valor líquido a receber.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingAdjustmentsRental(null);
                      setAdjFormAmountStr("");
                      setAdjFormDesc("");
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 rounded-xl transition text-xs cursor-pointer"
                  >
                    Concluir / Fechar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* RENT RECEIPT DATE CONFIRMATION OVERLAY MODAL */}
      <AnimatePresence>
        {renderReceiptConfirmModal()}
      </AnimatePresence>

      {/* OVERLAY MODAL: Quitar 2ª Parte do Aluguel (Saldo Devedor) */}
      <AnimatePresence>
        {payingShortfallRental && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayingShortfallRental(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[92vh] relative z-10 flex flex-col my-auto overflow-hidden"
            >
              {/* Header Fixo */}
              <div className="p-5 pb-3 border-b border-slate-100 flex-shrink-0 relative bg-white">
                <button
                  type="button"
                  onClick={() => setPayingShortfallRental(null)}
                  className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                >
                  <X size={15} />
                </button>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                    <Check size={16} />
                  </span>
                  <h3 className="font-bold text-sm text-slate-800">Quitar 2ª Parte do Aluguel</h3>
                </div>

                <p className="text-xs text-slate-500 leading-normal">
                  Registre a data e a forma de pagamento do saldo devedor restante do imóvel <strong>{payingShortfallRental.lfCode}</strong> ({payingShortfallRental.tenantName}).
                </p>
              </div>

              {/* Body Rolável */}
              <div className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs">
                {/* Resumo do Contrato e 1ª Parte */}
                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1 bg-gradient-to-r from-slate-50 to-emerald-50/30">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Competência:</span>
                    <span className="font-bold text-slate-800">{formatPeriodBRL(payingShortfallPeriod)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">1ª Parte Recebida:</span>
                    <span className="font-mono font-bold text-slate-700">
                      R$ {(payingShortfallRental.paymentAmounts?.[payingShortfallPeriod] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-semibold">
                    <span className="text-amber-800">Saldo Devedor Restante:</span>
                    <span className="text-amber-700 font-mono font-extrabold text-sm">
                      R$ {(payingShortfallRental.paymentAdjustments?.[payingShortfallPeriod]?.difference || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Data do Recebimento da 2ª Parte */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Data de Recebimento da 2ª Parte</label>
                  <input
                    type="date"
                    value={payingShortfallDateInput}
                    onChange={(e) => setPayingShortfallDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 text-xs text-slate-800 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Pode ser outra data deste mesmo mês ou quando o inquilino efetivou o pagamento.</p>
                </div>

                {/* Valor Recebido na 2ª Parte */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Valor Recebido na 2ª Parte (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payingShortfallAmountInput}
                    onChange={(e) => setPayingShortfallAmountInput(e.target.value)}
                    placeholder="Ex: 500,00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 text-xs text-slate-800 font-mono font-bold"
                  />
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Forma de Recebimento (2ª Parte)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {RENTAL_PAYMENT_METHODS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayingShortfallPaymentMethod(m.id)}
                        className={`py-1.5 px-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          payingShortfallPaymentMethod === m.id
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <span>{m.icon}</span>
                        <span className="truncate">{m.label.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observação / Descrição */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span>Descrição / Observação</span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </label>
                  <input
                    type="text"
                    value={payingShortfallObservation}
                    onChange={(e) => setPayingShortfallObservation(e.target.value)}
                    placeholder="Ex: Quitado via PIX na conta..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Footer Fixo com Botões Sempre Visíveis */}
              <div className="p-4 bg-slate-50/90 border-t border-slate-150 flex gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPayingShortfallRental(null)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 font-bold rounded-xl transition cursor-pointer text-center text-xs shadow-3xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const amount = parseCurrencyInput(payingShortfallAmountInput);
                    handleConfirmRentalShortfallPayment(
                      payingShortfallRental,
                      payingShortfallPeriod,
                      payingShortfallDateInput,
                      amount,
                      payingShortfallPaymentMethod,
                      payingShortfallObservation
                    );
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl transition cursor-pointer text-center shadow-xs text-xs"
                >
                  Confirmar Quitação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMAÇÃO E AJUSTE DE VALOR/PAGAMENTO DE DESPESA/RECEITA FIXA */}
      <AnimatePresence>
        {confirmingFixedTpl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full relative max-h-[92vh] flex flex-col my-auto overflow-hidden">
              <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    confirmingFixedTpl.type === "entrada" 
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" 
                      : "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                  }`}>
                    {confirmingFixedTpl.type === "entrada" ? "↓" : "↑"}
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      Confirmar Lançamento {confirmingFixedTpl.type === "entrada" ? "da Receita" : "da Despesa"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ajuste o valor real e a forma de pagamento antes de lançar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingFixedTpl(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Descrição do Lançamento
                  </label>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                    {confirmingFixedTpl.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Valor Real (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={confirmFixedAmountStr}
                      onChange={(e) => setConfirmFixedAmountStr(e.target.value)}
                      placeholder="0,00"
                      autoFocus
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Altere os centavos se necessário</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Data no Extrato
                    </label>
                    <input
                      type="date"
                      value={confirmFixedDate}
                      onChange={(e) => setConfirmFixedDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={confirmFixedPaymentMethod}
                    onChange={(e) => setConfirmFixedPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="dinheiro">💵 Dinheiro em Espécie</option>
                    <option value="pix">⚡ PIX</option>
                    <option value="cartao_credito">💳 Cartão de Crédito</option>
                    <option value="cartao_debito">💳 Cartão de Débito</option>
                    <option value="boleto">📄 Boleto Bancário</option>
                    <option value="outros">🔄 Outros / Transferência</option>
                  </select>
                </div>

                {confirmFixedPaymentMethod === "cartao_credito" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Qual Cartão de Crédito foi utilizado?
                    </label>
                    {creditCards.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Nenhum cartão cadastrado ainda. Cadastre seus cartões na aba "Cartões & Faturas".
                      </p>
                    ) : (
                      <select
                        value={confirmFixedCardId}
                        onChange={(e) => setConfirmFixedCardId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                      >
                        {creditCards.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.lastFourDigits ? `(•••• ${c.lastFourDigits})` : ""} - Fecha dia {c.closingDay}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Alerta de lançamento já existente no mês selecionado */}
                {(() => {
                  const targetYear = confirmFixedDate.split("-")[0];
                  const targetMonth = confirmFixedDate.split("-")[1];
                  const existingTx = getPostedTxForFixed(confirmingFixedTpl, targetYear, targetMonth);
                  if (existingTx) {
                    return (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-600 text-sm">⚠️</span>
                          <div className="text-xs">
                            <p className="font-bold text-amber-900 dark:text-amber-200">
                              Já existe lançamento deste fixo neste mês ({existingTx.date.split("-").reverse().join("/")} - R$ {existingTx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).
                            </p>
                            <label className="flex items-center gap-2 mt-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={confirmFixedUpdateExistingTx}
                                onChange={(e) => setConfirmFixedUpdateExistingTx(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Atualizar o lançamento já feito no extrato (em vez de duplicar)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Opção para atualizar o valor base cadastrado */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <input
                      type="checkbox"
                      checked={confirmFixedUpdateTemplate}
                      onChange={(e) => setConfirmFixedUpdateTemplate(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Atualizar também o valor base deste modelo fixo para R$ {confirmFixedAmountStr || "0,00"}</span>
                  </label>
                </div>
              </div>

              <div className="p-4 px-5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmingFixedTpl(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLaunchFixed}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✓</span>
                  <span>Confirmar e Lançar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE EDIÇÃO DO MODELO FIXO CADASTRADO E LANÇAMENTO NO MÊS */}
      <AnimatePresence>
        {editingFixedTpl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full relative max-h-[92vh] flex flex-col my-auto overflow-hidden">
              <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    editingFixedTpl.type === "entrada"
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                  }`}>
                    <Edit2 size={15} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      Editar {editingFixedTpl.type === "entrada" ? "Renda Fixa" : "Despesa Fixa"} Cadastrada
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Altere o valor base, vencimento e dados da recorrência
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingFixedTpl(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Descrição da Recorrência
                  </label>
                  <input
                    type="text"
                    value={editFixedDesc}
                    onChange={(e) => setEditFixedDesc(e.target.value)}
                    placeholder="Ex: Aluguel do Galpão, Salário, Internet..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Valor Base Padrão (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editFixedAmountStr}
                      onChange={(e) => setEditFixedAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Dia do Vencimento
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={editFixedDueDay}
                      onChange={(e) => setEditFixedDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={editFixedCategory}
                    onChange={(e) => setEditFixedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {categories
                      .filter(c => c.type === editingFixedTpl.type)
                      .map(cat => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sincronização com lançamento do mês se existir */}
                {(() => {
                  const targetYear = filterYear !== "todos" ? filterYear : String(new Date().getFullYear());
                  const targetMonth = filterMonth !== "todos" ? filterMonth : String(new Date().getMonth() + 1).padStart(2, "0");
                  const existingTx = getPostedTxForFixed(editingFixedTpl, targetYear, targetMonth);
                  
                  if (existingTx) {
                    return (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <p className="font-bold text-emerald-900 dark:text-emerald-200">
                              Lançamento encontrado no extrato deste mês ({targetMonth}/{targetYear}):
                            </p>
                            <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">
                              Data: {existingTx.date.split("-").reverse().join("/")} | Valor atual: R$ {existingTx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                            <label className="flex items-center gap-2 mt-2 cursor-pointer font-semibold text-emerald-950 dark:text-emerald-100">
                              <input
                                type="checkbox"
                                checked={editFixedUpdateMonthTx}
                                onChange={(e) => setEditFixedUpdateMonthTx(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Atualizar também o valor deste lançamento já lançado no mês</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="p-4 px-5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingFixedTpl(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditFixed}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Bulk Transfer and Interactive Deletion Modal */}
      <CategoryBulkTransferModal
        isOpen={isCategoryModalOpen}
        mode={categoryModalMode}
        initialSourceCategoryId={categoryModalSourceId}
        categories={categories}
        transactions={transactions}
        fixedTemplates={fixedTemplates}
        onClose={() => setIsCategoryModalOpen(false)}
        onTransfer={handleBulkTransferCategory}
        onDeleteCategory={handleConfirmDeleteCategory}
      />

      {/* Category Selection Modal on Save Entrada / Saida */}
      <CategorySelectionModal
        isOpen={categorySelectionModal.isOpen}
        type={categorySelectionModal.type}
        selectedCategory={categorySelectionModal.selectedCategory}
        categories={categories}
        transactionSummary={{
          description: formDescription.trim(),
          amount: parseCurrencyInput(formAmountStr) || 0,
          date: formDate,
          paymentMethod: formPaymentMethod,
          installmentsCount: formPaymentMethod === "cartao_credito" ? formInstallmentsCount : 1
        }}
        onSelectCategory={(catName) =>
          setCategorySelectionModal(prev => ({ ...prev, selectedCategory: catName }))
        }
        onConfirm={handleConfirmCategoryAndSave}
        onClose={() => setCategorySelectionModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* APP UPDATE MODAL & CHANGELOG VIEWER */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        isLoading={isCheckingUpdate}
        onCheckAgain={(simulate) => checkForUpdates(simulate, true)}
        onSnooze={handleSnoozeUpdate}
        onDismissVersion={handleDismissVersion}
      />

    </div>
  );
}
