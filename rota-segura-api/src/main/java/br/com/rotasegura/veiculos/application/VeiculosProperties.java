package br.com.rotasegura.veiculos.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da operação dos veículos. A capacidade não é configurada aqui: vem da API
 * ({@code GET /api/veiculos/{id}/dados}).
 *
 * @param diasHistorico          dias letivos anteriores usados para estimar esperados e tempo de trajeto
 * @param limiteAtencao          ocupação (%) acima da qual o veículo fica em atenção
 * @param limiteCritico          ocupação (%) acima da qual o veículo fica crítico
 */
@ConfigurationProperties("rota-segura.veiculos")
public record VeiculosProperties(Integer diasHistorico, Integer limiteAtencao, Integer limiteCritico) {

    public VeiculosProperties {
        diasHistorico = diasHistorico == null ? 10 : diasHistorico;
        limiteAtencao = limiteAtencao == null ? 90 : limiteAtencao;
        limiteCritico = limiteCritico == null ? 100 : limiteCritico;
    }
}
