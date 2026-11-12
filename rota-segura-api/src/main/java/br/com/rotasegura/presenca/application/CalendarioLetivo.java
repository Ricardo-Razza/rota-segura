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

    /** Os {@code quantidade} dias letivos imediatamente anteriores a {@code dia}, do mais recente ao mais antigo. */
    public List<LocalDate> letivosAntes(LocalDate dia, int quantidade) {
        List<LocalDate> dias = new java.util.ArrayList<>();
        LocalDate cursor = dia.minusDays(1);
        // Teto de busca: evita laço longo se o calendário marcar muitos dias sem aula seguidos.
        for (int i = 0; i < 366 && dias.size() < quantidade; i++, cursor = cursor.minusDays(1)) {
            if (ehLetivo(cursor)) {
                dias.add(cursor);
            }
        }
        return dias;
    }

    /** Dias letivos de {@code inicio} a {@code fim}, inclusive. */
    public List<LocalDate> letivosEntre(LocalDate inicio, LocalDate fim) {
        return inicio.datesUntil(fim.plusDays(1)).filter(this::ehLetivo).toList();
    }

    @ConfigurationProperties("rota-segura.calendario")
    public record Propriedades(List<LocalDate> diasSemAula) {

        public Propriedades {
            diasSemAula = diasSemAula == null ? List.of() : List.copyOf(diasSemAula);
        }
    }
}
