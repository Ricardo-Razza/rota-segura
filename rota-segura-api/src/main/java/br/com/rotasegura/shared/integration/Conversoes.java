package br.com.rotasegura.shared.integration;

/** A API externa devolve tudo como texto; estas conversões aceitam nulo, vazio e lixo sem lançar erro. */
public final class Conversoes {

    private Conversoes() {
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
