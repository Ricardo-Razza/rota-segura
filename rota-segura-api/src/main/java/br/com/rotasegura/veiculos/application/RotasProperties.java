package br.com.rotasegura.veiculos.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Aprendizado das rotas a partir do trajeto guardado: paradas reais, previsão de chegada e alertas de desvio.
 *
 * @param diasCorredor               dias letivos anteriores que formam o caminho habitual (e a previsão)
 * @param diasParadas                dias letivos anteriores usados para aprender as paradas
 * @param raioParadaM                embarques a até essa distância formam a mesma parada
 * @param minimoEmbarquesParada      embarques mínimos para um ponto virar parada
 * @param minimoDias                 dias com trajeto necessários para prever e para alertar desvio
 * @param raioBuscaPrevisaoM         distância máxima até a passagem de um dia histórico, na previsão
 * @param folgaHorarioPrevisao       diferença máxima de horário até a passagem de um dia histórico
 * @param distanciaDesvioM           mais longe que isso do caminho habitual é desvio
 * @param tempoDesvio                desvio por mais que isso gera alerta
 * @param tempoParado                parado por mais que isso fora de parada conhecida gera alerta
 * @param raioParadoM                movimentos menores que isso contam como "parado" (ruído do GPS)
 * @param distanciaParadaConhecidaM  parado a até essa distância de uma parada conhecida ou da escola é normal
 * @param cache                      por quanto tempo o histórico calculado de um veículo é reaproveitado
 */
@ConfigurationProperties("rota-segura.rotas")
public record RotasProperties(Integer diasCorredor, Integer diasParadas, Integer raioParadaM,
                              Integer minimoEmbarquesParada, Integer minimoDias, Integer raioBuscaPrevisaoM,
                              Duration folgaHorarioPrevisao, Integer distanciaDesvioM, Duration tempoDesvio,
                              Duration tempoParado, Integer raioParadoM, Integer distanciaParadaConhecidaM,
                              Duration cache) {

    public RotasProperties {
        diasCorredor = diasCorredor == null ? 10 : diasCorredor;
        diasParadas = diasParadas == null ? 30 : diasParadas;
        raioParadaM = raioParadaM == null ? 50 : raioParadaM;
        minimoEmbarquesParada = minimoEmbarquesParada == null ? 3 : minimoEmbarquesParada;
        minimoDias = minimoDias == null ? 3 : minimoDias;
        raioBuscaPrevisaoM = raioBuscaPrevisaoM == null ? 300 : raioBuscaPrevisaoM;
        folgaHorarioPrevisao = folgaHorarioPrevisao == null ? Duration.ofMinutes(90) : folgaHorarioPrevisao;
        distanciaDesvioM = distanciaDesvioM == null ? 300 : distanciaDesvioM;
        tempoDesvio = tempoDesvio == null ? Duration.ofMinutes(2) : tempoDesvio;
        tempoParado = tempoParado == null ? Duration.ofMinutes(5) : tempoParado;
        raioParadoM = raioParadoM == null ? 30 : raioParadoM;
        distanciaParadaConhecidaM = distanciaParadaConhecidaM == null ? 150 : distanciaParadaConhecidaM;
        cache = cache == null ? Duration.ofMinutes(10) : cache;
    }
}
