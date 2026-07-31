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
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeadpageDashboard } from "./components/LeadpageDashboard";
import { CategoriesManager } from "./components/CategoriesManager";
import { ActivityLogPanel, ActivityLog } from "./components/ActivityLogPanel";
import { ExecutiveReportModal } from "./components/ExecutiveReportModal";
import { RentalReportModal } from "./components/RentalReportModal";
import { AccountantReportModal } from "./components/AccountantReportModal";
import { DepositDetailModal, calculateMonthsDifference } from "./components/DepositDetailModal";

// Interfaces
interface Caixa {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  caixaId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
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

const getRentalExpectedAmount = (rental: RentalProperty) => {
  return rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
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

const INITIAL_TRANSACTIONS = (): Transaction[] => {
  return [
    // --- MAIO 2026 (Mês Ativo) ---
    {
      id: "seed-may-1",
      caixaId: "principal",
      date: "2026-05-01",
      description: "Recebimento Salário CLT",
      amount: 6200.00,
      type: "entrada",
      category: "Salário"
    },
    {
      id: "seed-may-2",
      caixaId: "principal",
      date: "2026-05-05",
      description: "Venda de Licenças SaaS",
      amount: 5900.00,
      type: "entrada",
      category: "Vendas"
    },
    {
      id: "seed-may-3",
      caixaId: "principal",
      date: "2026-05-12",
      description: "Serviço de Consultoria Dev Extra",
      amount: 2500.00,
      type: "entrada",
      category: "Serviços"
    },
    {
      id: "seed-may-4",
      caixaId: "principal",
      date: "2026-05-15",
      description: "Aluguéis Recebidos - Casa Sol",
      amount: 1850.00,
      type: "entrada",
      category: "Aluguéis Ativos"
    },
    {
      id: "seed-may-5",
      caixaId: "principal",
      date: "2026-05-25",
      description: "Rendimento de Dividendos FIIs",
      amount: 480.00,
      type: "entrada",
      category: "Investimentos"
    },
    {
      id: "seed-may-6",
      caixaId: "principal",
      date: "2026-05-05",
      description: "Servidores Cloud Ingress Vercel",
      amount: 580.00,
      type: "saida",
      category: "Serviços Contratados"
    },
    {
      id: "seed-may-7",
      caixaId: "principal",
      date: "2026-05-10",
      description: "Supermercado Pão de Açúcar",
      amount: 720.00,
      type: "saida",
      category: "Alimentação"
    },
    {
      id: "seed-may-8",
      caixaId: "principal",
      date: "2026-05-11",
      description: "Aluguel Apartamento",
      amount: 2100.00,
      type: "saida",
      category: "Moradia (Aluguel/IPTU)"
    },
    {
      id: "seed-may-9",
      caixaId: "principal",
      date: "2026-05-15",
      description: "Uber / Combustível Premium",
      amount: 410.00,
      type: "saida",
      category: "Transporte"
    },
    {
      id: "seed-may-10",
      caixaId: "principal",
      date: "2026-05-20",
      description: "Energia Elétrica / Copel",
      amount: 198.00,
      type: "saida",
      category: "Contas de Consumo (Luz/Água)"
    },
    {
      id: "seed-may-11",
      caixaId: "principal",
      date: "2026-05-22",
      description: "Imposto Simples Nacional DAS",
      amount: 150.00,
      type: "saida",
      category: "Impostos & Tributos (IPTU/IR)"
    },

    // --- ABRIL 2026 (Mês Anterior para Comparação) ---
    {
      id: "seed-apr-1",
      caixaId: "principal",
      date: "2026-04-01",
      description: "Saldo Inicial de Caixa",
      amount: 12000.00,
      type: "entrada",
      category: "Salário"
    },
    {
      id: "seed-apr-2",
      caixaId: "principal",
      date: "2026-04-05",
      description: "Venda de Licenças SaaS",
      amount: 4800.00,
      type: "entrada",
      category: "Vendas"
    },
    {
      id: "seed-apr-3",
      caixaId: "principal",
      date: "2026-04-12",
      description: "Serviço de Consultoria Dev",
      amount: 3500.00,
      type: "entrada",
      category: "Serviços"
    },
    {
      id: "seed-apr-4",
      caixaId: "principal",
      date: "2026-04-15",
      description: "Aluguéis Recebidos - Casa Sol",
      amount: 1850.00,
      type: "entrada",
      category: "Aluguéis Ativos"
    },
    {
      id: "seed-apr-5",
      caixaId: "principal",
      date: "2026-04-25",
      description: "Rendimento FIIs (Dividendos)",
      amount: 420.00,
      type: "entrada",
      category: "Investimentos"
    },
    {
      id: "seed-apr-6",
      caixaId: "principal",
      date: "2026-04-05",
      description: "Servidor de Hospedagem AWS",
      amount: 420.00,
      type: "saida",
      category: "Serviços Contratados"
    },
    {
      id: "seed-apr-7",
      caixaId: "principal",
      date: "2026-04-10",
      description: "Supermercado Extra",
      amount: 650.00,
      type: "saida",
      category: "Alimentação"
    },
    {
      id: "seed-apr-8",
      caixaId: "principal",
      date: "2026-04-11",
      description: "Aluguel Apartamento",
      amount: 2100.00,
      type: "saida",
      category: "Moradia (Aluguel/IPTU)"
    },
    {
      id: "seed-apr-9",
      caixaId: "principal",
      date: "2026-04-15",
      description: "Manutenção Carro Empresa",
      amount: 350.00,
      type: "saida",
      category: "Transporte"
    },
    {
      id: "seed-apr-10",
      caixaId: "principal",
      date: "2026-04-20",
      description: "Energia Elétrica / Copel",
      amount: 220.00,
      type: "saida",
      category: "Contas de Consumo (Luz/Água)"
    },
    {
      id: "seed-apr-11",
      caixaId: "principal",
      date: "2026-04-22",
      description: "Imposto MEI Mensal",
      amount: 75.00,
      type: "saida",
      category: "Impostos & Tributos (IPTU/IR)"
    },
    {
      id: "seed-apr-12",
      caixaId: "principal",
      date: "2026-04-28",
      description: "Lazer - Jantar em Família",
      amount: 320.00,
      type: "saida",
      category: "Lazer"
    }
  ];
};

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
    return saved ? JSON.parse(saved) : [];
  });

  const [activeCaixaId, setActiveCaixaId] = useState<string>("principal");

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem("caixa_categorias");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing categories", err);
      }
    }
    const initial: Category[] = [];
    CATEGORIES_ENTRADA.forEach(name => {
      initial.push({
        id: `cat-in-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name,
        type: "entrada",
        color: CATEGORY_COLORS[name] || "bg-emerald-500"
      });
    });
    CATEGORIES_SAIDA.forEach(name => {
      initial.push({
        id: `cat-out-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name,
        type: "saida",
        color: CATEGORY_COLORS[name] || "bg-rose-500"
      });
    });
    return initial;
  });

  const getCategoryBgColor = (catName: string) => {
    const found = categories.find(c => c.name === catName);
    return found ? found.color : (CATEGORY_COLORS[catName] || "bg-zinc-500");
  };

  const getCategoryColorHex = (catName: string): string => {
    const found = categories.find(c => c.name === catName);
    const colorVal = found ? found.color : "";
    if (colorVal.startsWith("#")) return colorVal;
    
    const classMap: Record<string, string> = {
      "bg-emerald-500": "#10b981",
      "bg-cyan-500": "#06b6d4",
      "bg-indigo-500": "#6366f1",
      "bg-sky-500": "#0ea5e9",
      "bg-teal-500": "#14b8a6",
      "bg-amber-500": "#f59e0b",
      "bg-red-500": "#ef4444",
      "bg-orange-500": "#f97316",
      "bg-purple-600": "#a855f7",
      "bg-pink-500": "#ec4899",
      "bg-rose-500": "#f43f5e",
      "bg-violet-500": "#8b5cf6",
      "bg-zinc-500": "#71717a"
    };
    
    if (classMap[colorVal]) return classMap[colorVal];
    
    const defaultMap: Record<string, string> = {
      "Alimentação": "#f59e0b",
      "Moradia": "#ef4444",
      "Transporte": "#3b82f6",
      "Saúde": "#f43f5e",
      "Lazer": "#ec4899",
      "Impostos": "#a855f7",
      "Suprimentos": "#f97316",
      "Serviços Contratados": "#8b5cf6"
    };
    return defaultMap[catName] || "#71717a";
  };

  const getCategoryBadgeStyle = (catName: string, type: "entrada" | "saida" = "saida") => {
    const found = categories.find(c => c.name === catName);
    const colorClass = found ? found.color : (CATEGORY_COLORS[catName] || (type === "entrada" ? "bg-emerald-500" : "bg-zinc-500"));
    const mapped = COLOR_CLASSES_MAP[colorClass];
    if (mapped) return mapped.badge;
    return CATEGORY_BORDER_COLORS[catName] || (type === "entrada" ? "border-emerald-350 text-emerald-700 bg-emerald-50" : "border-zinc-300 text-zinc-700 bg-zinc-50");
  };

  // Filter conditions
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    return String(new Date().getMonth() + 1).padStart(2, "0");
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });

  // Current Input Form states
  const [formDate, setFormDate] = useState(() => {
    return getLocalDateInputValue();
  });
  const [formDescription, setFormDescription] = useState("");
  const [formAmountStr, setFormAmountStr] = useState("");
  const [formCategory, setFormCategory] = useState("Vendas");

  // Selection state for quick feedback categories
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Editing transaction state (Inline/Modal)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState<"entrada" | "saida" >("entrada");

  // Subtab for Extrato or Fixed templates
  const [subTab, setSubTab] = useState<"extrato" | "fixas" | "alugueis" | "categorias" | "logs" | "relatorio">("extrato");

  // Activity Logs implementation
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem("caixa_activity_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
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
        return JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing fixed templates", err);
      }
    }
    return [];
  });

  // Rental Properties (Gestão de Aluguéis LF) state
  const [rentals, setRentals] = useState<RentalProperty[]>(() => {
    const saved = localStorage.getItem("caixa_alugueis_fixos");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing rentals", err);
      }
    }
    return [];
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
      const totalVal = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount;
      
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
      
      const totalVal = r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount;
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
        valA = (a.rentAmount + a.waterAmount + a.iptuAmount + a.garbageAmount + a.lightAmount + a.fineAmount - a.adminFeeAmount);
        valB = (b.rentAmount + b.waterAmount + b.iptuAmount + b.garbageAmount + b.lightAmount + b.fineAmount - b.adminFeeAmount);
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

  // Deposit (Caução) form states
  const [newRentHasDeposit, setNewRentHasDeposit] = useState(false);
  const [newRentDepositMonths, setNewRentDepositMonths] = useState<number>(3);
  const [newRentDepositAmountStr, setNewRentDepositAmountStr] = useState("");
  const [newRentDepositStartDate, setNewRentDepositStartDate] = useState(() => {
    return getLocalDateInputValue();
  });
  const [newRentDepositInterestRateStr, setNewRentDepositInterestRateStr] = useState("0.5");

  // Selected rental for the Deposit details modal
  const [selectedDepositRental, setSelectedDepositRental] = useState<RentalProperty | null>(null);

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

  // States for interactive confirmation of rent payments with actual receive date
  const [receiptConfirmingRental, setReceiptConfirmingRental] = useState<RentalProperty | null>(null);
  const [receiptConfirmingPeriod, setReceiptConfirmingPeriod] = useState<string>("");
  const [receiptDateInput, setReceiptDateInput] = useState<string>("");
  const [receiptAmountInput, setReceiptAmountInput] = useState<string>("");
  const [receiptShortfallTreatment, setReceiptShortfallTreatment] = useState<"pending" | "forgiven">("pending");
  const [receiptLateFeeTreatment, setReceiptLateFeeTreatment] = useState<"suggested" | "waived">("suggested");

  const resetReceiptConfirmation = () => {
    setReceiptConfirmingRental(null);
    setReceiptConfirmingPeriod("");
    setReceiptDateInput("");
    setReceiptAmountInput("");
    setReceiptShortfallTreatment("pending");
    setReceiptLateFeeTreatment("suggested");
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
  }, [caixas, transactions, fixedTemplates, rentals, categories, activityLogs]);

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
      activityLogs,
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
        const mergedCategories = mergeArraysById<Category>(categories, driveData.categories || []);
        const mergedLogs = mergeArraysById<ActivityLog>(activityLogs, driveData.activityLogs || [])
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Update states in React
        setCaixas(mergedCaixas);
        setTransactions(mergedTransactions);
        setFixedTemplates(mergedTemplates);
        setRentals(mergedRentals);
        setCategories(mergedCategories);
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
          activityLogs: mergedLogs,
          lastUpdated: newTS
        };
        await uploadToGoogleDrive(combinedData);
        console.log("Successfully performed Smart Merge and updated Google Drive.");
      }

      setSyncStatus("synced");
    } catch (err: any) {
      console.error("Error restoring/syncing with Google Drive:", err);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        console.log("Token expired during download. Triggering silent refresh...");
        requestSilentToken();
      } else {
        setSyncStatus("error");
      }
    }
  };

  const triggerAutoBackup = () => {
    const currentToken = accessToken || localStorage.getItem("caixa_google_token");
    if (!currentToken && !isGoogleConnected) return;

    setSyncStatus("syncing");

    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
    }

    uploadTimeoutRef.current = setTimeout(async () => {
      try {
        await uploadToGoogleDrive();
        setSyncStatus("synced");
      } catch (err: any) {
        console.error("Auto-backup failed:", err);
        if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
          console.log("Token expired. Trying to refresh silently...");
          requestSilentToken();
        } else {
          setSyncStatus("error");
        }
      }
    }, 4000);
  };

  const requestSilentToken = () => {
    if (!googleClientId) return;
    try {
      setSyncStatus("syncing");
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "https://www.googleapis.com/auth/drive.appdata",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.warn("Silent token request failed:", tokenResponse.error);
            handleLogoutGoogle();
            return;
          }
          const token = tokenResponse.access_token;
          setAccessToken(token);
          localStorage.setItem("caixa_google_token", token);
          localStorage.setItem("caixa_google_token_expiry", String(Date.now() + 3500 * 1000));
          setIsGoogleConnected(true);
          await fetchGoogleUserInfo(token);
          await downloadAndRestoreFromGoogleDrive(token);
        }
      });
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (err) {
      console.warn("Failed to initiate silent token client:", err);
      setSyncStatus("error");
    }
  };

  const handleConnectGoogle = () => {
    if (!googleClientId) {
      setIsGoogleConfigModalOpen(true);
      return;
    }

    try {
      setSyncStatus("syncing");
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
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
      tokenClient.requestAccessToken({ prompt: "consent" });
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

  // Startup silent login/sync
  useEffect(() => {
    if (localStorage.getItem("caixa_google_connected") === "true" && googleClientId) {
      const checkInterval = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2?.initTokenClient) {
          clearInterval(checkInterval);
          requestSilentToken();
        }
      }, 500);
      
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }, [googleClientId]);

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
    const selected = categories.find(c => c.name === categoryName);
    if (selected?.type === type) return selected.name;
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

        return true;
      })
      // Sort oldest to newest (to visualize like a chronologic balance sheet) or vice-versa? 
      // Financial statements look great newest first, but running balance works oldest first.
      // Let's sort newest first for ledger entries so they are easy to edit.
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, activeCaixaId, filterMonth, filterYear, searchQuery]);

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
          accumulated -= t.amount;
        }
      }
    });

    return accumulated;
  }, [transactions, activeCaixaId, filterMonth, filterYear]);

  // Aggregations computed
  const totals = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    filteredTransactions.forEach(t => {
      if (t.type === "entrada") {
        entrada += t.amount;
      } else {
        saida += t.amount;
      }
    });
    return {
      entrada,
      saida,
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

  // Actions
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

    const safeCategory = resolveCategoryForType(formCategory, type);
    const newTx: Transaction = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      caixaId: activeCaixaId,
      date: formDate,
      description: formDescription.trim(),
      amount: rawVal,
      type,
      category: safeCategory
    };

    if (safeCategory !== formCategory) {
      setFormCategory(safeCategory);
    }
    setTransactions(prev => [newTx, ...prev]);

    // Add log entry
    addLogEntry(
      type === "entrada" ? "receita" : "despesa",
      `Lançamento manual registrado: "${newTx.description}" na categoria "${newTx.category}" no valor de ${newTx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      newTx.amount
    );

    // Reset fields except date for easier fast inputs
    setFormDescription("");
    setFormAmountStr("");
    setIsCategoryDropdownOpen(false);

    // Dynamic toast logic can be visual
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
    setEditDate(t.date);
    setEditDescription(t.description);
    setEditAmountStr(String(t.amount).replace(".", ","));
    setEditCategory(t.category);
    setEditType(t.type);
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
        return {
          ...t,
          date: editDate,
          description: editDescription.trim(),
          amount: rawVal,
          category: editCategory,
          type: editType
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
    setActiveCaixaId("principal");
    setFilterMonth(String(new Date().getMonth() + 1).padStart(2, "0"));
    setFilterYear(String(new Date().getFullYear()));
    setSearchQuery("");
    setAiInsights(null);
    setIsResetConfirmOpen(false);
    setActivityLogs([]);
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

  const handlePostFixedTemplate = (tpl: FixedTemplate) => {
    const today = new Date();
    const targetYear = filterYear !== "todos" ? filterYear : String(today.getFullYear());
    const targetMonth = filterMonth !== "todos" ? filterMonth : String(today.getMonth() + 1).padStart(2, "0");
    const actualDueDay = clampDayToMonth(targetYear, targetMonth, tpl.dueDay);
    const paddedDay = String(actualDueDay).padStart(2, "0");
    const launchDate = `${targetYear}-${targetMonth}-${paddedDay}`;

    const newTx: Transaction = {
      id: "tx-posted-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      caixaId: tpl.caixaId || activeCaixaId,
      date: launchDate,
      description: `[Fixo] ${tpl.description}`,
      amount: tpl.amount,
      type: tpl.type,
      category: resolveCategoryForType(tpl.category, tpl.type)
    };

    setTransactions(prev => [newTx, ...prev]);
    
    addLogEntry(
      "modelo_fixo",
      `Lançamento fixo executado no extrato: "${tpl.description}" (Vencimento Dia ${tpl.dueDay}) no valor de ${tpl.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      tpl.amount
    );

    alert(`Sucesso! "${tpl.description}" lançado no extrato na data de ${formatDateBRL(launchDate)}.`);
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
      hasDeposit: newRentHasDeposit,
      depositMonthsCount: newRentHasDeposit ? newRentDepositMonths : undefined,
      depositAmount: newRentHasDeposit ? (parseFormattedVal(newRentDepositAmountStr) || (rentAmount * newRentDepositMonths)) : undefined,
      depositStartDate: newRentHasDeposit ? (newRentDepositStartDate || getLocalDateInputValue()) : undefined,
      depositInterestRate: newRentHasDeposit ? (parseCurrencyInput(newRentDepositInterestRateStr) || 0.5) : undefined
    };

    setRentals(prev => [newRental, ...prev]);

    // Add log entry
    addLogEntry(
      "cadastro_aluguel",
      `Novo imóvel cadastrado sob o código ${newRental.lfCode} para o inquilino "${newRental.tenantName}" com aluguel base de R$ ${newRental.rentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${newRental.hasDeposit ? ` Depósito de caução registrado: R$ ${newRental.depositAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : ""}`
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
          hasDeposit: editRentHasDeposit,
          depositMonthsCount: editRentHasDeposit ? editRentDepositMonths : undefined,
          depositAmount: editRentHasDeposit ? (parseFormattedVal(editRentDepositAmountStr) || (rentAmount * editRentDepositMonths)) : undefined,
          depositStartDate: editRentHasDeposit ? editRentDepositStartDate : undefined,
          depositInterestRate: editRentHasDeposit ? (parseCurrencyInput(editRentDepositInterestRateStr) || 0.5) : undefined
        };
      }
      return r;
    }));

    addLogEntry(
      "edicao_aluguel",
      `Imóvel atualizado: Código ${editRentLf.trim().toUpperCase()} - Inquilino "${editRentTenant.trim()}" editado com sucesso.`
    );

    setEditingRental(null);
  };

  const handleCreateCategory = (name: string, type: "entrada" | "saida", color: string) => {
    const formattedName = name.trim();
    if (!formattedName) {
      alert("Por favor, digite o nome da categoria.");
      return;
    }
    
    const exists = categories.some(c => c.name.toLowerCase() === formattedName.toLowerCase());
    if (exists) {
      alert("Já existe uma categoria cadastrada com este nome.");
      return;
    }

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: formattedName,
      type,
      color
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
    
    if (formattedNewName.toLowerCase() !== oldName.toLowerCase()) {
      const exists = categories.some(c => c.id !== id && c.name.toLowerCase() === formattedNewName.toLowerCase());
      if (exists) {
        alert("Já existe outra categoria cadastrada com este nome.");
        return;
      }
    }

    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, name: formattedNewName, color: newColor };
      }
      return c;
    }));

    if (formattedNewName !== oldName) {
      // Propagation
      setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: formattedNewName } : t));
      setFixedTemplates(prev => prev.map(tpl => tpl.category === oldName ? { ...tpl, category: formattedNewName } : tpl));
    }
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const entryCount = categories.filter(c => c.type === cat.type).length;
    if (entryCount <= 1) {
      alert(`Você precisa manter pelo menos uma categoria de ${cat.type === "entrada" ? "entrada" : "saída"}.`);
      return;
    }

    const inUseTxs = transactions.some(t => t.category === cat.name);
    const inUseTpl = fixedTemplates.some(tpl => tpl.category === cat.name);

    if (inUseTxs || inUseTpl) {
      if (!confirm(`A categoria "${cat.name}" está em uso por transações ou contas recorrentes. Ao excluí-la, essas transações serão categorizadas como "${cat.type === "entrada" ? "Outras Receitas" : "Outras Despesas"}". Deseja mesmo prosseguir?`)) {
        return;
      }
      const fallback = cat.type === "entrada" ? "Outras Receitas" : "Outras Despesas";
      
      // Auto-create fallback if it doesn't exist
      const fallbackExists = categories.some(c => c.name === fallback);
      if (!fallbackExists) {
        // Safe fallback insertion
        setCategories(prev => [
          ...prev.filter(c => c.id !== id),
          { id: `cat-fallback-${Date.now()}`, name: fallback, type: cat.type, color: cat.type === "entrada" ? "bg-slate-400" : "bg-zinc-500" }
        ]);
      } else {
        setCategories(prev => prev.filter(c => c.id !== id));
      }

      setTransactions(prev => prev.map(t => t.category === cat.name ? { ...t, category: fallback } : t));
      setFixedTemplates(prev => prev.map(tpl => tpl.category === cat.name ? { ...tpl, category: fallback } : tpl));
    } else {
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleToggleRentalPaid = (rental: RentalProperty) => {
    const today = new Date();
    const targetYear = filterYear !== "todos" ? filterYear : String(today.getFullYear());
    const targetMonth = filterMonth !== "todos" ? filterMonth : String(today.getMonth() + 1).padStart(2, "0");
    const period = `${targetYear}-${targetMonth}`;

    const isPaid = rental.paidPeriods.includes(period);
    const valorAReceber = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
    
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

        // Delete associated transaction
        const targetTxId = `tx-rent-${rental.id}-${period}`;
        setTransactions(prev => prev.filter(t => t.id !== targetTxId));
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
    lateFeeTreatment: "suggested" | "waived"
  ) => {
    if (!receivedDateStr) {
      alert("Informe a data efetiva do recebimento.");
      return;
    }
    if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) {
      alert("Informe o valor realmente recebido da imobiliária.");
      return;
    }

    const latestRental = rentals.find(r => r.id === rental.id) || rental;
    if (latestRental.paidPeriods.includes(period)) {
      resetReceiptConfirmation();
      return;
    }

    const valorAReceber = getRentalExpectedAmount(rental);
    const periodStr = formatPeriodBRL(period);
    const amountDifference = Number((valorAReceber - receivedAmount).toFixed(2));
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

    const adjustment: RentalPaymentAdjustment = {
      period,
      expectedAmount: valorAReceber,
      receivedAmount,
      difference: amountDifference,
      status: adjustmentStatus,
      dueDate,
      graceDate,
      receivedDate: receivedDateStr,
      daysAfterDue,
      daysAfterGrace,
      lateFeeStatus,
      createdAt: new Date().toISOString(),
      note: amountDifference > 0
        ? (adjustmentStatus === "pending" ? "Diferença anexada ao próximo mês para cobrança da imobiliária." : "Diferença aliviada no fechamento.")
        : amountDifference < 0
          ? "Recebimento acima do valor esperado."
          : "Recebimento integral."
    };

    // Toggle ON with stored date
    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        return {
          ...r,
          paidPeriods: Array.from(new Set([...r.paidPeriods, period])),
          paymentDates: {
            ...(r.paymentDates || {}),
            [period]: receivedDateStr
          },
          paymentAmounts: {
            ...(r.paymentAmounts || {}),
            [period]: receivedAmount
          },
          paymentAdjustments: {
            ...(r.paymentAdjustments || {}),
            [period]: adjustment
          }
        };
      }
      return r;
    }));

    // Create transaction with full breakdown details in description
    const details = [];
    if (rental.rentAmount > 0) details.push(`Aluguel: R$${rental.rentAmount}`);
    if (rental.waterAmount > 0) details.push(`Água: R$${rental.waterAmount}`);
    if (rental.iptuAmount > 0) details.push(`IPTU: R$${rental.iptuAmount}`);
    if (rental.garbageAmount > 0) details.push(`Lixo: R$${rental.garbageAmount}`);
    if (rental.lightAmount > 0) details.push(`Luz: R$${rental.lightAmount}`);
    if (rental.fineAmount > 0) details.push(`Multa: R$${rental.fineAmount}`);
    if (rental.adminFeeAmount > 0) details.push(`Tx Adm: -R$${rental.adminFeeAmount}`);

    let delayText = "";
    if (daysAfterDue === 0) {
      delayText = "No vencimento";
    } else if (daysAfterDue < 0) {
      delayText = `Adiantado ${Math.abs(daysAfterDue)} dias`;
    } else {
      delayText = `Atrasado ${daysAfterDue} dias`;
    }

    const graceText = daysAfterGrace > 0
      ? `Repasse passou ${daysAfterGrace} ${daysAfterGrace === 1 ? "dia" : "dias"} da tolerância de 2 dias`
      : "Dentro da tolerância de 2 dias da imobiliária";
    const differenceText = amountDifference > 0
      ? `Diferença a cobrar: R$ ${amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : amountDifference < 0
        ? `Recebido a mais: R$ ${Math.abs(amountDifference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "Valor recebido integral";

    const newTx: Transaction = {
      id: `tx-rent-${rental.id}-${period}`,
      caixaId: rental.caixaId || activeCaixaId,
      date: receivedDateStr,
      description: `[Aluguel ${rental.lfCode}] ${rental.tenantName} - Ref. ${periodStr} (${details.join(", ")}) [Rec: ${receivedDateStr.split("-").reverse().join("/")} - ${delayText}; ${graceText}; ${differenceText}]`,
      amount: receivedAmount,
      type: "entrada",
      category: resolveCategoryForType("Aluguéis Ativos", "entrada")
    };

    setTransactions(prev => [newTx, ...prev]);

    // Add log entry
    addLogEntry(
      "reconciliacao_confirmar",
      `Aluguel conciliado para o inquilino "${rental.tenantName}" (${rental.lfCode}) referente a ${periodStr}. Recebido em ${receivedDateStr.split("-").reverse().join("/")} (${delayText}; ${graceText}). Esperado: R$ ${valorAReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}; recebido: R$ ${receivedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}; ${differenceText}.`,
      receivedAmount
    );

    // Reset state
    resetReceiptConfirmation();
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
      activityLogs,
      includeSaldoAnterior,
      version: "1.3",
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
    const headers = "Data;Descrição;Subcategoria;Tipo;Valor Recebido;Valor Pago;Caixa\n";
    const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const getCaixaNameForExport = (caixaId?: string) => caixas.find(c => c.id === caixaId)?.name || "Sem caixa";
    const rows = filteredTransactions.map(t => {
      const formattedDate = formatDateBRL(t.date);
      const entrada = t.type === "entrada" ? t.amount.toFixed(2).replace(".", ",") : "";
      const saida = t.type === "saida" ? t.amount.toFixed(2).replace(".", ",") : "";
      return [
        csvEscape(formattedDate),
        csvEscape(t.description),
        csvEscape(t.category),
        csvEscape(t.type === "entrada" ? "Entrada" : "Saída"),
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

  // Clean SVG Dynamic Donut Chart Logic helper
  const donutRingParts = useMemo(() => {
    const expensesTotal = categoryStats.filter(s => s.type === "saida").reduce((acc, s) => acc + s.total, 0);
    if (expensesTotal === 0) return [];

    let currentAngle = -90; // Start top
    return categoryStats
      .filter(s => s.type === "saida")
      .map(s => {
        const percentage = s.total / expensesTotal;
        const angleSize = percentage * 360;
        const start = currentAngle;
        currentAngle += angleSize;

        // Path calculation for a lovely continuous SVG ring
        const radius = 38;
        const x1 = 50 + radius * Math.cos((start * Math.PI) / 180);
        const y1 = 50 + radius * Math.sin((start * Math.PI) / 180);
        const x2 = 50 + radius * Math.cos((currentAngle * Math.PI) / 180);
        const y2 = 50 + radius * Math.sin((currentAngle * Math.PI) / 180);
        const largeArc = angleSize > 180 ? 1 : 0;

        const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
        return {
          ...s,
          path,
          percentage: (percentage * 100).toFixed(1)
        };
      });
  }, [categoryStats]);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetReceiptConfirmation}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md relative z-10 p-6 flex flex-col"
        >
          {/* Close */}
          <button
            type="button"
            onClick={resetReceiptConfirmation}
            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
          >
            <X size={15} />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="p-1.5 bg-emerald-50 text-emerald-750 rounded-lg">
              <Check size={16} />
            </span>
            <h3 className="font-bold text-sm text-slate-800">Confirmar Recebimento de Aluguel</h3>
          </div>

          <p className="text-xs text-slate-500 mb-4 leading-normal">
            Registre os detalhes de quitação do aluguel do imóvel <strong>{rental.lfCode}</strong> ({rental.tenantName}) para o relatório de auditoria e prestação de contas.
          </p>

          <div className="space-y-4 text-xs">
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

            {receiptAmountInput && Math.abs(amountDifference) >= 0.01 && (
              <div className={`p-3 rounded-xl border ${
                amountDifference > 0
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-sky-50/70 border-sky-200 text-sky-900"
              }`}>
                <p className="font-bold text-[11px]">
                  {amountDifference > 0
                    ? `Recebido a menos: R$ ${amountDifference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : `Recebido a mais: R$ ${Math.abs(amountDifference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </p>
                {amountDifference > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setReceiptShortfallTreatment("pending")}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                        receiptShortfallTreatment === "pending" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-800 border-amber-200"
                      }`}
                    >
                      Cobrar no próximo mês
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptShortfallTreatment("forgiven")}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                        receiptShortfallTreatment === "forgiven" ? "bg-slate-700 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      Aliviar diferença
                    </button>
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

            {/* Save / Cancel buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={resetReceiptConfirmation}
                className="flex-1 py-2 bg-slate-100 text-slate-650 hover:bg-slate-200/80 font-bold rounded-xl transition cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!receiptDateInput) return;
                  handleConfirmRentalPaidWithDetails(
                    rental,
                    period,
                    receiptDateInput,
                    receivedAmount,
                    receiptShortfallTreatment,
                    receiptLateFeeTreatment
                  );
                }}
                className="flex-1 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl transition cursor-pointer text-center shadow-xs"
              >
                Confirmar Recebimento
              </button>
            </div>
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
      .reduce((sum, r) => sum + r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount, 0);

    const totalPaidVal = paidList.reduce((sum, { rental }) => {
      const netVal = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
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
                        const netVal = rental.rentAmount + rental.waterAmount + rental.iptuAmount + rental.garbageAmount + rental.lightAmount + rental.fineAmount - rental.adminFeeAmount;
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
            <div className="text-[11px] text-rose-600 font-semibold mt-4">
              Despesas e retiradas efetuadas
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

            {/* Category selection and suggestions Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center mb-6">
              
              {/* Category Dropdown Selector */}
              <div className="md:col-span-5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block select-none">
                  Categoria
                </label>
                
                <div ref={categoryDropdownRef} className="relative">
                  <button
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-3 text-sm text-slate-700 flex items-center justify-between outline-none transition text-left"
                  >
                    <span className="flex items-center gap-2">
                      {(() => {
                        const colorVal = getCategoryBgColor(formCategory);
                        const isHex = colorVal.startsWith("#");
                        return (
                          <span 
                            className={`h-2.5 w-2.5 rounded-full ${!isHex ? colorVal : ""}`}
                            style={isHex ? { backgroundColor: colorVal } : undefined}
                          ></span>
                        );
                      })()}
                      {formCategory}
                    </span>
                    <ChevronRight size={14} className={`transform transition duration-200 ${isCategoryDropdownOpen ? "rotate-90" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-55 p-2">
                        <div className="p-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-emerald-600 uppercase tracking-wider select-none">
                          Categorias de Entrada
                        </div>
                        {categories.filter(c => c.type === "entrada").map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setFormCategory(cat.name);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-2"
                          >
                            <span className={`h-2 w-2 rounded-full ${cat.color}`}></span>
                            {cat.name}
                          </button>
                        ))}

                        <div className="p-1 mt-2 mb-1 border-b border-slate-100 text-[10px] font-bold text-rose-500 uppercase tracking-wider select-none">
                          Categorias de Saída
                        </div>
                        {categories.filter(c => c.type === "saida").map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setFormCategory(cat.name);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-2"
                          >
                            <span className={`h-2 w-2 rounded-full ${cat.color}`}></span>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Suggestions */}
              <div className="md:col-span-7 select-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sugestões frequentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickTemplateSuggestions.length > 0 ? (
                    quickTemplateSuggestions.map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setFormDescription(item.description);
                          setFormCategory(item.lastCategory);
                          setFormAmountStr(item.lastAmount > 0 ? item.lastAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
                        }}
                        title={`Clique para preencher.\nÚltimo: R$ ${item.lastAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} na categoria ${item.lastCategory} (${item.count} ocorrescência(s))`}
                        className={`text-[11px] border bg-white px-2.5 py-1.5 rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-3xs ${
                          item.lastType === "entrada"
                            ? "border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-800"
                            : "border-slate-100 hover:border-rose-200 hover:bg-rose-50/50 text-slate-700 hover:text-rose-800"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${item.lastType === "entrada" ? "bg-emerald-500" : "bg-rose-500"} flex-shrink-0`}></span>
                        <span className="font-semibold">{item.description}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic font-mono">Nenhum histórico disponível</span>
                  )}
                </div>
              </div>

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

          {/* Analytics Overview Column */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 select-none">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <PieChart size={16} className="text-indigo-650" />
                  Divisão de Despesas
                </h2>
                <span className="text-[10px] font-bold uppercase bg-blue-100/70 text-blue-800 px-2 py-0.5 rounded-full">
                  Mês Atual
                </span>
              </div>

              {/* Dynamic SVG Donut Chart */}
              {donutRingParts.length > 0 ? (
                <div className="flex items-center gap-4 py-3">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-95">
                      {/* Grey background circle */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                      {/* Active category slices */}
                      {donutRingParts.map((ring, idx) => (
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Saídas</span>
                      <span className="text-xs font-extrabold text-slate-700">R$ {totals.saida.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Tiny Legend */}
                  <div className="flex-1 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {donutRingParts.slice(0, 4).map((r, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <div className="flex items-center gap-1 min-w-0">
                          {(() => {
                            const colorVal = getCategoryBgColor(r.name);
                            const isHex = colorVal.startsWith("#");
                            return (
                              <span 
                                className={`h-2 w-2 rounded-full flex-shrink-0 ${!isHex ? colorVal : ""}`}
                                style={isHex ? { backgroundColor: colorVal } : undefined}
                              ></span>
                            );
                          })()}
                          <span className="text-slate-600 truncate font-semibold">{r.name}</span>
                        </div>
                        <span className="font-mono text-slate-500 text-[10px]">{r.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-2">
                    <Grid size={18} />
                  </div>
                  <p className="text-xs text-slate-400 italic">Nenhuma saída registrada no período para gerar gráficos.</p>
                </div>
              )}
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
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg"><FileSpreadsheet size={18} /></span>
                  Controlador Financeiro
                </h2>
                <p className="text-xs text-slate-450 mt-0.5">Lançamentos e Recorrências de {activeCaixa.name}</p>
              </div>

              {/* Subtab Buttons */}
              <div className="flex flex-wrap gap-1.5 bg-slate-50 border border-slate-200/80 p-1.5 rounded-2xl w-fit shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSubTab("extrato")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "extrato"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  📋 Extrato de Lançamentos
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("fixas")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "fixas"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  🔄 Contas e Rendas Fixas
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("alugueis")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "alugueis"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  🏢 Contratos de Aluguel (LF)
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("relatorio")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "relatorio"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  📊 Relatório da Imobiliária
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("categorias")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "categorias"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  🏷️ Gerenciar Categorias
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("logs")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 select-none cursor-pointer tracking-tight flex items-center gap-1.5 ${
                    subTab === "logs"
                      ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                  }`}
                >
                  📖 Prontuário & Logs
                </button>
              </div>
            </div>

            {/* Render table header actions only if in extrato tab */}
            {subTab === "extrato" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-60">
                  <Search size={14} className="absolute left-3.5 top-3 pr-0.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar descrição ou categoria..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:bg-white transition"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* CSV Downloader */}
                <button
                  onClick={exportToCSV}
                  disabled={filteredTransactions.length === 0}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Exportar dados atuais para planilha Excel"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Exportar Planilha</span>
                </button>

                {/* PDF Executive Report Generator */}
                <button
                  type="button"
                  onClick={() => setIsExecutiveReportOpen(true)}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer hover:shadow-xs"
                  title="Gerar e imprimir relatório executivo para gestores da empresa"
                >
                  <Printer size={13} />
                  <span>Relatório Executivo PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAccountantReportOpen(true)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer hover:shadow-xs"
                  title="Gerar dossie contabil e organizador de Imposto de Renda para contador"
                >
                  <FileSpreadsheet size={13} />
                  <span>Dossie Contabil / IR</span>
                </button>
              </div>
            )}

            {subTab === "alugueis" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* New Dedicated Rental PDF Report Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRentalIdForReport(null);
                    setIsRentalReportOpen(true);
                  }}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-indigo-650 hover:from-emerald-700 hover:to-indigo-750 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow"
                  title="Imprimir relatório separado de cobrança de aluguéis, com recebidos e pendentes"
                >
                  <Printer size={13} />
                  <span>Relatório de Cobrança</span>
                </button>

                {/* PDF Executive Report Generator */}
                <button
                  type="button"
                  onClick={() => setIsExecutiveReportOpen(true)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-[11px] transition flex items-center gap-1 cursor-pointer"
                  title="Imprimir relatório executivo consolidado do caixa"
                >
                  <span>Executivo Geral</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAccountantReportOpen(true)}
                  className="px-2.5 py-2 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl text-[11px] transition flex items-center gap-1 cursor-pointer"
                  title="Imprimir dossie contabil com despesas, contas e anexos para contador"
                >
                  <span>Contabil / IR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNewRentForm(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100 border border-indigo-500 hover:shadow"
                  title="Adicionar novo contrato de aluguel"
                >
                  <Plus size={14} />
                  <span>Cadastrar Novo Aluguel (LF)</span>
                </button>
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
                              <span className="font-mono text-slate-500 font-medium">
                                {formatDateBRL(t.date)}
                              </span>
                            )}
                          </td>

                          {/* Transaction Description Column */}
                          <td className="px-5 py-3.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full max-w-xs"
                              />
                            ) : (
                              <div className="font-semibold text-slate-700 leading-snug">
                                {t.description}
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
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                getCategoryBadgeStyle(t.category, t.type)
                              }`}>
                                {(() => {
                                  const colorVal = getCategoryBgColor(t.category);
                                  const isHex = colorVal.startsWith("#");
                                  return (
                                    <span 
                                      className={`h-1.5 w-1.5 rounded-full ${!isHex ? colorVal : ""}`}
                                      style={isHex ? { backgroundColor: colorVal } : undefined}
                                    ></span>
                                  );
                                })()}
                                {t.category}
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
                                <span className="text-rose-600 font-mono text-sm">
                                  - R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
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
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 w-max mb-1.5">
                              <Clock size={10} />
                              Todo Dia {tpl.dueDay}
                            </span>
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
                                onClick={() => handlePostFixedTemplate(tpl)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                title="Inserir lançamento direto no fluxo do mês"
                              >
                                ⚡ Lançar
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
                            <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 w-max mb-1.5">
                              <Clock size={10} />
                              Vence Dia {tpl.dueDay}
                            </span>
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
                                onClick={() => handlePostFixedTemplate(tpl)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                title="Registrar quitação de despesa no extrato do mês"
                              >
                                ⚡ Lançar
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
                          .reduce((sum, r) => sum + r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount, 0)
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
                          .reduce((sum, r) => sum + r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount, 0)
                          .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em aberto
                  </span>
                </div>
                <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-450 font-semibold text-slate-800">Totalizável Líquido</span>
                  <span className="text-lg font-mono font-bold text-indigo-700">
                    R$ {rentals
                          .filter(r => !r.caixaId || r.caixaId === activeCaixaId)
                          .reduce((sum, r) => sum + r.rentAmount + r.waterAmount + r.iptuAmount + r.garbageAmount + r.lightAmount + r.fineAmount - r.adminFeeAmount, 0)
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
                                const totalPropertyReceivable = totalSummed - rental.adminFeeAmount;
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
                                        
                                        <div className="mt-1 flex items-center">
                                          {rental.hasDeposit ? (
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
                                              onClick={() => setSelectedDepositRental(rental)}
                                              className="inline-flex items-center gap-0.5 bg-slate-50 hover:bg-indigo-50/70 hover:text-indigo-700 text-slate-450 font-bold text-[8.5px] px-1.5 py-0.5 rounded-md border border-slate-200 hover:border-indigo-200 transition cursor-pointer select-none active:scale-95"
                                              title="Clique para vincular uma caução a este aluguel"
                                            >
                                              <Lock size={8} className="opacity-50" />
                                              <span>Adicionar Caução</span>
                                            </button>
                                          )}
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
                                <td colSpan={14} className="p-12 text-center text-slate-400">
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
                                const totalPropertyReceivable = totalSummed - rental.adminFeeAmount;
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
                                        
                                        <div className="mt-1 flex items-center">
                                          {rental.hasDeposit && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedDepositRental(rental)}
                                              className="inline-flex items-center gap-1 bg-emerald-100/50 hover:bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer select-none active:scale-95"
                                            >
                                              <Lock size={9} className="text-emerald-600" />
                                              <span>Caução vinculada</span>
                                            </button>
                                          )}
                                        </div>
                                        {currentAdjustment && Math.abs(currentAdjustment.difference) >= 0.01 && (
                                          <div className={`mt-1.5 rounded-lg border px-2 py-1 text-[9px] font-bold ${
                                            currentAdjustment.difference > 0
                                              ? "border-amber-200 bg-amber-50 text-amber-900"
                                              : "border-sky-200 bg-sky-50 text-sky-800"
                                          }`}>
                                            {currentAdjustment.difference > 0
                                              ? `Recebido a menos: R$ ${currentAdjustment.difference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                              : `Recebido a mais: R$ ${Math.abs(currentAdjustment.difference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                            {currentAdjustment.status === "pending" && (
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => handleResolveRentalDifference(rental.id, activePeriodStr, "charged")}
                                                  className="rounded-md bg-amber-600 px-1.5 py-0.5 text-white"
                                                >
                                                  Cobrado
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleResolveRentalDifference(rental.id, activePeriodStr, "forgiven")}
                                                  className="rounded-md bg-white px-1.5 py-0.5 text-slate-600 border border-slate-200"
                                                >
                                                  Aliviar
                                                </button>
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
                                <td colSpan={14} className="p-8 text-center text-slate-400">
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

                        {/* DEPOSIT (CAUÇÃO) SECTION */}
                        <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-755 text-[11px] mb-1.5 select-none">
                            <input
                              type="checkbox"
                              checked={newRentHasDeposit}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setNewRentHasDeposit(checked);
                                if (checked) {
                                  const rentVal = parseFloat(newRentAmountStr.replace(",", ".")) || 0;
                                  setNewRentDepositAmountStr((rentVal * newRentDepositMonths).toFixed(2).replace(".", ","));
                                }
                              }}
                              className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-550 border-slate-300 cursor-pointer"
                            />
                            <span>Possui Caução de Garantia?</span>
                          </label>

                          {newRentHasDeposit && (
                            <div className="mt-1 space-y-3 pt-2.5 border-t border-slate-200 overflow-hidden">
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
                                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
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
                                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
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

                        {/* PREVIEW MATH BLOCK */}
                        <div className="bg-indigo-950 text-indigo-100 p-4 rounded-xl space-y-2 mt-4 shadow-sm">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-90 border-b border-indigo-900 pb-1.5">
                            <span>Resumo Detalhado</span>
                            <span>Visualização Líquida</span>
                          </div>
                          <div className="space-y-1 font-mono text-[11px] opacity-80 leading-normal">
                            <div className="flex justify-between">
                              <span>Aluguel:</span>
                              <span>R$ {(parseFloat(newRentAmountStr.replace(",", ".")) || 0).toFixed(2)}</span>
                            </div>
                            {((parseFloat(newRentWaterStr.replace(",", ".")) || 0) > 0 || (parseFloat(newRentIptuStr.replace(",", ".")) || 0) > 0 || (parseFloat(newRentLightStr.replace(",", ".")) || 0) > 0 || (parseFloat(newRentGarbageStr.replace(",", ".")) || 0) > 0 || (parseFloat(newRentFineStr.replace(",", ".")) || 0) > 0) && (
                              <div className="flex justify-between">
                                <span>Encargos (Consumo/Tributos):</span>
                                <span>R$ {((parseFloat(newRentWaterStr.replace(",", ".")) || 0) + (parseFloat(newRentIptuStr.replace(",", ".")) || 0) + (parseFloat(newRentGarbageStr.replace(",", ".")) || 0) + (parseFloat(newRentLightStr.replace(",", ".")) || 0) + (parseFloat(newRentFineStr.replace(",", ".")) || 0)).toFixed(2)}</span>
                              </div>
                            )}
                            {(parseFloat(newRentAdminFeePercentStr.replace(",", ".")) || 0) > 0 && (
                              <div className="flex justify-between text-rose-300">
                                <span>(-) Taxa Administração ({parseFloat(newRentAdminFeePercentStr.replace(",", "."))}%):</span>
                                <span>- R$ {(((parseFloat(newRentAmountStr.replace(",", ".")) || 0) * (parseFloat(newRentAdminFeePercentStr.replace(",", ".")) || 0)) / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-indigo-900 font-bold">
                            <span className="text-xs uppercase">Recebimento Líquido</span>
                            <span className="text-sm font-mono text-emerald-300">
                              R$ {((parseFloat(newRentAmountStr.replace(",", ".")) || 0) + 
                                   (parseFloat(newRentWaterStr.replace(",", ".")) || 0) + 
                                   (parseFloat(newRentIptuStr.replace(",", ".")) || 0) + 
                                   (parseFloat(newRentGarbageStr.replace(",", ".")) || 0) + 
                                   (parseFloat(newRentLightStr.replace(",", ".")) || 0) + 
                                   (parseFloat(newRentFineStr.replace(",", ".")) || 0) - 
                                   (((parseFloat(newRentAmountStr.replace(",", ".")) || 0) * (parseFloat(newRentAdminFeePercentStr.replace(",", ".")) || 0)) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

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

                        {/* DEPOSIT (CAUÇÃO) SECTION */}
                        <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-205">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-755 text-[11px] mb-1.5 select-none">
                            <input
                              type="checkbox"
                              checked={editRentHasDeposit}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditRentHasDeposit(checked);
                                if (checked) {
                                  const rentVal = parseFloat(editRentAmountStr.replace(",", ".")) || 0;
                                  setEditRentDepositAmountStr((rentVal * editRentDepositMonths).toFixed(2).replace(".", ","));
                                }
                              }}
                              className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-550 border-slate-300 cursor-pointer"
                            />
                            <span>Possui Caução de Garantia?</span>
                          </label>

                          {editRentHasDeposit && (
                            <div className="mt-1 space-y-3 pt-2.5 border-t border-slate-200 overflow-hidden">
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

                        {/* PREVIEW MATH BLOCK */}
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-2 mt-4 shadow-sm">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-90 border-b border-slate-800 pb-1.5">
                            <span>Resumo Detalhado (Editado)</span>
                            <span>Visualização Líquida</span>
                          </div>
                          <div className="space-y-1 font-mono text-[11px] opacity-80 leading-normal">
                            <div className="flex justify-between">
                              <span>Aluguel:</span>
                              <span>R$ {(parseFloat(editRentAmountStr.replace(",", ".")) || 0).toFixed(2)}</span>
                            </div>
                            {((parseFloat(editRentWaterStr.replace(",", ".")) || 0) > 0 || (parseFloat(editRentIptuStr.replace(",", ".")) || 0) > 0 || (parseFloat(editRentLightStr.replace(",", ".")) || 0) > 0 || (parseFloat(editRentGarbageStr.replace(",", ".")) || 0) > 0 || (parseFloat(editRentFineStr.replace(",", ".")) || 0) > 0) && (
                              <div className="flex justify-between">
                                <span>Encargos (Consumo/Tributos):</span>
                                <span>R$ {((parseFloat(editRentWaterStr.replace(",", ".")) || 0) + (parseFloat(editRentIptuStr.replace(",", ".")) || 0) + (parseFloat(editRentGarbageStr.replace(",", ".")) || 0) + (parseFloat(editRentLightStr.replace(",", ".")) || 0) + (parseFloat(editRentFineStr.replace(",", ".")) || 0)).toFixed(2)}</span>
                              </div>
                            )}
                            {(parseFloat(editRentAdminFeePercentStr.replace(",", ".")) || 0) > 0 && (
                              <div className="flex justify-between text-rose-350">
                                <span>(-) Taxa Administração ({parseFloat(editRentAdminFeePercentStr.replace(",", "."))}%):</span>
                                <span>- R$ {(((parseFloat(editRentAmountStr.replace(",", ".")) || 0) * (parseFloat(editRentAdminFeePercentStr.replace(",", ".")) || 0)) / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold">
                            <span className="text-xs uppercase">Recebimento Líquido</span>
                            <span className="text-sm font-mono text-emerald-400">
                              R$ {((parseFloat(editRentAmountStr.replace(",", ".")) || 0) + 
                                   (parseFloat(editRentWaterStr.replace(",", ".")) || 0) + 
                                   (parseFloat(editRentIptuStr.replace(",", ".")) || 0) + 
                                   (parseFloat(editRentGarbageStr.replace(",", ".")) || 0) + 
                                   (parseFloat(editRentLightStr.replace(",", ".")) || 0) + 
                                   (parseFloat(editRentFineStr.replace(",", ".")) || 0) - 
                                   (((parseFloat(editRentAmountStr.replace(",", ".")) || 0) * (parseFloat(editRentAdminFeePercentStr.replace(",", ".")) || 0)) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

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

      {/* RENT RECEIPT DATE CONFIRMATION OVERLAY MODAL */}
      <AnimatePresence>
        {renderReceiptConfirmModal()}
      </AnimatePresence>

    </div>
  );
}
