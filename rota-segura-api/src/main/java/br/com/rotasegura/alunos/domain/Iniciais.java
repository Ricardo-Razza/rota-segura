package br.com.rotasegura.alunos.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Iniciais para cards e avatares: primeira letra do primeiro e do último nome. */
public final class Iniciais {

    private Iniciais() {
    }

    public static String de(String nome) {
        if (nome == null || nome.isBlank()) {
            return "?";
        }
        List<String> partes = Arrays.stream(nome.trim().split("\\s+"))
                .filter(p -> !p.isEmpty() && Character.isLetter(p.codePointAt(0)))
                .toList();
        if (partes.isEmpty()) {
            return "?";
        }
        String primeira = primeiraLetra(partes.getFirst());
        return partes.size() == 1 ? primeira : primeira + primeiraLetra(partes.getLast());
    }

    private static String primeiraLetra(String parte) {
        return new String(Character.toChars(parte.codePointAt(0))).toUpperCase(Locale.ROOT);
    }
}
