import React, { useState, useMemo } from "react";
import { 
  X, 
  Printer, 
  ShieldCheck, 
  Search, 
  Clock, 
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { ActivityLog } from "./ActivityLogPanel";

interface AuditDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLog[];
  activeCaixa: { id: string; name: string };
  caixas: Array<{ id: string; name: string }>;
}

export function AuditDossierModal({
  isOpen,
  onClose,
  logs,
  activeCaixa,
  caixas
}: AuditDossierModalProps) {
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("todos");
  const [customTitle, setCustomTitle] = useState("Holding LF - Dossiê de Auditoria & Compliance Financeiro");
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [operatorName, setOperatorName] = useState("Controladoria Geral LF");

  // Format date helper
  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} às ${h}:${m}:${s}`;
    } catch {
      return isoStr;
    }
  };

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case "receita": return "Receita Registrada";
      case "despesa":
      case "despespa": return "Despesa Registrada";
      case "edicao": return "Retificação / Edição";
      case "exclusao": return "Exclusão / Estorno";
      case "reconciliacao_confirmar": return "Conciliação de Locação";
      case "reconciliacao_remover": return "Desfazer Conciliação";
      case "cadastro_aluguel": return "Cadastro de Contrato";
      case "remover_aluguel": return "Remover Contrato";
      case "modelo_fixo": return "Lançamento Fixo";
      case "demonstracao": return "Demonstração";
      case "sistema": return "Evento de Sistema";
      default: return "Lançamento Geral";
    }
  };

  // Filter computation
  const filteredLogsList = useMemo(() => {
    return logs.filter(log => {
      // Filter by category type
      if (selectedType !== "todos") {
        if (selectedType === "recebimentos" && !["receita", "reconciliacao_confirmar"].includes(log.type)) {
          return false;
        }
        if (selectedType === "pagamentos" && !["despesa", "despespa", "exclusao", "reconciliacao_remover"].includes(log.type)) {
          return false;
        }
        if (selectedType === "alteracoes" && !["sistema", "demonstracao", "edicao", "remover_aluguel", "cadastro_aluguel"].includes(log.type)) {
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
  }, [logs, searchTerm, selectedType]);

  // Statistics calculation for the dossier
  const auditStats = useMemo(() => {
    let totalLogs = filteredLogsList.length;
    let receipts = 0;
    let outlays = 0;
    let edits = 0;
    let rentalConcs = 0;

    filteredLogsList.forEach(l => {
      if (l.type === "receita") receipts++;
      else if (l.type === "despesa" || l.type === "despespa") outlays++;
      else if (l.type === "edicao") edits++;
      else if (l.type === "reconciliacao_confirmar") rentalConcs++;
    });

    return {
      totalLogs,
      receipts,
      outlays,
      edits,
      rentalConcs
    };
  }, [filteredLogsList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-250 flex items-center justify-center p-0 sm:p-4 overflow-y-auto select-none print:bg-white print:p-0">
      
      {/* Print override CSS for absolute perfect alignment on standard horizontal or vertical document flow */}
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

          body > #root > div > *:not(:has(#print-dossier-area)) {
            display: none !important;
          }

          body *:not(:has(#print-dossier-area)):not(#print-dossier-area):not(#print-dossier-area *) {
            display: none !important;
          }

          body *:has(#print-dossier-area) {
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
          #print-dossier-area, #print-dossier-area * {
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

          #print-dossier-area {
            position: static !important;
            width: 210mm !important;
            max-width: 210mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 8mm !important;
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

          #print-dossier-area table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          #print-dossier-area thead {
            display: table-header-group !important;
          }

          #print-dossier-area th,
          #print-dossier-area td {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
            vertical-align: top !important;
          }

          #print-dossier-area .truncate {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            max-width: none !important;
          }

          #print-dossier-area .overflow-hidden,
          #print-dossier-area .overflow-x-auto,
          #print-dossier-area .overflow-y-auto {
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
            size: A4 portrait;
            margin: 0;
          }
        }
      `}} />

      <div className="w-full max-w-6xl bg-slate-900 sm:rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row h-[calc(100vh-1rem)] md:h-[88vh] overflow-hidden">
        
        {/* Command Sidebar for Audit Print Controls */}
        <div className="no-print w-full md:w-80 bg-slate-950 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 overflow-y-auto shrink-0 max-h-[42vh] md:max-h-none">
          <div className="space-y-6">
            
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <span className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg"><Printer size={16} /></span>
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono">Dossiê e Prontuários</span>
              </div>
              <h3 className="text-base font-black text-white">Relatório de Prontuário</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Gere e exporte um dossiê detalhado com as modificações, receitas e auditoria de caixa de forma limpa e certificável.
              </p>
            </div>

            {/* Custom Title modifier */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Título do Dossiê de Auditoria</label>
              <input 
                type="text" 
                value={customTitle} 
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white outline-none font-semibold"
              />
            </div>

            {/* Operator reference */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none font-sans">Órgão / Assinante Revisor</label>
              <input 
                type="text" 
                value={operatorName} 
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white outline-none font-semibold"
              />
            </div>

            {/* Log Categories Quick Selector Filters inside panel */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Filtragem de Atividades</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedType("todos")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === "todos" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Ver Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("recebimentos")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === "recebimentos" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Recebidos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("pagamentos")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === "pagamentos" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Pagos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("alteracoes")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === "alteracoes" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
                  }`}
                >
                  Auditoria
                </button>
              </div>
            </div>

            {/* Toggle checkboxes */}
            <div className="space-y-2.5 pt-1">
              <label className="text-[10px] font-bold text-slate-350 uppercase select-none">Visualizações Opcionais</label>
              
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={includeStats} 
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 accent-indigo-600"
                />
                <span className="text-[11px] text-slate-300 font-medium">Sumário de Métricas Ativas</span>
              </label>
            </div>

          </div>

          {/* Action Trigger Buttons */}
          <div className="mt-6 space-y-2.5 border-t border-slate-800/60 pt-4 font-sans">
            <button
              onClick={() => window.print()}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
            >
              <Printer size={15} />
              <span>Imprimir Prontuário</span>
            </button>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white py-2.5 px-4 rounded-xl text-xs font-bold transition border border-slate-800 cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>

        </div>

        {/* Paper Frame for High-Level Review */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-8 overflow-auto flex justify-start xl:justify-center items-start border-slate-800 min-h-[58vh] md:min-h-0">
          
          <div 
            id="print-dossier-area"
            className="w-[210mm] min-w-[210mm] max-w-none bg-white text-slate-900 p-[8mm] shadow-2xl rounded-2xl border border-slate-200/50 min-h-[296mm] font-sans"
          >
            
            {/* Elegant Letterhead Header on A4 */}
            <div>
              <div className="flex justify-between items-start border-b-[2.5px] border-slate-800 pb-5 mb-6">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 mb-1">
                    <span className="bg-slate-900 text-white p-2 rounded-lg font-black text-xs font-mono select-none">AUDIT</span>
                    <span className="text-xs uppercase font-extrabold tracking-widest font-mono">Dossiê Oficial de Rastreabilidade</span>
                  </div>
                  <h1 className="text-base font-black text-slate-900 leading-snug">
                    {customTitle}
                  </h1>
                  <p className="text-[10px] text-slate-405 font-bold tracking-wider uppercase mt-1">
                    Relação Registrada de Transações e Modificações Operacionais
                  </p>
                </div>

                <div className="text-right text-[10px] text-slate-500 font-medium">
                  <div className="font-extrabold text-slate-850 uppercase tracking-widest mb-0.5 text-[11px] select-none">Controle Interno</div>
                  <div>Emissão: {new Date().toLocaleDateString("pt-BR")}</div>
                  <div>Responsável: {operatorName}</div>
                  <div className="mt-1"><span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 border border-indigo-100 rounded-md font-bold text-[9px] uppercase">Integridado</span></div>
                </div>
              </div>

              {/* Document stats summaries */}
              {includeStats && (
                <div className="grid grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Lançados Apurados</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono">
                      {auditStats.totalLogs} Eventos
                    </span>
                    <span className="block text-[7.5px] text-slate-400 mt-0.5">Filtrados na sessão</span>
                  </div>

                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Entradas Logadas</span>
                    <span className="text-sm font-extrabold text-emerald-600 font-mono">
                      {auditStats.receipts} Ocorrências
                    </span>
                    <span className="block text-[7.5px] text-slate-400 mt-0.5">Inclusão de receitas</span>
                  </div>

                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Retificações / Edição</span>
                    <span className="text-sm font-extrabold text-amber-600 font-mono">
                      {auditStats.edits} Ocorrências
                    </span>
                    <span className="block text-[7.5px] text-slate-400 mt-0.5">Modificações no sistema</span>
                  </div>

                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Conciliações Real Real</span>
                    <span className="text-sm font-extrabold text-indigo-600 font-mono">
                      {auditStats.rentalConcs} Contratos
                    </span>
                    <span className="block text-[7.5px] text-slate-400 mt-0.5">Execuções de aluguel</span>
                  </div>
                </div>
              )}

              {/* Core Audit Trail Log Table Entries */}
              <div className="space-y-2 mb-6">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider select-none">Registros Históricos Impressos (Linha por Linha de Logs)</h4>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-405 font-bold uppercase tracking-wider">
                        <th className="p-2 w-32 select-none">Data e Hora</th>
                        <th className="p-2 w-32 select-none">Caixa / Unidade</th>
                        <th className="p-2 w-32 select-none">Tipo de Ocorrência</th>
                        <th className="p-2 select-none">Registro de Rastreabilidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium font-sans">
                      {filteredLogsList.length > 0 ? (
                        filteredLogsList.map((log) => {
                          const relativeCaixa = caixas.find(c => c.id === log.caixaId);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/20">
                              <td className="p-2 text-slate-450 font-mono font-bold whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                              <td className="p-2 font-bold text-slate-650">{relativeCaixa ? `🗃️ ${relativeCaixa.name}` : "Geral / Corporativo"}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${
                                  log.type === "receita" || log.type === "reconciliacao_confirmar"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : log.type === "despesa" || log.type === "despespa" || log.type === "exclusao" || log.type === "reconciliacao_remover"
                                    ? "bg-rose-50 text-rose-700 border border-rose-100"
                                    : log.type === "edicao"
                                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                                    : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                }`}>
                                  {getLogTypeLabel(log.type)}
                                </span>
                              </td>
                              <td className="p-2 text-slate-800 leading-normal font-semibold pr-3">{log.description}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-[10px] text-slate-400 font-semibold italic bg-slate-50/50">
                            Nenhum log corresponde aos filtros informados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Informative disclaimers about traceability integrity */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-start gap-2.5 text-[8.5px] text-slate-500 leading-relaxed max-w-full">
                <ShieldCheck size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-700 block mb-0.5 uppercase tracking-wider text-[8px]">Certificação e Auditoria Completa</span>
                  Os registros mostrados acima refletem fielmente as ações dos operadores neste sistema. As transações editadas e estornadas são gravadas irreversivelmente na trilha de auditoria para fins de compliance fiscal e transparência corporativa das controladoras parceiras da Holding LF.
                </div>
              </div>

            </div>

            {/* Signatures Areas */}
            <div className="mt-8 pt-8 border-t border-slate-150 flex justify-between gap-12 select-none page-break-inside">
              <div className="flex-1 text-center">
                <div className="h-0.5 w-full bg-slate-350 max-w-[180px] mx-auto mb-2"></div>
                <span className="block text-[8px] font-bold uppercase text-slate-500 tracking-wider">Controladoria Geral</span>
                <span className="block text-[7px] text-slate-400 mt-0.5">Órgão de Revisão de Conformidade</span>
              </div>
              
              <div className="flex-1 text-center">
                <div className="h-0.5 w-full bg-slate-350 max-w-[180px] mx-auto mb-2"></div>
                <span className="block text-[8px] font-bold uppercase text-slate-500 tracking-wider">Diretoria de Risco (CRO)</span>
                <span className="block text-[7px] text-slate-400 mt-0.5">Holding LF & Unidades Associadas</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
