package br.com.rotasegura.jornada.domain;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * @param detectadaEm horário a partir do qual a divergência vale (ex.: fim da janela, segundo embarque)
 */
public record Divergencia(TipoDivergencia tipo, LocalDateTime detectadaEm) {

    public Divergencia {
        Objects.requireNonNull(tipo, "tipo");
        Objects.requireNonNull(detectadaEm, "detectadaEm");
    }

    public Severidade severidade() {
        return tipo.severidade();
    }
}
