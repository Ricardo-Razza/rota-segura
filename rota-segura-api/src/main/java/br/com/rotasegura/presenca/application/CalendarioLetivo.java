package br.com.rotasegura.presenca.application;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Dias letivos: segunda a sexta, menos os dias sem aula configurados (feriados, recessos).
 * A API externa não expõe calendário escolar; a lista fica em {@code rota-segura.calendario.dias-sem-aula}.
 */
@Component
public class CalendarioLetivo {

    private final Set<LocalDate> diasSemAula;

    public CalendarioLetivo(Propriedades propriedades) {
        this.diasSemAula = Set.copyOf(propriedades.diasSemAula());
    }

    public boolean ehLetivo(LocalDate dia) {
        DayOfWeek semana = dia.getDayOfWeek();
        return semana != DayOfWeek.SATURDAY && semana != DayOfWeek.SUNDAY && !diasSemAula.contains(dia);
    }

    @ConfigurationProperties("rota-segura.calendario")
    public record Propriedades(List<LocalDate> diasSemAula) {

        public Propriedades {
            diasSemAula = diasSemAula == null ? List.of() : List.copyOf(diasSemAula);
        }
    }
}
