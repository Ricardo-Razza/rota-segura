package br.com.rotasegura.shared.integration;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;

/** A API externa devolve tudo como texto; estas conversões aceitam nulo, vazio e lixo sem lançar erro. */
public final class Conversoes {

    /** {@code 2026-03-10 07:42}, {@code 2026-03-10T07:42:10}, com ou sem fração de segundo. */
    private static final DateTimeFormatter DATA_HORA_ISO_LOCAL = new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd")
            .optionalStart().appendLiteral('T').optionalEnd()
            .optionalStart().appendLiteral(' ').optionalEnd()
            .appendPattern("HH:mm")
            .optionalStart().appendPattern(":ss").optionalEnd()
            .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true).optionalEnd()
            .toFormatter();

    /** {@code 10/03/2026 07:42} ou {@code 10/03/2026 07:42:10}. */
    private static final DateTimeFormatter DATA_HORA_BR = new DateTimeFormatterBuilder()
            .appendPattern("dd/MM/yyyy HH:mm")
            .optionalStart().appendPattern(":ss").optionalEnd()
            .toFormatter();

    private Conversoes() {
    }

    /**
     * Converte data e hora para o horário local de {@code zona}. Texto com fuso ({@code Z} ou {@code -03:00})
     * é convertido; texto sem fuso é tomado como já sendo da zona.
     *
     * @return a data e hora, ou {@code null} se o texto for nulo, vazio ou num formato não reconhecido
     */
    public static LocalDateTime paraDataHora(String texto, ZoneId zona) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String valor = texto.trim();
        try {
            return OffsetDateTime.parse(valor).atZoneSameInstant(zona).toLocalDateTime();
        } catch (DateTimeParseException semFuso) {
            // segue para os formatos locais
        }
        for (DateTimeFormatter formato : new DateTimeFormatter[] {DATA_HORA_ISO_LOCAL, DATA_HORA_BR}) {
            try {
                return LocalDateTime.parse(valor, formato);
            } catch (DateTimeParseException outroFormato) {
                // tenta o próximo
            }
        }
        return null;
    }

    /** @return o número, ou {@code null} se o texto for nulo, vazio ou inválido */
    public static Long paraLong(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(texto.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Aceita ponto ou vírgula como separador decimal. */
    public static Double paraDouble(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            double valor = Double.parseDouble(texto.trim().replace(',', '.'));
            return Double.isFinite(valor) ? valor : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
