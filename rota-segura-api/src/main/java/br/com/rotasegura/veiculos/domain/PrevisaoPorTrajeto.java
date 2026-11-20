package br.com.rotasegura.veiculos.domain;

import br.com.rotasegura.veiculos.domain.CorredorDaRota.DiaDeRota;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Previsão de chegada pela posição ao vivo: em cada dia do histórico, acha quando o ônibus passou perto de
 * onde ele está agora (no mesmo horário, com folga) e quanto tempo levou dali até entrar no raio da escola.
 * A previsão é agora + a mediana desses tempos; "o normal" é a mediana da hora de chegada nesses dias.
 */
public final class PrevisaoPorTrajeto {

    /** Chegada mais de isso depois da passagem não conta (era outra viagem). */
    static final Duration VIAGEM_MAXIMA = Duration.ofHours(2);

    private PrevisaoPorTrajeto() {
    }

    /**
     * @param atual         posição do ônibus agora
     * @param agora         hora atual
     * @param dias          trajetos dos dias anteriores
     * @param escola        destino; o ônibus "chegou" quando entra no raio dele
     * @param raioBuscaM    distância máxima entre a posição de agora e a passagem do dia histórico
     * @param folgaHorario  diferença máxima de horário entre agora e a passagem do dia histórico
     * @param minimoDias    com menos dias que isso não há previsão (o painel usa a estimativa pela saída)
     */
    public static Optional<Previsao> estimar(PosicaoVeiculo atual, LocalDateTime agora, List<DiaDeRota> dias,
                                             RastroDoDia.Cerca escola, double raioBuscaM, Duration folgaHorario,
                                             int minimoDias) {
        if (escola == null || escola.contem(atual)) {
            return Optional.empty();
        }
        List<Long> restantes = new ArrayList<>();
        List<Long> chegadas = new ArrayList<>();
        LocalTime horaAgora = agora.toLocalTime();
        for (DiaDeRota dia : dias) {
            List<PontoRastro> pontos = dia.pontos();
            int passagem = -1;
            double menor = Double.MAX_VALUE;
            for (int i = 0; i < pontos.size(); i++) {
                PontoRastro p = pontos.get(i);
                if (Math.abs(Duration.between(horaAgora, p.em().toLocalTime()).toSeconds()) > folgaHorario.toSeconds()) {
                    continue;
                }
                double d = atual.distanciaAte(p.latitude(), p.longitude());
                if (d <= raioBuscaM && d < menor) {
                    menor = d;
                    passagem = i;
                }
            }
            if (passagem < 0) {
                continue;
            }
            LocalDateTime passou = pontos.get(passagem).em();
            for (int i = passagem + 1; i < pontos.size(); i++) {
                PontoRastro p = pontos.get(i);
                if (Duration.between(passou, p.em()).compareTo(VIAGEM_MAXIMA) > 0) {
                    break;
                }
                if (escola.distanciaAte(new PosicaoVeiculo(p.latitude(), p.longitude(), null, null, null, p.em()))
                        <= escola.raioM()) {
                    restantes.add(Duration.between(passou, p.em()).toSeconds());
                    chegadas.add((long) p.em().toLocalTime().toSecondOfDay());
                    break;
                }
            }
        }
        if (restantes.size() < minimoDias) {
            return Optional.empty();
        }
        long restanteS = mediana(restantes);
        LocalDateTime chegada = agora.plusSeconds(restanteS).withNano(0);
        LocalTime normal = LocalTime.ofSecondOfDay(mediana(chegadas));
        long diferencaMin = Math.round((chegada.toLocalTime().toSecondOfDay() - normal.toSecondOfDay()) / 60.0);
        return Optional.of(new Previsao(chegada, Math.round(restanteS / 60.0), normal.withSecond(0), diferencaMin,
                restantes.size()));
    }

    static long mediana(List<Long> valores) {
        List<Long> ordenados = valores.stream().sorted().toList();
        int meio = ordenados.size() / 2;
        return ordenados.size() % 2 == 1 ? ordenados.get(meio)
                : Math.round((ordenados.get(meio - 1) + ordenados.get(meio)) / 2.0);
    }

    /**
     * @param chegada       hora prevista de chegada
     * @param restanteMin   minutos até a chegada
     * @param chegadaNormal hora em que o ônibus costuma chegar (mediana do histórico)
     * @param diferencaMin  previsão − normal, em minutos (positivo = mais tarde que o normal)
     * @param diasUsados    dias do histórico que entraram no cálculo
     */
    public record Previsao(LocalDateTime chegada, long restanteMin, LocalTime chegadaNormal, long diferencaMin,
                           int diasUsados) {
    }
}
