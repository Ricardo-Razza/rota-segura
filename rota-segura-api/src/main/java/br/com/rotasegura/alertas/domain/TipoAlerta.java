package br.com.rotasegura.alertas.domain;

/** Tipos de alerta gerados pelas regras. A severidade é da ocorrência (lotação varia entre atenção e crítico). */
public enum TipoAlerta {
    /** Embarcou e não passou no leitor da escola dentro da janela. */
    EMBARCOU_SEM_CHEGADA,
    /** Passou no leitor da escola sem embarque no dia. */
    CHEGOU_SEM_EMBARQUE,
    /** Dois embarques no mesmo dia. */
    EMBARQUE_DUPLICADO,
    /** Ocupação do veículo acima do limite de atenção ou do crítico. */
    LOTACAO,
    /** Leitor sem leitura, em horário de rota, há mais que o limite offline. */
    LEITOR_SEM_LEITURA,
    /** Leitor com tipo de uso sem mapeamento: as leituras dele são ignoradas (alerta de configuração). */
    LEITOR_TIPO_DESCONHECIDO,
    /** Veículo dentro da cerca virtual da escola há mais que o tempo de desembarque, com aluno a bordo. */
    CERCA_VIRTUAL_SEM_DESEMBARQUE,
    /** Veículo com aluno a bordo longe do caminho habitual (trajetos dos últimos dias letivos). */
    DESVIO_DE_ROTA,
    /** Veículo com aluno a bordo parado por muito tempo longe das paradas conhecidas e da escola. */
    PARADA_FORA_DO_PADRAO
}
