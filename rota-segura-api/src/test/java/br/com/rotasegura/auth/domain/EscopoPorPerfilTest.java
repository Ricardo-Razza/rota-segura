package br.com.rotasegura.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** Cada perfil só vê seu escopo (item 1.2.5 e checklist do CLAUDE.md). */
class EscopoPorPerfilTest {

    /** Item fictício do painel: pertence a uma escola e/ou a um veículo. */
    record Item(String nome, Long escolaId, Long veiculoId) {
    }

    private static final List<Item> ITENS = List.of(
            new Item("escola1-veiculo7", 1L, 7L),
            new Item("escola2-veiculo8", 2L, 8L),
            new Item("escola3-veiculo7", 3L, 7L),
            new Item("escola1-sem-veiculo", 1L, null),
            new Item("sem-escola-veiculo9", null, 9L));

    @ParameterizedTest
    @EnumSource(value = Perfil.class, names = {"ADMIN", "GESTAO", "SECRETARIA"})
    void perfisGlobaisVeemTudo(Perfil perfil) {
        Escopo escopo = new Escopo(1L, perfil, Set.of(), Set.of());

        assertThat(escopo.filtrar(ITENS, Item::escolaId, Item::veiculoId)).hasSize(5);
        assertThat(escopo.podeVerEscola(99L)).isTrue();
        assertThat(escopo.podeVerVeiculo(99L)).isTrue();
    }

    @Test
    void diretorVeSoAsSuasEscolas() {
        Escopo escopo = new Escopo(2L, Perfil.DIRETOR, Set.of(1L, 2L), Set.of());

        assertThat(escopo.filtrar(ITENS, Item::escolaId, Item::veiculoId)).extracting(Item::nome)
                .containsExactly("escola1-veiculo7", "escola2-veiculo8", "escola1-sem-veiculo");
        assertThat(escopo.podeVerEscola(1L)).isTrue();
        assertThat(escopo.podeVerEscola(3L)).isFalse();
        assertThat(escopo.podeVerEscola(null)).isFalse();
        assertThat(escopo.podeVerVeiculo(7L)).isFalse();
    }

    @Test
    void monitorVeSoOsSeusVeiculos() {
        Escopo escopo = new Escopo(3L, Perfil.MONITOR, Set.of(), Set.of(7L));

        assertThat(escopo.filtrar(ITENS, Item::escolaId, Item::veiculoId)).extracting(Item::nome)
                .containsExactly("escola1-veiculo7", "escola3-veiculo7");
        assertThat(escopo.podeVerVeiculo(7L)).isTrue();
        assertThat(escopo.podeVerVeiculo(8L)).isFalse();
        assertThat(escopo.podeVerVeiculo(null)).isFalse();
        assertThat(escopo.podeVerEscola(1L)).isFalse();
    }

    @Test
    void perfilRestritoSemVinculoNaoVeNada() {
        assertThat(new Escopo(4L, Perfil.DIRETOR, null, null).filtrar(ITENS, Item::escolaId, Item::veiculoId))
                .isEmpty();
        assertThat(new Escopo(5L, Perfil.MONITOR, Set.of(1L), Set.of()).filtrar(ITENS, Item::escolaId, Item::veiculoId))
                .isEmpty();
    }

    @Test
    void permissoesPorPerfil() {
        assertThat(Perfil.MONITOR.podeRevelarContato()).isFalse();
        assertThat(Perfil.DIRETOR.podeRevelarContato()).isTrue();
        assertThat(List.of(Perfil.values())).filteredOn(Perfil::podeVerIndicadoresSensiveis)
                .containsExactly(Perfil.GESTAO, Perfil.SECRETARIA);
    }
}
