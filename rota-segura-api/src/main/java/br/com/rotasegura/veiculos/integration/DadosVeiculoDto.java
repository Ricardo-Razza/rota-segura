package br.com.rotasegura.veiculos.integration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Resposta de {@code GET /api/veiculos/{id}/dados}.
 *
 * <p>O Swagger não descreve esta resposta: os nomes abaixo foram conferidos numa chamada real (só nomes e tipos,
 * sem guardar valores). Só a localização é lida. Os outros blocos da resposta ({@code alunos_na_rota}, que traz
 * nome de aluno, {@code eventos}, {@code ultimo_motorista} etc.) são ignorados de propósito (LGPD).
 *
 * @param localizacao última posição do rastreador (formato Traccar). Quando o ERP não consegue falar com o
 *                    rastreador, o bloco vem como {@code {"msg": ..., "error": true}}; aí todos os campos ficam
 *                    nulos e a posição é descartada.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DadosVeiculoDto(LocalizacaoDto localizacao) {

    /**
     * Posição no formato do Traccar.
     *
     * @param speed   velocidade em nós (padrão do Traccar)
     * @param course  rumo em graus
     * @param fixTime hora do GPS, ISO-8601 com fuso
     * @param valid   o próprio GPS considera a posição válida
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LocalizacaoDto(Double latitude, Double longitude, Double speed, Double course, String fixTime,
                                 Boolean valid, Atributos attributes) {
    }

    /** @param motion o rastreador detectou movimento */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Atributos(Boolean motion) {
    }
}
