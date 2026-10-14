import React, { useState } from "react";
import {
  Download,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  X,
  ChevronRight,
  ArrowRight,
  FileText,
  Laptop
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  installerUrl: string | null;
  installerSize?: number | null;
  isSimulated?: boolean;
  checkedAt?: string;
}

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppUpdateInfo | null;
  isLoading: boolean;
  onCheckAgain: (simulate?: boolean) => void;
  onSnooze: () => void;
  onDismissVersion: (version: string) => void;
}

export function AppUpdateModal({
  isOpen,
  onClose,
  updateInfo,
  isLoading,
  onCheckAgain,
  onSnooze,
  onDismissVersion
}: AppUpdateModalProps) {
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!isOpen) return null;

  const hasUpdate = updateInfo?.hasUpdate ?? false;
  const currentVersion = updateInfo?.currentVersion || "1.0.6";
  const latestVersion = updateInfo?.latestVersion || currentVersion;
  const releaseName = updateInfo?.releaseName || `Versão ${latestVersion}`;
  const releaseNotes = updateInfo?.releaseNotes || "";
  const downloadUrl = updateInfo?.installerUrl || updateInfo?.downloadUrl || "https://github.com/desvendandooincrivel-ai/controledecaixa/releases";

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  const handleStartUpdate = () => {
    setDownloadStarted(true);
    window.open(downloadUrl, "_blank");
  };

  // Render formatted release notes lines
  const renderChangelog = (text: string) => {
    if (!text.trim()) {
      return (
        <p className="text-xs text-slate-500 italic">
          Nenhuma nota de lançamento detalhada para esta versão.
        </p>
      );
    }

    const lines = text.split("\n").filter(l => l.trim().length > 0);

    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          const trimmed = line.trim();

          // Section header (### or ##)
          if (trimmed.startsWith("#")) {
            const headerText = trimmed.replace(/^#+\s*/, "");
            return (
              <h4 key={index} className="text-xs font-black uppercase tracking-wider text-slate-800 pt-2 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-500" />
                <span>{headerText}</span>
              </h4>
            );
          }

          // Bullet points (- or *)
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const rawItem = trimmed.replace(/^[-*]\s*/, "");
            // Split bold tags if present
            const parts = rawItem.split(/(\*\*.*?\*\*)/g);

            return (
              <div key={index} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div>
                  {parts.map((part, pIdx) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return (
                        <strong key={pIdx} className="font-extrabold text-slate-900">
                          {part.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={pIdx}>{part}</span>;
                  })}
                </div>
              </div>
            );
          }

          // Regular paragraph
          return (
            <p key={index} className="text-xs text-slate-600 leading-relaxed">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className={`p-6 text-white relative ${
            hasUpdate
              ? "bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900"
              : "bg-gradient-to-r from-slate-800 to-slate-900"
          }`}>
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                {hasUpdate ? (
                  <Sparkles size={24} className="text-amber-300 animate-pulse" />
                ) : (
                  <ShieldCheck size={24} className="text-emerald-400" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full inline-block mb-1">
                  {hasUpdate ? "Nova Atualização Disponível" : "Sistema Atualizado"}
                </span>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {hasUpdate ? "Atualização do Controle de Caixa" : "Você está na versão mais recente"}
                </h3>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-5">
            
            {/* Version Comparison Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Sua Versão Atual</span>
                  <span className="text-sm font-black text-slate-700 font-mono">v{currentVersion}</span>
                </div>

                <div className="flex items-center justify-center px-2 text-slate-400">
                  <ArrowRight size={16} />
                </div>

                <div className="text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Versão Disponível</span>
                  <span className={`text-sm font-black font-mono ${hasUpdate ? "text-emerald-600" : "text-slate-700"}`}>
                    v{latestVersion}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {hasUpdate ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Recomendada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Mais Recente
                  </span>
                )}
              </div>
            </div>

            {/* Release Title and Metadata */}
            {hasUpdate && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-slate-700">{releaseName}</span>
                  {updateInfo?.publishedAt && (
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDate(updateInfo.publishedAt)}
                    </span>
                  )}
                </div>

                {updateInfo?.installerSize && (
                  <span className="text-[10px] font-mono text-slate-400 block">
                    Tamanho do instalador: {formatFileSize(updateInfo.installerSize)}
                  </span>
                )}

                {updateInfo?.isSimulated && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                    <span>Esta é uma simulação de demonstração para você testar a interface de atualização.</span>
                  </div>
                )}
              </div>
            )}

            {/* Changes / Release Notes Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText size={13} className="text-indigo-600" />
                  {hasUpdate ? "Quais são as mudanças nesta versão:" : "Informações do Sistema:"}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Notas de Atualização</span>
              </div>

              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 max-h-56 overflow-y-auto">
                {renderChangelog(releaseNotes)}
              </div>
            </div>

            {/* If user clicked download, display friendly instructions */}
            {downloadStarted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                  <CheckCircle2 size={16} className="text-indigo-600" />
                  <span>Download iniciado com sucesso!</span>
                </div>
                <ol className="text-xs text-indigo-800/90 space-y-1 list-decimal list-inside leading-relaxed pl-1">
                  <li>Aguarde o download do novo instalador terminar.</li>
                  <li>Feche o aplicativo Controle de Caixa.</li>
                  <li>Abra o instalador baixado para concluir a atualização.</li>
                  <li><strong>Seus dados e históricos permanecerão 100% seguros e intactos.</strong></li>
                </ol>
              </motion.div>
            )}

            {/* Offline or already updated info */}
            {!hasUpdate && (
              <div className="text-center py-4 space-y-2 text-slate-500">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 stroke-[1.75]" />
                <p className="text-xs font-medium text-slate-600 max-w-sm mx-auto">
                  Nenhuma nova versão encontrada no momento. O seu aplicativo está com todos os recursos e correções mais recentes.
                </p>
                {updateInfo?.checkedAt && (
                  <p className="text-[10px] text-slate-400">
                    Última verificação: {new Date(updateInfo.checkedAt).toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Footer Controls / User Decision Actions */}
          <div className="p-5 bg-slate-100/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            {hasUpdate ? (
              <>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onSnooze();
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    title="Lembrar novamente amanhã"
                  >
                    <Clock size={13} className="text-slate-400" />
                    <span>Lembrar Mais Tarde</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDismissVersion(latestVersion);
                      onClose();
                    }}
                    className="px-3 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl text-xs font-medium transition cursor-pointer"
                    title="Não notificar mais automaticamente sobre esta versão específica"
                  >
                    Pular esta versão
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartUpdate}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <Download size={14} className="stroke-[2.5]" />
                  <span>Baixar e Atualizar Agora</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onCheckAgain(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Simular como fica a tela quando houver uma nova versão disponível"
                >
                  <Sparkles size={13} />
                  <span>Testar Notificação (Simular v1.0.7)</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onCheckAgain(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={isLoading ? "animate-spin text-indigo-600" : "text-slate-500"} />
                    <span>{isLoading ? "Buscando..." : "Verificar Novamente"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
