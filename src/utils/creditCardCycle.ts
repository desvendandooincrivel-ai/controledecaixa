export interface CreditCardCycleResult {
  invoicePeriod: string; // "YYYY-MM" (Mês de vencimento da fatura)
  invoiceLabel: string;  // "Novembro de 2026"
  dueDate: string;       // "YYYY-MM-DD"
  targetYear: number;
  targetMonth: number;
  dueDay: number;
  closingDay: number;
  isRolledToNextMonth: boolean;
  cycleStartDate: string; // Início do ciclo (dia closingDay + 1 do mês anterior)
  cycleEndDate: string;   // Fim do ciclo (dia closingDay do mês)
}

/**
 * Calcula a fatura e data de vencimento de uma compra de cartão de crédito
 * baseando-se no dia da compra e no dia de virada (fechamento) do cartão.
 */
export function getCreditCardCycleForPurchase(
  purchaseDateStr: string,
  closingDay: number,
  dueDay: number,
  installmentIndex = 1
): CreditCardCycleResult {
  const parts = purchaseDateStr.split("-");
  const year = parseInt(parts[0], 10) || new Date().getFullYear();
  const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const day = parseInt(parts[2], 10) || new Date().getDate();

  // Se o dia da compra for maior que o dia de fechamento (virada),
  // a compra já virou para a fatura do mês seguinte!
  const isRolled = day > closingDay;
  const monthOffset = (isRolled ? 1 : 0) + (installmentIndex - 1);

  let targetYear = year;
  let targetMonth = month + monthOffset;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const invoicePeriod = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const actualDueDay = Math.min(dueDay, maxDaysInTargetMonth);
  const dueDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;

  // Período do ciclo de faturamento
  let prevCycleYear = targetYear;
  let prevCycleMonth = targetMonth - 1;
  if (prevCycleMonth === 0) {
    prevCycleMonth = 12;
    prevCycleYear -= 1;
  }
  const maxDaysPrev = new Date(prevCycleYear, prevCycleMonth, 0).getDate();
  const actualStartDay = Math.min(closingDay + 1, maxDaysPrev);
  const cycleStartDate = `${prevCycleYear}-${String(prevCycleMonth).padStart(2, "0")}-${String(actualStartDay).padStart(2, "0")}`;

  const maxDaysCur = new Date(targetYear, targetMonth, 0).getDate();
  const actualEndDay = Math.min(closingDay, maxDaysCur);
  const cycleEndDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(actualEndDay).padStart(2, "0")}`;

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const invoiceLabel = `${monthNames[targetMonth - 1]} de ${targetYear}`;

  return {
    invoicePeriod,
    invoiceLabel,
    dueDate,
    targetYear,
    targetMonth,
    dueDay: actualDueDay,
    closingDay,
    isRolledToNextMonth: isRolled,
    cycleStartDate,
    cycleEndDate
  };
}
