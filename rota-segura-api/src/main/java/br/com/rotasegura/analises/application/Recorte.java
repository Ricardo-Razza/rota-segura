package br.com.rotasegura.analises.application;

import br.com.rotasegura.shared.application.Periodo;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Divide um período em grupos para as séries: por dia até 31 dias, por semana até 120 e por mês acima disso.
 * Assim o gráfico nunca tem centenas de pontos espremidos.
 */
public final class Recorte {

    public enum Granularidade {
        DIA, SEMANA, MES;

        static Granularidade para(Periodo periodo) {
            long dias = ChronoUnit.DAYS.between(periodo.inicio(), periodo.fim()) + 1;
            return dias <= 31 ? DIA : dias <= 120 ? SEMANA : MES;
        }

        LocalDate inicioDoGrupo(LocalDate dia) {
            return switch (this) {
                case DIA -> dia;
                case SEMANA -> dia.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                case MES -> dia.withDayOfMonth(1);
            };
        }
    }

    private final Periodo periodo;
    private final Granularidade granularidade;
    private final Map<LocalDate, Integer> indices = new LinkedHashMap<>();

    public Recorte(Periodo periodo) {
        this(periodo, Granularidade.para(periodo));
    }

    /** Recorte do período de comparação: usa a granularidade do período principal para alinhar as séries. */
    public Recorte(Periodo periodo, Granularidade granularidade) {
        this.periodo = periodo;
        this.granularidade = granularidade;
        for (LocalDate dia : periodo.dias()) {
            indices.putIfAbsent(inicio(dia), indices.size());
        }
    }

    public Granularidade granularidade() {
        return granularidade;
    }

    /** Início de cada grupo, sem passar antes do início do período. */
    public List<LocalDate> grupos() {
        return new ArrayList<>(indices.keySet());
    }

    /** Posição do grupo do dia na série; -1 fora do período. */
    public int indice(LocalDate dia) {
        if (dia.isBefore(periodo.inicio()) || dia.isAfter(periodo.fim())) {
            return -1;
        }
        return indices.get(inicio(dia));
    }

    private LocalDate inicio(LocalDate dia) {
        LocalDate grupo = granularidade.inicioDoGrupo(dia);
        return grupo.isBefore(periodo.inicio()) ? periodo.inicio() : grupo;
    }
}
