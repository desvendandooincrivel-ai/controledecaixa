import React, { useState, useMemo, useEffect } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Check, 
  X, 
  Search, 
  Calendar, 
  CreditCard, 
  Tag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { resolveCategoryColorHex } from "../utils/categoryColor";

export interface CategoryItem {
  id: string;
  name: string;
  type: "entrada" | "saida";
  color: string;
}

interface CategorySelectionModalProps {
  isOpen: boolean;
  type: "entrada" | "saida";
  selectedCategory: string;
  categories: CategoryItem[];
  transactionSummary: {
    description: string;
    amount: number;
    date: string;
    paymentMethod: string;
    installmentsCount?: number;
  };
  onSelectCategory: (categoryName: string) => void;
  onConfirm: (categoryName: string) => void;
  onClose: () => void;
}

export function CategorySelectionModal({
  isOpen,
  type,
  selectedCategory,
  categories,
  transactionSummary,
  onSelectCategory,
  onConfirm,
  onClose,
}: CategorySelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelected, setLocalSelected] = useState(selectedCategory);

  // Sync with prop when modal opens or category changes
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedCategory);
      setSearchQuery("");
    }
  }, [isOpen, selectedCategory]);

  // Filter categories matching current type
  const typeCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  // Filter with search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return typeCategories;
    return typeCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [typeCategories, searchQuery]);

  if (!isOpen) return null;

  const isEntrada = type === "entrada";

  const handleItemClick = (catName: string) => {
    setLocalSelected(catName);
    onSelectCategory(catName);
  };

  const handleItemDoubleClick = (catName: string) => {
    setLocalSelected(catName);
    onSelectCategory(catName);
    onConfirm(catName);
  };

  const handleConfirmClick = () => {
    if (!localSelected) return;
    onConfirm(localSelected);
  };

  // Payment method human label
  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "dinheiro": return "Dinheiro 💵";
      case "pix": return "PIX ⚡";
      case "cartao_credito": return "Cartão de Crédito 💳";
      case "cartao_debito": return "Cartão de Débito 💳";
      case "boleto": return "Boleto 📄";
      default: return "Outros 🔄";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div
            className={`p-5 border-b flex items-center justify-between ${
              isEntrada
                ? "bg-emerald-50/70 border-emerald-100"
                : "bg-rose-50/70 border-rose-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`p-2.5 rounded-2xl ${
                  isEntrada
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                    : "bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                }`}
              >
                {isEntrada ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </span>
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  {isEntrada ? "Confirmar Entrada" : "Confirmar Saída"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEntrada
                    ? "Selecione a categoria de receita para registrar"
                    : "Selecione a categoria de despesa para registrar"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-xl transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Transaction Summary Card */}
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-semibold text-slate-500 truncate">
                {transactionSummary.description || "Sem descrição"}
              </span>
              <span
                className={`text-lg font-extrabold tracking-tight shrink-0 ${
                  isEntrada ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isEntrada ? "+" : "-"} R${" "}
                {transactionSummary.amount.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" />
                {transactionSummary.date.split("-").reverse().join("/")}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CreditCard size={12} className="text-slate-400" />
                {getPaymentLabel(transactionSummary.paymentMethod)}
              </span>
              {transactionSummary.installmentsCount && transactionSummary.installmentsCount > 1 && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-indigo-600">
                    {transactionSummary.installmentsCount}x de R${" "}
                    {(transactionSummary.amount / transactionSummary.installmentsCount).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 pb-2">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar entre as ${typeCategories.length} categorias de ${isEntrada ? "entrada" : "saída"}...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 outline-none transition"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Categories List with Scrollbar */}
          <div className="p-4 pt-1 flex-1 overflow-hidden flex flex-col">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Categorias Disponíveis</span>
              <span className="text-slate-400 font-normal">
                {filteredCategories.length} {filteredCategories.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>

            <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => {
                  const isSelected = localSelected === cat.name;
                  const catHex = resolveCategoryColorHex(cat.color, cat.name, cat.type);

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleItemClick(cat.name)}
                      onDoubleClick={() => handleItemDoubleClick(cat.name)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer select-none ${
                        isSelected
                          ? isEntrada
                            ? "bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200/60 shadow-xs text-emerald-950 font-bold"
                            : "bg-rose-50/80 border-rose-400 ring-2 ring-rose-200/60 shadow-xs text-rose-950 font-bold"
                          : "bg-white border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/80 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0 shadow-3xs border border-black/10"
                          style={{ backgroundColor: catHex }}
                        />
                        <span className="text-xs truncate">{cat.name}</span>
                      </div>

                      {isSelected ? (
                        <div
                          className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isEntrada
                              ? "bg-emerald-500 text-white"
                              : "bg-rose-500 text-white"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                          <span>Selecionada</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">
                          Clique para selecionar
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs font-medium">Nenhuma categoria encontrada</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-2 text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      Limpar busca
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-slate-400 mt-2 text-center select-none">
              Dica: Dê um duplo clique na categoria para confirmar instantaneamente.
            </p>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
              <Tag size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400">Selecionada:</span>
              {localSelected ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/10 shadow-3xs"
                    style={{
                      backgroundColor: resolveCategoryColorHex(
                        categories.find((c) => c.name === localSelected)?.color,
                        localSelected,
                        type
                      ),
                    }}
                  />
                  <span className="truncate">{localSelected}</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-400">Nenhuma</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={!localSelected}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEntrada
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 active:bg-emerald-800"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 active:bg-rose-800"
                }`}
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Confirmar e Salvar {isEntrada ? "Entrada" : "Saída"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
