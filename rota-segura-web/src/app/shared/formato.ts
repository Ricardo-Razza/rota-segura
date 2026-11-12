/** Formatação pt-BR usada pelas telas. Valor ausente vira travessão, nunca zero inventado. */

export function hora(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  // LocalDateTime sem fuso é interpretado no horário local, que é o da operação.
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}` : '—';
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function percentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`;
}

export function minutos(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : `${valor} min`;
}

/** Tempo relativo curto: "agora", "há 5 min", "há 2 h". */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) {
    return 'nunca';
  }
  const quando = new Date(iso).getTime();
  if (Number.isNaN(quando)) {
    return '—';
  }
  const min = Math.floor((agora - quando) / 60_000);
  if (min < 1) {
    return 'agora';
  }
  if (min < 60) {
    return `há ${min} min`;
  }
  const horas = Math.floor(min / 60);
  return horas < 24 ? `há ${horas} h` : `há ${Math.floor(horas / 24)} d`;
}

/** Data ISO local (aaaa-mm-dd). */
export function isoLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Rótulo de veículo: placa, senão prefixo, senão #id (mesma regra das mensagens de alerta). */
export function rotuloVeiculo(v: {
  id: number;
  placa?: string | null;
  prefixo?: string | null;
}): string {
  return v.placa || v.prefixo || `#${v.id}`;
}
