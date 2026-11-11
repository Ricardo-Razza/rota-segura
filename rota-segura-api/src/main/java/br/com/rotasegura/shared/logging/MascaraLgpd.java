package br.com.rotasegura.shared.logging;

import java.util.regex.Pattern;

/** Remove padrões de e-mail, CPF e telefone de um texto de log (LGPD). */
public final class MascaraLgpd {

    private static final Pattern EMAIL =
            Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern CPF =
            Pattern.compile("(?<!\\d)\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}(?!\\d)");
    private static final Pattern TELEFONE =
            Pattern.compile("(?<!\\d)(?:\\+?55[\\s-]?)?\\(?\\d{2}\\)?[\\s-]?9?\\d{4}[\\s-]?\\d{4}(?!\\d)");

    private MascaraLgpd() {
    }

    public static String mascarar(String texto) {
        if (texto == null || texto.isEmpty()) {
            return texto;
        }
        String resultado = EMAIL.matcher(texto).replaceAll("[EMAIL]");
        resultado = CPF.matcher(resultado).replaceAll("[CPF]");
        return TELEFONE.matcher(resultado).replaceAll("[TELEFONE]");
    }
}
