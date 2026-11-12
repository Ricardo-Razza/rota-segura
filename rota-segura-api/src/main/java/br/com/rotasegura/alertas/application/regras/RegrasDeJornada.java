package br.com.rotasegura.alertas.application.regras;

import br.com.rotasegura.alertas.application.ContextoAvaliacao;
import br.com.rotasegura.alertas.application.RegraAlerta;
import br.com.rotasegura.alertas.domain.EntidadeAlerta;
import br.com.rotasegura.alertas.domain.Ocorrencia;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.domain.Divergencia;
import br.com.rotasegura.jornada.domain.TipoDivergencia;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Regras que transformam as divergências da jornada do dia em alertas por aluno. */
public final class RegrasDeJornada {

    private RegrasDeJornada() {
    }

    /** Embarcou e não passou no leitor da escola dentro da janela (crítico). */
    @Component
    public static class EmbarcouSemChegada implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            return porDivergencia(ctx, TipoDivergencia.EMBARCOU_SEM_CHEGADA, TipoAlerta.EMBARCOU_SEM_CHEGADA,
                    (linha, d, rotulo) -> "Aluno " + rotulo + " embarcou no veículo "
                            + ctx.rotuloVeiculo(linha.jornada().veiculoId()) + " às "
                            + ContextoAvaliacao.hora(linha.jornada().embarqueEm())
                            + " e não passou no leitor da escola em " + ctx.janelaSemChegada().toMinutes() + " min.");
        }
    }

    /** Passou no leitor da escola sem embarque registrado (informativo). */
    @Component
    public static class ChegouSemEmbarque implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            return porDivergencia(ctx, TipoDivergencia.CHEGOU_SEM_EMBARQUE, TipoAlerta.CHEGOU_SEM_EMBARQUE,
                    (linha, d, rotulo) -> "Aluno " + rotulo + " passou no leitor da escola às "
                            + ContextoAvaliacao.hora(linha.jornada().chegadaEm()) + " sem embarque registrado hoje.");
        }
    }

    /** Dois embarques no mesmo dia (atenção). */
    @Component
    public static class EmbarqueDuplicado implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            return porDivergencia(ctx, TipoDivergencia.EMBARQUE_DUPLICADO, TipoAlerta.EMBARQUE_DUPLICADO,
                    (linha, d, rotulo) -> "Aluno " + rotulo + " teve um segundo embarque hoje às "
                            + ContextoAvaliacao.hora(d.detectadaEm()) + " (primeiro às "
                            + ContextoAvaliacao.hora(linha.jornada().embarqueEm()) + ", veículo "
                            + ctx.rotuloVeiculo(linha.jornada().veiculoId()) + ").");
        }
    }

    @FunctionalInterface
    interface Texto {
        String de(Linha linha, Divergencia divergencia, String rotuloAluno);
    }

    static List<Ocorrencia> porDivergencia(ContextoAvaliacao ctx, TipoDivergencia divergencia, TipoAlerta tipo,
                                           Texto texto) {
        List<Ocorrencia> resultado = new ArrayList<>();
        for (Linha linha : ctx.linhasHoje()) {
            Optional<Divergencia> encontrada = linha.jornada().divergencias().stream()
                    .filter(d -> d.tipo() == divergencia).findFirst();
            if (encontrada.isEmpty()) {
                continue;
            }
            String rotulo = ContextoAvaliacao.rotuloAluno(linha.aluno().iniciais(), linha.aluno().id());
            resultado.add(new Ocorrencia(tipo, divergencia.severidade(), EntidadeAlerta.ALUNO,
                    String.valueOf(linha.aluno().id()), rotulo, ctx.janelaDoDia(),
                    texto.de(linha, encontrada.get(), rotulo), linha.aluno().escolaId(), linha.aluno().veiculoId()));
        }
        return resultado;
    }
}
