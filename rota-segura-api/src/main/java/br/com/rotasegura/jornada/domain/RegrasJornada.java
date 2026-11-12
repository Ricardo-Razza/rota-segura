package br.com.rotasegura.jornada.domain;

import java.time.Duration;
import java.util.Objects;

/**
 * Parâmetros do motor.
 *
 * @param janelaSemChegada     tempo após o embarque sem chegada que gera {@code EMBARCOU_SEM_CHEGADA}
 * @param intervaloDuplicidade mesma pessoa no mesmo leitor dentro deste intervalo é leitura duplicada
 */
public record RegrasJornada(Duration janelaSemChegada, Duration intervaloDuplicidade) {

    public RegrasJornada {
        Objects.requireNonNull(janelaSemChegada, "janelaSemChegada");
        Objects.requireNonNull(intervaloDuplicidade, "intervaloDuplicidade");
        if (janelaSemChegada.isNegative() || janelaSemChegada.isZero()) {
            throw new IllegalArgumentException("janelaSemChegada deve ser positiva");
        }
        if (intervaloDuplicidade.isNegative()) {
            throw new IllegalArgumentException("intervaloDuplicidade não pode ser negativo");
        }
    }
}
