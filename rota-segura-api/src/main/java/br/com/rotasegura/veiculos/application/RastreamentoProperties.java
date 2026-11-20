package br.com.rotasegura.veiculos.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Rastreamento GPS dos veículos.
 *
 * @param habilitado          liga a consulta periódica (desligada nos testes)
 * @param intervalo           intervalo entre consultas ao rastreador de cada veículo
 * @param raioEscolaM         raio da cerca virtual em volta da escola de destino
 * @param tempoDesembarque    veículo na cerca há mais que isso, com aluno a bordo que não passou no leitor
 *                            da escola, gera alerta
 * @param limitePosicaoAtrasada posição do GPS mais antiga que isso aparece como "atrasada" no painel
 * @param distanciaMinimaM    deslocamento mínimo para um novo ponto entrar no rastro
 * @param maxPontosRastro     teto de pontos guardados por veículo no dia (os mais antigos saem)
 * @param retencao            por quanto tempo o trajeto fica no banco antes de ser apagado
 * @param consultasSimultaneas quantos rastreadores são consultados ao mesmo tempo em cada rodada
 */
@ConfigurationProperties("rota-segura.rastreamento")
public record RastreamentoProperties(Boolean habilitado, Duration intervalo, Integer raioEscolaM,
                                     Duration tempoDesembarque, Duration limitePosicaoAtrasada,
                                     Integer distanciaMinimaM, Integer maxPontosRastro, Duration retencao,
                                     Integer consultasSimultaneas) {

    public RastreamentoProperties {
        habilitado = habilitado == null || habilitado;
        intervalo = intervalo == null ? Duration.ofSeconds(5) : intervalo;
        raioEscolaM = raioEscolaM == null ? 300 : raioEscolaM;
        tempoDesembarque = tempoDesembarque == null ? Duration.ofMinutes(10) : tempoDesembarque;
        limitePosicaoAtrasada = limitePosicaoAtrasada == null ? Duration.ofMinutes(2) : limitePosicaoAtrasada;
        distanciaMinimaM = distanciaMinimaM == null ? 15 : distanciaMinimaM;
        maxPontosRastro = maxPontosRastro == null ? 3000 : maxPontosRastro;
        retencao = retencao == null ? Duration.ofDays(90) : retencao;
        consultasSimultaneas = consultasSimultaneas == null || consultasSimultaneas < 1 ? 8 : consultasSimultaneas;
    }
}
