package br.com.rotasegura.shared.integration;

/** Recursos da API externa. Cada um tem seu próprio circuit breaker, retry e cache. */
public enum Recurso {
    ALUNOS("alunos", false),
    VEICULOS("veiculos", false),
    RESPONSAVEIS("responsaveis", false),
    DISPOSITIVOS("dispositivos", false),
    PRESENCA("presenca", true),
    /** Posição GPS dos veículos ({@code /api/veiculos/{id}/dados}); consultada pelo rastreamento, sem cache. */
    RASTREAMENTO("rastreamento", true);

    private final String nome;
    private final boolean tempoReal;

    Recurso(String nome, boolean tempoReal) {
        this.nome = nome;
        this.tempoReal = tempoReal;
    }

    /** Nome usado nas instâncias do Resilience4j. */
    public String nome() {
        return nome;
    }

    /** Recursos de tempo real usam o TTL curto de cache. */
    public boolean tempoReal() {
        return tempoReal;
    }
}
