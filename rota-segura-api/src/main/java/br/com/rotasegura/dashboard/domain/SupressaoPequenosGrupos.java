package br.com.rotasegura.dashboard.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Supressão de grupos pequenos em indicadores sensíveis (CLAUDE.md, regra 6).
 * Grupo com menos de {@code minimo} alunos sai como suprimido. Se só um grupo for suprimido, o menor dos
 * restantes também é (supressão complementar): senão o valor escondido sairia da subtração do total.
 */
public final class SupressaoPequenosGrupos {

    public static final int MINIMO_PADRAO = 5;

    private SupressaoPequenosGrupos() {
    }

    public static List<Grupo> aplicar(Map<String, Long> contagens, int minimo) {
        List<Grupo> grupos = new ArrayList<>();
        contagens.forEach((rotulo, qtd) -> grupos.add(new Grupo(rotulo, qtd, qtd < minimo)));
        long suprimidos = grupos.stream().filter(Grupo::suprimido).count();
        if (suprimidos == 1) {
            grupos.stream().filter(g -> !g.suprimido())
                    .min(Comparator.comparingLong(Grupo::quantidadeReal))
                    .ifPresent(menor -> grupos.set(grupos.indexOf(menor), new Grupo(menor.rotulo(), menor.quantidadeReal(), true)));
        }
        return grupos.stream()
                .map(g -> g.suprimido() ? new Grupo(g.rotulo(), null, true) : g)
                .sorted(Comparator.comparing(Grupo::rotulo))
                .toList();
    }

    /** @param quantidadeReal nula quando suprimido (o valor nunca sai daqui) */
    public record Grupo(String rotulo, Long quantidadeReal, boolean suprimido) {

        public Long quantidade() {
            return suprimido ? null : quantidadeReal;
        }
    }
}
