package br.com.rotasegura.veiculos.application;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da operação dos veículos.
 *
 * @param capacidade             lugares por id de veículo. A API não informa a capacidade; sem ela a ocupação
 *                               fica desconhecida (nunca 0%)
 * @param diasHistorico          dias letivos anteriores usados para estimar esperados e tempo de trajeto
 * @param limiteAtencao          ocupação (%) acima da qual o veículo fica em atenção
 * @param limiteCritico          ocupação (%) acima da qual o veículo fica crítico
 */
@ConfigurationProperties("rota-segura.veiculos")
public record VeiculosProperties(Map<Long, Integer> capacidade, Integer diasHistorico, Integer limiteAtencao,
                                 Integer limiteCritico) {

    public VeiculosProperties {
        capacidade = capacidade == null ? Map.of() : Map.copyOf(capacidade);
        diasHistorico = diasHistorico == null ? 10 : diasHistorico;
        limiteAtencao = limiteAtencao == null ? 90 : limiteAtencao;
        limiteCritico = limiteCritico == null ? 100 : limiteCritico;
    }
}
