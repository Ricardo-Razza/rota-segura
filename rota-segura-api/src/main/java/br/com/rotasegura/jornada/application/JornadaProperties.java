package br.com.rotasegura.jornada.application;

import br.com.rotasegura.jornada.domain.RegrasJornada;
import jakarta.validation.constraints.NotNull;
import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Regras da jornada (CLAUDE.md, seções 1 e 2). Nada disso é fixo no código.
 *
 * @param zona                  fuso das escolas; leituras sem fuso são tomadas como desta zona
 * @param janelaSemChegada      embarcado há mais que isso sem chegada gera {@code EMBARCOU_SEM_CHEGADA}
 * @param intervaloDuplicidade  mesmo aluno no mesmo leitor dentro deste intervalo é leitura duplicada
 * @param limiteAusencia        sem leitura até este horário, o aluno fica {@code AUSENTE}
 * @param limiteAusenciaPorTurno limite próprio por turno da matrícula (chave sem acento, maiúscula)
 * @param tiposLeitor           valores de {@code tipo_de_uso_dispositivo_id} de cada papel
 */
@Validated
@ConfigurationProperties("rota-segura.jornada")
public record JornadaProperties(
        @NotNull ZoneId zona,
        @NotNull Duration janelaSemChegada,
        @NotNull Duration intervaloDuplicidade,
        @NotNull LocalTime limiteAusencia,
        Map<String, LocalTime> limiteAusenciaPorTurno,
        @NotNull TiposLeitor tiposLeitor) {

    public JornadaProperties {
        Map<String, LocalTime> normalizado = new HashMap<>();
        if (limiteAusenciaPorTurno != null) {
            limiteAusenciaPorTurno.forEach((turno, limite) -> normalizado.put(normalizarTurno(turno), limite));
        }
        limiteAusenciaPorTurno = Map.copyOf(normalizado);
        // Valida já na subida: regras inválidas não podem esperar a primeira leitura para falhar.
        new RegrasJornada(janelaSemChegada, intervaloDuplicidade);
    }

    public RegrasJornada regras() {
        return new RegrasJornada(janelaSemChegada, intervaloDuplicidade);
    }

    /** Limite de ausência do turno da matrícula; sem turno ou turno não configurado, o padrão. */
    public LocalTime limiteAusenciaDoTurno(String turno) {
        if (turno == null || turno.isBlank()) {
            return limiteAusencia;
        }
        return limiteAusenciaPorTurno.getOrDefault(normalizarTurno(turno), limiteAusencia);
    }

    static String normalizarTurno(String turno) {
        String semAcento = Normalizer.normalize(turno.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toUpperCase(Locale.ROOT);
    }

    /** Valores de {@code tipo_de_uso_dispositivo_id} para leitor de embarque (ônibus) e de chegada (escola). */
    public record TiposLeitor(List<String> embarque, List<String> chegada) {

        public TiposLeitor {
            embarque = limpar(embarque);
            chegada = limpar(chegada);
            Set<String> repetidos = new HashSet<>(embarque);
            repetidos.retainAll(chegada);
            if (!repetidos.isEmpty()) {
                throw new IllegalArgumentException(
                        "tipo de leitor configurado como embarque e chegada ao mesmo tempo: " + repetidos);
            }
        }

        private static List<String> limpar(List<String> valores) {
            return valores == null ? List.of() : valores.stream().map(String::trim).filter(v -> !v.isEmpty()).toList();
        }
    }
}
