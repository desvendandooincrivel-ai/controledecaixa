import React, { useState, useEffect, useRef } from "react";
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
  Play,
  RotateCcw
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
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "ready_to_install" | "installing" | "error">("idle");
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [downloadTransferred, setDownloadTransferred] = useState<number>(0);
  const [downloadTotal, setDownloadTotal] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const hasUpdate = updateInfo?.hasUpdate ?? false;
  const currentVersion = updateInfo?.currentVersion || "1.0.6";
  const latestVersion = updateInfo?.latestVersion || currentVersion;
  const releaseName = updateInfo?.releaseName || `Versão ${latestVersion}`;
  const releaseNotes = updateInfo?.releaseNotes || "";
  const downloadUrl = updateInfo?.installerUrl || updateInfo?.downloadUrl || "https://github.com/desvendandooincrivel-ai/caixaatt/releases/latest";

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

  const handleStartInAppDownload = async () => {
    setDownloadStatus("downloading");
    setDownloadPercent(0);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/app-update/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installerUrl: downloadUrl,
          version: latestVersion,
          isSimulated: !!updateInfo?.isSimulated
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao iniciar o download da atualização.");
      }

      // Start polling download status
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/app-update/download-status");
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setDownloadPercent(statusData.percent || 0);
            setDownloadTransferred(statusData.transferred || 0);
            setDownloadTotal(statusData.total || 0);

            if (statusData.status === "ready_to_install") {
              setDownloadStatus("ready_to_install");
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            } else if (statusData.status === "error") {
              setDownloadStatus("error");
              setErrorMessage(statusData.error || "Erro durante o download da atualização.");
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            }
          }
        } catch (pollErr) {
          console.warn("Erro ao consultar progresso:", pollErr);
        }
      }, 400);

    } catch (err: any) {
      setDownloadStatus("error");
      setErrorMessage(err.message || "Não foi possível baixar o instalador.");
    }
  };

  const handleInstallAndRestart = async () => {
    setDownloadStatus("installing");
    try {
      const res = await fetch("/api/app-update/install", {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao iniciar o instalador.");
      }
    } catch (err: any) {
      setDownloadStatus("error");
      setErrorMessage(err.message || "Erro ao executar o instalador.");
    }
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
                    <span>Modo Simulação ativado para testar o download e instalação no app.</span>
                  </div>
                )}
              </div>
            )}

            {/* IN-APP DOWNLOAD PROGRESS SECTION */}
            {downloadStatus === "downloading" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-indigo-50/90 border border-indigo-200 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-indigo-600" />
                    <span>Baixando atualização diretamente no app...</span>
                  </span>
                  <span className="font-mono text-sm font-black text-indigo-700">{downloadPercent}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-indigo-200/60 h-3 rounded-full overflow-hidden p-0.5">
                  <motion.div
                    className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${downloadPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-indigo-800/80 font-mono">
                  <span>
                    {downloadTransferred > 0 ? formatFileSize(downloadTransferred) : "Conectando..."}
                    {downloadTotal > 0 ? ` de ${formatFileSize(downloadTotal)}` : ""}
                  </span>
                  <span>Por favor, aguarde...</span>
                </div>
              </motion.div>
            )}

            {/* READY TO INSTALL BANNER */}
            {downloadStatus === "ready_to_install" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2 shadow-xs"
              >
                <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                  <CheckCircle2 size={18} className="text-emerald-600 stroke-[2.5]" />
                  <span>Download concluído com sucesso!</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  O instalador da nova versão já está no seu computador. Clique no botão <strong>"Instalar e Reiniciar Agora"</strong> para aplicar a atualização.
                </p>
                <p className="text-[11px] text-emerald-700/90 font-medium">
                  🔒 <em>Seus caixas, categorias e lançamentos continuam 100% seguros e intactos.</em>
                </p>
              </motion.div>
            )}

            {/* INSTALLING SPINNER BANNER */}
            {downloadStatus === "installing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-center space-y-2"
              >
                <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto" />
                <h4 className="font-bold text-sm text-blue-900">Iniciando o instalador...</h4>
                <p className="text-xs text-blue-700">
                  O aplicativo será encerrado em instantes para que a instalação seja concluída.
                </p>
              </motion.div>
            )}

            {/* ERROR BANNER */}
            {downloadStatus === "error" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-2"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
                  <AlertCircle size={16} className="text-rose-600" />
                  <span>Erro ao baixar atualização</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  {errorMessage || "Ocorreu uma falha na conexão. Você pode tentar novamente ou baixar o instalador pelo navegador."}
                </p>
                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartInAppDownload}
                    className="text-xs font-bold text-rose-800 underline hover:text-rose-950 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    <span>Tentar Novamente</span>
                  </button>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-950 flex items-center gap-1"
                  >
                    <span>Baixar pelo Navegador</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </motion.div>
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

              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 max-h-52 overflow-y-auto">
                {renderChangelog(releaseNotes)}
              </div>
            </div>

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
                    disabled={downloadStatus === "downloading" || downloadStatus === "installing"}
                    onClick={() => {
                      onSnooze();
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                    title="Lembrar novamente amanhã"
                  >
                    <Clock size={13} className="text-slate-400" />
                    <span>Lembrar Mais Tarde</span>
                  </button>

                  <button
                    type="button"
                    disabled={downloadStatus === "downloading" || downloadStatus === "installing"}
                    onClick={() => {
                      onDismissVersion(latestVersion);
                      onClose();
                    }}
                    className="px-3 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
                    title="Não notificar mais automaticamente sobre esta versão específica"
                  >
                    Pular versão
                  </button>
                </div>

                {downloadStatus === "ready_to_install" ? (
                  <button
                    type="button"
                    onClick={handleInstallAndRestart}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs transition cursor-pointer shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform active:scale-95 animate-pulse"
                  >
                    <Play size={14} className="fill-white" />
                    <span>Instalar e Reiniciar Agora</span>
                  </button>
                ) : downloadStatus === "downloading" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <RefreshCw size={13} className="animate-spin text-slate-500" />
                    <span>Baixando {downloadPercent}%...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartInAppDownload}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform active:scale-95"
                  >
                    <Download size={14} className="stroke-[2.5]" />
                    <span>Baixar Atualização no App</span>
                  </button>
                )}
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
                  <span>Testar Atualização no App (Simular Nova Versão)</span>
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
