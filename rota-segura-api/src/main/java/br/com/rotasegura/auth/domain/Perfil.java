package br.com.rotasegura.auth.domain;

/** Perfis de acesso do painel. */
public enum Perfil {
    ADMIN,
    GESTAO,
    SECRETARIA,
    /** Vê apenas as escolas vinculadas ao usuário. */
    DIRETOR,
    /** Vê apenas os veículos vinculados ao usuário. */
    MONITOR;

    /** Perfis sem restrição de escola ou veículo. */
    public boolean escopoGlobal() {
        return this == ADMIN || this == GESTAO || this == SECRETARIA;
    }

    /** Quem pode ver o contato de um responsável sem máscara (sempre com auditoria). */
    public boolean podeRevelarContato() {
        return this != MONITOR;
    }

    /** Indicadores sensíveis agregados (regra 6 do CLAUDE.md). */
    public boolean podeVerIndicadoresSensiveis() {
        return this == GESTAO || this == SECRETARIA;
    }
}
