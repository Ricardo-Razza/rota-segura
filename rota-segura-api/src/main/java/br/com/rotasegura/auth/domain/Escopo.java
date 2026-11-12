package br.com.rotasegura.auth.domain;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * O que o usuário autenticado pode ver.
 * ADMIN, GESTAO e SECRETARIA veem tudo; DIRETOR só suas escolas; MONITOR só seus veículos.
 */
public record Escopo(Long usuarioId, Perfil perfil, Set<Long> escolas, Set<Long> veiculos) {

    public Escopo {
        escolas = escolas == null ? Set.of() : Set.copyOf(escolas);
        veiculos = veiculos == null ? Set.of() : Set.copyOf(veiculos);
    }

    /** Escopo das tarefas em segundo plano (avaliação de alertas, tempo real): vê tudo, sem usuário. */
    public static Escopo sistema() {
        return new Escopo(null, Perfil.ADMIN, Set.of(), Set.of());
    }

    public boolean podeVerEscola(Long escolaId) {
        if (perfil.escopoGlobal()) {
            return true;
        }
        return perfil == Perfil.DIRETOR && escolaId != null && escolas.contains(escolaId);
    }

    public boolean podeVerVeiculo(Long veiculoId) {
        if (perfil.escopoGlobal()) {
            return true;
        }
        return perfil == Perfil.MONITOR && veiculoId != null && veiculos.contains(veiculoId);
    }

    /**
     * Mantém só os itens dentro do escopo. Para DIRETOR vale a escola do item; para MONITOR, o veículo.
     * Item sem escola/veículo informado nunca aparece para perfil restrito.
     */
    public <T> List<T> filtrar(Collection<T> itens, Function<T, Long> escolaDe, Function<T, Long> veiculoDe) {
        if (perfil.escopoGlobal()) {
            return List.copyOf(itens);
        }
        return itens.stream()
                .filter(item -> perfil == Perfil.DIRETOR
                        ? podeVerEscola(escolaDe.apply(item))
                        : podeVerVeiculo(veiculoDe.apply(item)))
                .toList();
    }
}
