package br.com.rotasegura.shared.application;

import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Stream;

/** Intervalo fechado de datas, validado: início antes do fim e no máximo {@code maximoDias} dias. */
public record Periodo(LocalDate inicio, LocalDate fim) {

    public static Periodo validar(LocalDate inicio, LocalDate fim, int maximoDias) {
        if (inicio == null || fim == null) {
            throw new RequisicaoInvalidaException("Informe a data de início e a de fim.");
        }
        if (fim.isBefore(inicio)) {
            throw new RequisicaoInvalidaException("A data de fim é anterior à de início.");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) + 1 > maximoDias) {
            throw new RequisicaoInvalidaException("O período pode ter no máximo " + maximoDias + " dias.");
        }
        return new Periodo(inicio, fim);
    }

    public List<LocalDate> dias() {
        return Stream.iterate(inicio, d -> !d.isAfter(fim), d -> d.plusDays(1)).toList();
    }
}
