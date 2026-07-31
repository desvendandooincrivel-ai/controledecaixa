import React, { useState, useMemo } from "react";
import { 
  ScrollText, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Building, 
  RefreshCw, 
  FileSpreadsheet, 
  HelpCircle,
  Clock,
  ArrowRightLeft,
  Settings,
  Filter,
  Printer
} from "lucide-react";
import { AuditDossierModal } from "./AuditDossierModal";

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  type: string;
  description: string;
  caixaId?: string;
  amount?: number;
}

interface ActivityLogPanelProps {
  logs: ActivityLog[];
  onClearLogs: () => void;
  activeCaixa: { id: string; name: string };
  caixas: Array<{ id: string; name: string }>;
}

export function ActivityLogPanel({
  logs,
  onClearLogs,
  activeCaixa,
  caixas
}: ActivityLogPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("todos");
  const [filterByCaixa, setFilterByCaixa] = useState<boolean>(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  // Translate types to user-friendly titles
  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case "receita": return "Receita";
      case "despesa":
      case "despespa": return "Despesa";
      case "edicao": return "Edição";
      case "exclusao": return "Exclusão";
      case "reconciliacao_confirmar": return "Conciliação de Aluguel";
      case "reconciliacao_remover": return "Desfazer Conciliação";
      case "cadastro_aluguel": return "Cadastro de Aluguel";
      case "remover_aluguel": return "Remover Aluguel";
      case "modelo_fixo": return "Lançamento Fixo";
      case "demonstracao": return "Demonstração";
      case "sistema": return "Sistema";
      default: return "Lançamento";
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "receita":
      case "reconciliacao_confirmar":
        return {
          border: "border-l-emerald-500",
          text: "text-emerald-700",
          bg: "bg-emerald-50",
          iconBg: "bg-emerald-100/80 text-emerald-700"
        };
      case "despesa":
      case "despespa":
      case "exclusao":
      case "reconciliacao_remover":
      case "remover_aluguel":
        return {
          border: "border-l-rose-500",
          text: "text-rose-700",
          bg: "bg-rose-50/50",
          iconBg: "bg-rose-100/80 text-rose-750"
        };
      case "cadastro_aluguel":
      case "modelo_fixo":
        return {
          border: "border-l-pink-500",
          text: "text-pink-700",
          bg: "bg-pink-50/30",
          iconBg: "bg-pink-50 text-pink-750"
        };
      case "edicao":
        return {
          border: "border-l-amber-500",
          text: "text-amber-700",
          bg: "bg-amber-50/35",
          iconBg: "bg-amber-100/70 text-amber-700"
        };
      case "sistema":
      case "demonstracao":
      default:
        return {
          border: "border-l-indigo-500",
          text: "text-indigo-700",
          bg: "bg-indigo-50/20",
          iconBg: "bg-indigo-50 text-indigo-700"
        };
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case "receita":
      case "reconciliacao_confirmar":
        return <CheckCircle2 size={13} />;
      case "despesa":
      case "despespa":
      case "exclusao":
      case "reconciliacao_remover":
      case "remover_aluguel":
        return <XCircle size={13} />;
      case "edicao":
        return <ArrowRightLeft size={13} />;
      case "cadastro_aluguel":
        return <Building size={13} />;
      case "modelo_fixo":
        return <RefreshCw size={13} />;
      case "sistema":
      case "demonstracao":
      default:
        return <Settings size={13} />;
    }
  };

  const handleClearLogs = () => {
    if (confirm("Você quer realmente limpar todo o histórico de logs/prontuários? Essa ação não pode ser desfeita.")) {
      onClearLogs();
    }
  };

  // Date Formatter Helper
  const formatLogDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return isoString;
    }
  };

  // Filter & Search computation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filter by caixa if requested
      if (filterByCaixa && log.caixaId && log.caixaId !== activeCaixa.id) {
        return false;
      }

      // Filter by category type
      if (selectedType !== "todos") {
        if (selectedType === "recebimentos" && !["receita", "reconciliacao_confirmar"].includes(log.type)) {
          return false;
        }
        if (selectedType === "pagamentos" && !["despesa", "despespa", "exclusao", "reconciliacao_remover"].includes(log.type)) {
          return false;
        }
        if (selectedType === "sistema" && !["sistema", "demonstracao", "edicao"].includes(log.type)) {
          return false;
        }
      }

      // Filter by text search
      if (searchTerm.trim() !== "") {
        const textToMatch = log.description.toLowerCase();
        const typeMatch = getLogTypeLabel(log.type).toLowerCase();
        const term = searchTerm.toLowerCase();
        return textToMatch.includes(term) || typeMatch.includes(term);
      }

      return true;
    });
  }, [logs, searchTerm, selectedType, filterByCaixa, activeCaixa.id]);

  // Statistics counters
  const stats = useMemo(() => {
    let totalCredited = 0;
    let receiptsCount = 0;
    let paymentCount = 0;
    let aluguelReconciliationCount = 0;

    logs.forEach(log => {
      if (log.type === "receita" || log.type === "reconciliacao_confirmar") {
        receiptsCount++;
        if (log.amount) totalCredited += log.amount;
      } else if (log.type === "despesa" || log.type === "despespa") {
        paymentCount++;
      }
      if (log.type === "reconciliacao_confirmar") {
        aluguelReconciliationCount++;
      }
    });

    return {
      totalCredited,
      receiptsCount,
      paymentCount,
      aluguelReconciliationCount
    };
  }, [logs]);

  return (
    <div className="flex flex-col gap-6 text-slate-800">
      
      {/* Log Header Metrics Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
        <div className="flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-450 select-none">Registros Totais</span>
          <span className="text-xl font-extrabold text-slate-800 font-mono">
            {logs.length}
          </span>
          <span className="text-[10px] text-indigo-600 mt-0.5 font-sans">Eventos na auditoria ativa</span>
        </div>
        
        <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[10px] uppercase font-bold text-slate-450 select-none">Renda Conciliada</span>
          <span className="text-xl font-extrabold text-emerald-600 font-mono">
            {stats.aluguelReconciliationCount}
          </span>
          <span className="text-[10px] text-emerald-500 mt-0.5 font-sans">Recebimentos de aluguéis</span>
        </div>

        <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[10px] uppercase font-bold text-slate-450 select-none">Acumulado em Entradas</span>
          <span className="text-xl font-extrabold text-slate-800 font-mono">
            R$ {stats.totalCredited.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-indigo-600 mt-0.5 font-sans">Total por ações em logs</span>
        </div>

        <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[10px] uppercase font-bold text-slate-450 select-none">Lançamentos Manuais</span>
          <span className="text-xl font-extrabold text-slate-850 font-mono">
            {stats.receiptsCount + stats.paymentCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 font-sans">Entradas e saídas no log</span>
        </div>
      </div>

      {/* Control Actions & Toolbar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-3xs">
        
        {/* Search log field */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar descrição ou evento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-indigo-400 outline-none p-2 pl-9.5 text-xs font-semibold rounded-xl transition"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Caixa Filter (Checkbox Toggle style) */}
          <button
            type="button"
            onClick={() => setFilterByCaixa(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition cursor-pointer select-none ${
              filterByCaixa 
                ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Filter size={12} />
            <span>Somente: {activeCaixa.name}</span>
          </button>

          {/* Quick Buttons category filters */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedType("todos")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none ${
                selectedType === "todos" 
                  ? "bg-white text-indigo-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedType("recebimentos")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none ${
                selectedType === "recebimentos" 
                  ? "bg-white text-indigo-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Receitas
            </button>
            <button
              onClick={() => setSelectedType("pagamentos")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none ${
                selectedType === "pagamentos" 
                  ? "bg-white text-indigo-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setSelectedType("sistema")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none ${
                selectedType === "sistema" 
                  ? "bg-white text-indigo-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Alterações
            </button>
          </div>

          {/* Print/Save PDF Dossier Button */}
          <button
            onClick={() => setIsDossierModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer shadow-2xs hover:shadow-xs"
            title="Exportar Prontuário de Auditoria & Logs em formato PDF"
          >
            <Printer size={13} />
            <span>Imprimir Prontuário PDF</span>
          </button>

          {/* Clear Log Button */}
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100/90 text-rose-600 border border-rose-100 font-bold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
            title="Limpar todos os registros do logbook"
          >
            <Trash2 size={13} />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Timeline Section / Log List Card */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-3xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-rose-50 select-none">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ScrollText size={16} className="text-indigo-600" />
            <span>Prontuário & Diário de Bordo Financeiro</span>
          </h4>
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
            Audit Trail Ativo • Mostrando {filteredLogs.length} de {logs.length}
          </span>
        </div>

        {/* Detailed Timeline list */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 relative">
          
          {filteredLogs.length > 0 ? (
            <div className="relative pl-6 border-l border-slate-100 space-y-4 ml-1">
              {filteredLogs.map((log) => {
                const styling = getLogTypeColor(log.type);
                const relatedCaixa = caixas.find(c => c.id === log.caixaId);

                return (
                  <div key={log.id} className="relative group">
                    {/* Visual timeline node */}
                    <div className={`absolute -left-[31px] top-1.5 h-6 w-6 rounded-full border border-white flex items-center justify-center shadow-3xs ${styling.iconBg}`}>
                      {getLogIcon(log.type)}
                    </div>

                    {/* Log content item card */}
                    <div className={`p-4 rounded-2xl border-l-[3.5px] border-slate-150 shadow-3xs hover:shadow-xs transition duration-150 ${styling.border} ${styling.bg}`}>
                      
                      {/* Log Header row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.02] pb-1.5 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider ${styling.iconBg}`}>
                            {getLogTypeLabel(log.type)}
                          </span>
                          
                          {/* Indicator which Caixa this action belonged to */}
                          {relatedCaixa && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md border border-slate-150">
                              🗃️ {relatedCaixa.name}
                            </span>
                          )}
                        </div>

                        {/* Precise Timestamp */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-405 font-medium select-none">
                          <Clock size={10} className="text-slate-400" />
                          <span>{formatLogDateTime(log.timestamp)}</span>
                        </div>
                      </div>

                      {/* Log description */}
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {log.description}
                      </p>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 mb-2">
                <HelpCircle size={22} className="stroke-1" />
              </div>
              <p className="text-xs font-bold text-slate-500">Nenhum evento registrado</p>
              <p className="text-[11px] text-slate-400 max-w-2xs leading-relaxed mt-1">
                Ao fazer lançamentos, exclusões ou conciliar aluguéis, as informações de auditoria serão registradas aqui.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* AUDIT DOSSIER PRINT TRIGGER MODAL */}
      <AuditDossierModal
        isOpen={isDossierModalOpen}
        onClose={() => setIsDossierModalOpen(false)}
        logs={filteredLogs}
        activeCaixa={activeCaixa}
        caixas={caixas}
      />

    </div>
  );
}
