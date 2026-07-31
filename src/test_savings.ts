async function testCompounding() {
  const valorInicial = 10200;
  const startDateStr = "2024-01-01"; // 01/01/2024
  const endDateStr = "2026-05-20"; // 20/05/2026

  // Formatar data para o padrão de busca da URL do BCB (DD/MM/AAAA)
  // Mas podemos buscar o período estendido para ter todos os dados
  const [startY, startM, startD] = startDateStr.split("-");
  const [endY, endM, endD] = endDateStr.split("-");
  const urlInit = `${startD}/${startM}/${startY}`;
  const urlEnd = `${endD}/${endM}/${endY}`;
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados?formato=json&dataInicial=${urlInit}&dataFinal=${urlEnd}`;

  console.log("Fetching from:", url);
  const response = await fetch(url);
  const data = (await response.json()) as any[];
  console.log("Fetched entries count:", data.length);

  // Regra 7: Para depósitos nos dias 29, 30 ou 31, considerar a data-base como dia 1º do mês seguinte
  function getAdjustedStartDate(dateStr: string): { year: number, month: number, day: number } {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (d >= 29) {
      // Avançar para o dia 1º do mês seguinte
      const temp = new Date(y, m, 1, 12, 0, 0);
      return {
        year: temp.getFullYear(),
        month: temp.getMonth() + 1,
        day: 1
      };
    }
    return { year: y, month: m, day: d };
  }

  const adj = getAdjustedStartDate(startDateStr);
  console.log("Adjusted start date:", `${adj.year}-${String(adj.month).padStart(2, "0")}-${String(adj.day).padStart(2, "0")}`);

  // Gerar os aniversários mensais completos
  // Um aniversário mensal completo i ocorre na data correspondente a i meses após a data inicial ajustada.
  // O ciclo 'i' inicia-se em 'data_i-1' e termina em 'data_i'.
  // Se o final do ciclo 'data_i' ultrapassar a data final, as iterações se encerram e não se acumula o ciclo.
  const endLimit = new Date(endDateStr + "T12:00:00");
  
  let factor = 1.0;
  let monthsCount = 0;
  const periods: any[] = [];

  while (true) {
    const currentMonths = monthsCount;
    // Data de início do ciclo
    const cycleStart = getAnniversaryDate(adj.year, adj.month, adj.day, currentMonths);
    // Data de fim do ciclo
    const cycleEnd = getAnniversaryDate(adj.year, adj.month, adj.day, currentMonths + 1);

    if (cycleEnd > endLimit) {
      break;
    }

    // Buscar a taxa na série SGS 195 para o aniversário cycleStart
    const searchDateStr = formatDateToDDMMYYYY(cycleStart);
    const apiEntry = data.find(item => item.data === searchDateStr);
    
    // Se não achar por algum preciosismo de fuso/API, o que é improvável para dias 1-28, trata fallback
    const rate = apiEntry ? parseFloat(apiEntry.valor) : 0.5; // fallback se não achar
    
    const prevFactor = factor;
    factor = factor * (1 + rate / 100);

    periods.push({
      index: currentMonths + 1,
      start: cycleStart.toISOString().split("T")[0],
      end: cycleEnd.toISOString().split("T")[0],
      searchDate: searchDateStr,
      rate,
      valueBefore: valorInicial * prevFactor,
      valueAfter: valorInicial * factor
    });

    monthsCount++;
  }

  const finalValue = valorInicial * factor;
  const roundedFinal = Math.round(finalValue * 100) / 100;

  console.log("\nResults:");
  console.log("Months elapsed:", monthsCount);
  console.log("Final accumulated factor:", factor);
  console.log("Final value before rounding:", finalValue);
  console.log("Final value rounded:", roundedFinal);
  console.log("Target value expected:", 12134.19);
  console.log("Diff:", Math.abs(roundedFinal - 12134.19));

  console.log("\nPeriod details:");
  periods.forEach(p => {
    console.log(`Mês ${p.index}: ${p.start} a ${p.end} | Taxa lookup ${p.searchDate}: ${p.rate}% | R$ ${p.valueBefore.toFixed(4)} -> R$ ${p.valueAfter.toFixed(4)}`);
  });
}

function getAnniversaryDate(year: number, month: number, day: number, monthsElapsed: number): Date {
  const targetMonthIndex = (month - 1) + monthsElapsed;
  const tempDate = new Date(year, targetMonthIndex, 1);
  const maxDays = new Date(year, targetMonthIndex + 1, 0).getDate();
  const actualDay = Math.min(day, maxDays);
  return new Date(year, targetMonthIndex, actualDay, 12, 0, 0);
}

function formatDateToDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

testCompounding().catch(console.error);
