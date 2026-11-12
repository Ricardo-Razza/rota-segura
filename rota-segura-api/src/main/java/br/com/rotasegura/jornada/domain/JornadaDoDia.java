package br.com.rotasegura.jornada.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Jornada de um aluno num dia.
 *
 * @param embarqueEm        primeiro embarque aceito
 * @param veiculoId         veículo do primeiro embarque
 * @param chegadaEm         chegada na escola
 * @param escolaId          escola do leitor de chegada; antes dela, a escola ligada ao leitor de embarque
 * @param tempoTrajetoMin   minutos entre embarque e chegada, quando há os dois
 * @param leiturasIgnoradas leituras descartadas como duplicadas ou fora de ordem
 */
public record JornadaDoDia(
        long alunoId,
        LocalDate data,
        EstadoJornada estado,
        LocalDateTime embarqueEm,
        Long veiculoId,
        LocalDateTime chegadaEm,
        Long escolaId,
        Long tempoTrajetoMin,
        List<Divergencia> divergencias,
        List<Passo> passos,
        LeiturasIgnoradas leiturasIgnoradas) {

    public JornadaDoDia {
        Objects.requireNonNull(data, "data");
        Objects.requireNonNull(estado, "estado");
        divergencias = List.copyOf(divergencias);
        passos = List.copyOf(passos);
        Objects.requireNonNull(leiturasIgnoradas, "leiturasIgnoradas");
    }

    public boolean temDivergencia(TipoDivergencia tipo) {
        return divergencias.stream().anyMatch(d -> d.tipo() == tipo);
    }

    /** Contagem de leituras descartadas pelo motor. */
    public record LeiturasIgnoradas(int duplicadas, int foraDeOrdem) {

        public static final LeiturasIgnoradas NENHUMA = new LeiturasIgnoradas(0, 0);

        public LeiturasIgnoradas somar(LeiturasIgnoradas outra) {
            return new LeiturasIgnoradas(duplicadas + outra.duplicadas, foraDeOrdem + outra.foraDeOrdem);
        }

        public int total() {
            return duplicadas + foraDeOrdem;
        }
    }
}
