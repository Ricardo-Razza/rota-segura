package br.com.rotasegura.jornada.domain;

/** Quebras da sequência embarque → chegada (CLAUDE.md, seção 1). */
public enum TipoDivergencia {
    /** Embarcou e não passou no leitor da escola dentro da janela configurada. */
    EMBARCOU_SEM_CHEGADA(Severidade.CRITICO),
    /** Passou no leitor da escola sem embarque registrado no dia. */
    CHEGOU_SEM_EMBARQUE(Severidade.INFO),
    /**
     * Embarcou em veículo diferente do esperado. Só é avaliada quando o cadastro informar o veículo
     * esperado; hoje a API externa não traz esse dado, então não é gerada.
     */
    VEICULO_DIFERENTE_DO_CADASTRO(Severidade.ATENCAO),
    /** Dois embarques no mesmo dia. */
    EMBARQUE_DUPLICADO(Severidade.ATENCAO);

    private final Severidade severidade;

    TipoDivergencia(Severidade severidade) {
        this.severidade = severidade;
    }

    public Severidade severidade() {
        return severidade;
    }
}
