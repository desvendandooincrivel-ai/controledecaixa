import React, { useState, useMemo } from "react";
import { 
  ArrowRightLeft, 
  Trash2, 
  AlertTriangle, 
  Check, 
  X, 
  CheckSquare, 
  Square, 
  ArrowRight,
  FolderSync
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { resolveCategoryColorHex } from "../utils/categoryColor";

export interface Category {
  id: string;
  name: string;
  type: "entrada" | "saida";
  color: string;
}

export interface Transaction {
  id: string;
  caixaId: string;
  date: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
}

export interface FixedTemplate {
  id: string;
  caixaId: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
}

interface CategoryBulkTransferModalProps {
  isOpen: boolean;
  mode: "transfer" | "delete";
  initialSourceCategoryId?: string;
  categories: Category[];
  transactions: Transaction[];
  fixedTemplates: FixedTemplate[];
  onClose: () => void;
  onTransfer: (sourceCatName: string, targetCatName: string, selectedTxIds: string[], transferFixed: boolean) => void;
  onDeleteCategory: (categoryId: string, targetCatName?: string, selectedTxIds?: string[], transferFixed?: boolean) => void;
}

export function CategoryBulkTransferModal({
  isOpen,
  mode,
  initialSourceCategoryId,
  categories,
  transactions,
  fixedTemplates,
  onClose,
  onTransfer,
  onDeleteCategory,
}: CategoryBulkTransferModalProps) {
  // Source Category selection
  const [sourceId, setSourceId] = useState<string>(() => {
    if (initialSourceCategoryId) return initialSourceCategoryId;
    return categories[0]?.id || "";
  });

  // Source category object
  const sourceCat = useMemo(() => {
    return (
      categories.find((c) => c.id === sourceId) ||
      categories.find((c) => c.id === initialSourceCategoryId) ||
      categories[0]
    );
  }, [categories, sourceId, initialSourceCategoryId]);

  // Available target categories (same type, different ID and different name, sorted A-Z)
  const availableTargetCategories = useMemo(() => {
    if (!sourceCat) return [];
    return categories
      .filter((c) =>
        c.type === sourceCat.type &&
        c.id !== sourceCat.id &&
        c.name.trim().toLowerCase() !== sourceCat.name.trim().toLowerCase()
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [categories, sourceCat]);

  // Target Category selection (pre-select first valid alternative or a sensible fallback)
  const [targetName, setTargetName] = useState<string>("");

  // Target category object
  const targetCat = useMemo(() => {
    return availableTargetCategories.find((c) => c.name === targetName);
  }, [availableTargetCategories, targetName]);

  // Sync sourceId whenever modal opens or initialSourceCategoryId changes
  React.useEffect(() => {
    if (initialSourceCategoryId) {
      setSourceId(initialSourceCategoryId);
    } else if (categories[0]?.id) {
      setSourceId(categories[0].id);
    }
  }, [initialSourceCategoryId, isOpen]);

  // Sync targetName whenever source changes or available target categories update
  React.useEffect(() => {
    if (availableTargetCategories.length > 0) {
      // If user's selected targetName is already valid in availableTargetCategories, keep it!
      if (targetName && availableTargetCategories.some((c) => c.name === targetName)) {
        return;
      }
      // Prioritize "Outras Receitas" / "Outras Despesas" or "Diversos" if available, else first
      const preferred = availableTargetCategories.find((c) =>
        c.name.toLowerCase().includes("outras") || c.name.toLowerCase() === "diversos"
      );
      setTargetName(preferred ? preferred.name : availableTargetCategories[0].name);
    } else {
      setTargetName("");
    }
  }, [sourceCat, availableTargetCategories]);

  // Transactions linked to source category
  const linkedTransactions = useMemo(() => {
    if (!sourceCat) return [];
    return transactions.filter((t) => t.category === sourceCat.name && t.type === sourceCat.type);
  }, [transactions, sourceCat]);

  // Fixed templates linked to source category
  const linkedTemplatesCount = useMemo(() => {
    if (!sourceCat) return 0;
    return fixedTemplates.filter((t) => t.category === sourceCat.name && t.type === sourceCat.type).length;
  }, [fixedTemplates, sourceCat]);

  // Checkbox selections for transactions (default all selected)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [transferFixed, setTransferFixed] = useState<boolean>(true);

  // Initialize all transactions selected whenever source category changes
  React.useEffect(() => {
    if (linkedTransactions.length > 0) {
      setSelectedTxIds(new Set(linkedTransactions.map((t) => t.id)));
    } else {
      setSelectedTxIds(new Set());
    }
  }, [sourceCat, linkedTransactions]);

  if (!isOpen || !sourceCat) return null;

  const isAllSelected = linkedTransactions.length > 0 && selectedTxIds.size === linkedTransactions.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(linkedTransactions.map((t) => t.id)));
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecute = () => {
    if (mode === "transfer") {
      if (!targetName) {
        alert("Selecione uma categoria de destino válida.");
        return;
      }
      if (selectedTxIds.size === 0 && (!transferFixed || linkedTemplatesCount === 0)) {
        alert("Selecione ao menos um lançamento ou conta recorrente para transferir.");
        return;
      }
      onTransfer(sourceCat.name, targetName, Array.from(selectedTxIds), transferFixed);
      onClose();
    } else {
      // Delete mode
      const hasData = linkedTransactions.length > 0 || linkedTemplatesCount > 0;
      if (hasData) {
        if (!targetName) {
          alert("Por favor, selecione uma categoria de destino para os registros.");
          return;
        }
        onDeleteCategory(sourceCat.id, targetName, Array.from(selectedTxIds), transferFixed);
      } else {
        onDeleteCategory(sourceCat.id);
      }
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`p-2.5 rounded-2xl ${
                  mode === "delete"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                {mode === "delete" ? <Trash2 size={20} /> : <ArrowRightLeft size={20} />}
              </span>
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  {mode === "delete"
                    ? `Excluir Categoria: ${sourceCat.name}`
                    : "Transferência em Massa de Lançamentos"}
                </h3>
                <p className="text-xs text-slate-450">
                  {mode === "delete"
                    ? "Reatribua registros vinculados antes de confirmar a exclusão definitiva."
                    : "Migre lançamentos selecionados de uma categoria para outra rapidamente."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Mode delete warning banner if records exist */}
            {mode === "delete" && (linkedTransactions.length > 0 || linkedTemplatesCount > 0) && (
              <div className="p-3.5 bg-amber-50 border border-amber-200/70 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Atenção: Categoria em Uso</span>
                  Esta categoria possui{" "}
                  <span className="font-bold">
                    {linkedTransactions.length} lançamento(s)
                  </span>{" "}
                  {linkedTemplatesCount > 0 && (
                    <>
                      e <span className="font-bold">{linkedTemplatesCount} conta(s) fixa(s)</span>{" "}
                    </>
                  )}
                  cadastrados. Escolha para onde esses itens devem ser transferidos.
                </div>
              </div>
            )}

            {/* Selection Grid: Source & Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Categoria de Origem */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Categoria de Origem ({sourceCat.type === "entrada" ? "Entrada" : "Saída"})
                </label>
                {mode === "delete" ? (
                  <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10 shadow-3xs"
                      style={{ backgroundColor: resolveCategoryColorHex(sourceCat.color, sourceCat.name, sourceCat.type) }}
                    />
                    <span>{sourceCat.name}</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.type === "entrada" ? "🟢 [Entrada]" : "🔴 [Saída]"} {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-700">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-3xs"
                        style={{ backgroundColor: resolveCategoryColorHex(sourceCat.color, sourceCat.name, sourceCat.type) }}
                      />
                      <span className="font-semibold truncate">{sourceCat.name}</span>
                    </div>
                  </>
                )}
                <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                  <span>Lançamentos vinculados:</span>
                  <span className="font-bold text-slate-700">{linkedTransactions.length}</span>
                </div>
              </div>

              {/* Categoria de Destino */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-3.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ArrowRight size={12} /> Categoria de Destino
                  </span>
                  <span className="text-indigo-500 font-normal">
                    {availableTargetCategories.length} opções
                  </span>
                </label>
                {availableTargetCategories.length === 0 ? (
                  <div className="p-2 bg-white text-rose-500 rounded-xl border border-rose-200 text-xs font-semibold">
                    Nenhuma outra categoria de {sourceCat.type} disponível.
                  </div>
                ) : (
                  <>
                    <select
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      {availableTargetCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {targetCat && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-indigo-950 font-semibold truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-3xs"
                          style={{ backgroundColor: resolveCategoryColorHex(targetCat.color, targetCat.name, targetCat.type) }}
                        />
                        <span className="truncate">Destino: <strong>{targetCat.name}</strong></span>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-2 text-[11px] text-indigo-600 border-t border-indigo-100 pt-1.5">
                  Itens marcados serão transferidos para esta categoria.
                </div>
              </div>
            </div>

            {/* Option to transfer recurring fixed templates */}
            {linkedTemplatesCount > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Contas Recorrentes / Modelos Fixos:</span>
                  <p className="text-[11px] text-slate-500">
                    Existem {linkedTemplatesCount} conta(s) fixa(s) nesta categoria.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferFixed}
                    onChange={(e) => setTransferFixed(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                  <span>Transferir fixos para o destino</span>
                </label>
              </div>
            )}

            {/* Transactions Checklist section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Lançamentos da Categoria</span>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {selectedTxIds.size} de {linkedTransactions.length} marcados
                  </span>
                </div>
                {linkedTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer py-1 px-2 hover:bg-indigo-50 rounded-lg transition"
                  >
                    {isAllSelected ? (
                      <>
                        <Square size={14} /> Desmarcar Todos
                      </>
                    ) : (
                      <>
                        <CheckSquare size={14} /> Marcar Todos
                      </>
                    )}
                  </button>
                )}
              </div>

              {linkedTransactions.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <p className="text-xs text-slate-450 font-medium">
                    Nenhum lançamento financeiro cadastrado nesta categoria.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                  {linkedTransactions.map((tx) => {
                    const isChecked = selectedTxIds.has(tx.id);
                    return (
                      <div
                        key={tx.id}
                        onClick={() => toggleSelectTx(tx.id)}
                        className={`flex items-center justify-between p-3 transition cursor-pointer hover:bg-slate-50 select-none ${
                          isChecked ? "bg-indigo-50/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {tx.description}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Data: {tx.date.split("-").reverse().join("/")}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs font-bold ${
                              tx.type === "entrada" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            R$ {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecute}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer ${
                mode === "delete"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {mode === "delete" ? (
                <>
                  <Trash2 size={14} />
                  <span>Excluir Definitivamente</span>
                </>
              ) : (
                <>
                  <FolderSync size={14} />
                  <span>Transferir Lançamentos ({selectedTxIds.size})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
