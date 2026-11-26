package br.com.rotasegura.veiculos.integration;

import br.com.rotasegura.shared.integration.Conversoes;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Resposta de {@code GET /api/veiculos/{id}/dados}.
 *
 * <p>O Swagger não descreve esta resposta: os nomes abaixo foram conferidos numa chamada real (só nomes e tipos,
 * sem guardar valores). São lidos a localização e a capacidade do veículo. Os outros blocos da resposta
 * ({@code alunos_na_rota}, que traz nome de aluno, {@code eventos}, {@code ultimo_motorista} etc.) são ignorados
 * de propósito (LGPD).
 *
 * @param localizacao última posição do rastreador (formato Traccar). Quando o ERP não consegue falar com o
 *                    rastreador, o bloco vem como {@code {"msg": ..., "error": true}}; aí todos os campos ficam
 *                    nulos e a posição é descartada.
 * @param veiculo     cadastro do veículo; só {@code capacidade} é lida
 * @param kpi         indicadores do ERP; só {@code capacidadeMaxima} é lida
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DadosVeiculoDto(LocalizacaoDto localizacao, CadastroDto veiculo, KpiDto kpi) {

    /** Compatível com quem só precisa da posição (testes). */
    public DadosVeiculoDto(LocalizacaoDto localizacao) {
        this(localizacao, null, null);
    }

    /**
     * Lugares do veículo: {@code veiculo.capacidade} e, se vazia, {@code kpi.capacidadeMaxima}.
     *
     * @return {@code 0} quando a API não informa (ou informa valor inválido/negativo)
     */
    public int capacidadeInformada() {
        Long doCadastro = veiculo == null ? null : Conversoes.paraLong(veiculo.capacidade());
        if (doCadastro != null && doCadastro > 0) {
            return (int) Math.min(doCadastro, Integer.MAX_VALUE);
        }
        Long doKpi = kpi == null ? null : Conversoes.paraLong(kpi.capacidadeMaxima());
        return doKpi != null && doKpi > 0 ? (int) Math.min(doKpi, Integer.MAX_VALUE) : 0;
    }

    /** Texto em vez de número: o ERP manda número, nulo ou string, e nada disso pode quebrar a leitura do GPS. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadastroDto(String capacidade) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KpiDto(String capacidadeMaxima) {
    }

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
