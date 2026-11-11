package br.com.rotasegura.auth.domain;

/** Mascara telefone e e-mail para exibição padrão no painel. */
public final class MascaraContato {

    private MascaraContato() {
    }

    /**
     * E-mail: mantém a primeira letra e o domínio. Telefone: mantém só os 4 últimos dígitos.
     * Nulo ou vazio vira texto vazio.
     */
    public static String mascarar(String contato) {
        if (contato == null || contato.isBlank()) {
            return "";
        }
        String valor = contato.trim();
        int arroba = valor.indexOf('@');
        if (arroba > 0) {
            return valor.charAt(0) + "*".repeat(arroba - 1) + valor.substring(arroba);
        }
        long digitos = valor.chars().filter(Character::isDigit).count();
        StringBuilder mascarado = new StringBuilder(valor.length());
        long vistos = 0;
        for (char c : valor.toCharArray()) {
            if (Character.isDigit(c)) {
                vistos++;
                mascarado.append(vistos > digitos - 4 ? c : '*');
            } else {
                mascarado.append(c);
            }
        }
        return mascarado.toString();
    }
}
