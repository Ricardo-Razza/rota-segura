package br.com.rotasegura.veiculos.domain;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.veiculos.domain.CorredorDaRota.DiaDeRota;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Caminho habitual: uma reta fictícia de norte a sul (0,001° ≈ 110 m). */
class CorredorDaRotaTest {

    private static DiaDeRota reta(int dia) {
        List<PontoRastro> pontos = new ArrayList<>();
        for (int i = 0; i <= 20; i++) {
            pontos.add(new PontoRastro(-10.0 - i * 0.0005, -50.0, LocalDateTime.of(2026, 3, dia, 7, i)));
        }
        return new DiaDeRota(LocalDate.of(2026, 3, dia), pontos);
    }

    private static PontoRastro ponto(double lat, double lon, int minuto) {
        return new PontoRastro(lat, lon, LocalDateTime.of(2026, 3, 10, 7, minuto));
    }

    @Test
    void pertoDoCaminhoEstaDentroLongeNao() {
        CorredorDaRota corredor = new CorredorDaRota(List.of(reta(5), reta(6), new DiaDeRota(LocalDate.of(2026, 3, 9),
                List.of())));

        assertThat(corredor.dias()).isEqualTo(2);
        // ~110 m a leste da reta.
        assertThat(corredor.distanciaAte(-10.005, -50.001, 300)).hasValueSatisfying(d -> assertThat(d).isBetween(100.0, 120.0));
        assertThat(corredor.dentro(-10.005, -50.001, 300)).isTrue();
        // ~550 m a leste.
        assertThat(corredor.dentro(-10.005, -50.005, 300)).isFalse();
        assertThat(new CorredorDaRota(List.of()).dentro(-10.005, -50.0, 300)).isFalse();
    }

    @Test
    void foraDesdeOPrimeiroPontoDaSaidaDoCaminho() {
        CorredorDaRota corredor = new CorredorDaRota(List.of(reta(5)));
        List<PontoRastro> hoje = List.of(
                ponto(-10.003, -50.0, 0),
                ponto(-10.004, -50.005, 3),
                ponto(-10.005, -50.006, 5));
        PosicaoVeiculo atual = new PosicaoVeiculo(-10.005, -50.006, 20.0, null, true,
                LocalDateTime.of(2026, 3, 10, 7, 6));

        assertThat(corredor.foraDesde(hoje, atual, 300)).contains(LocalDateTime.of(2026, 3, 10, 7, 3));

        PosicaoVeiculo voltou = new PosicaoVeiculo(-10.006, -50.0, 20.0, null, true,
                LocalDateTime.of(2026, 3, 10, 7, 8));
        assertThat(corredor.foraDesde(hoje, voltou, 300)).isEmpty();
    }
}
