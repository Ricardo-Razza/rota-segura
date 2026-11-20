package br.com.rotasegura.veiculos.domain;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.veiculos.domain.ParadasAprendidas.EmbarqueLocalizado;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas.Parada;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Paradas aprendidas dos embarques. Coordenadas fictícias (0,0001° de latitude ≈ 11 m). */
class ParadasAprendidasTest {

    private static EmbarqueLocalizado embarque(double latitude, int dia, int hora, int minuto, long aluno) {
        return new EmbarqueLocalizado(latitude, -50.0, LocalDateTime.of(2026, 3, dia, hora, minuto), aluno);
    }

    @Test
    void embarquesProximosViramUmaParadaEIsoladoNao() {
        List<Parada> paradas = ParadasAprendidas.agrupar(List.of(
                embarque(-10.0100, 9, 6, 50, 1),
                embarque(-10.0101, 10, 6, 52, 1),
                embarque(-10.0102, 11, 6, 54, 2),
                // ~1 km dali, só uma vez: não é parada.
                embarque(-10.0200, 11, 7, 5, 3)), 50, 3);

        assertThat(paradas).hasSize(1);
        Parada p = paradas.getFirst();
        assertThat(p.embarques()).isEqualTo(3);
        assertThat(p.alunos()).isEqualTo(2);
        assertThat(p.dias()).isEqualTo(3);
        assertThat(p.horariosTipicos()).containsExactly(LocalTime.of(6, 52));
        assertThat(p.latitude()).isEqualTo(-10.0101);
    }

    @Test
    void mesmaParadaEmDoisTurnosTemDoisHorariosTipicos() {
        List<Parada> paradas = ParadasAprendidas.agrupar(List.of(
                embarque(-10.01, 9, 6, 50, 1), embarque(-10.01, 10, 6, 52, 1),
                embarque(-10.01, 9, 17, 30, 1), embarque(-10.01, 10, 17, 34, 1)), 50, 3);

        assertThat(paradas).singleElement()
                .satisfies(p -> assertThat(p.horariosTipicos()).containsExactly(LocalTime.of(6, 51),
                        LocalTime.of(17, 32)));
    }

    @Test
    void paradasSaemNaOrdemDoHorario() {
        List<EmbarqueLocalizado> embarques = new java.util.ArrayList<>();
        for (int dia = 9; dia <= 11; dia++) {
            embarques.add(embarque(-10.03, dia, 7, 10, 5));
            embarques.add(embarque(-10.01, dia, 6, 50, 6));
        }
        List<Parada> paradas = ParadasAprendidas.agrupar(embarques, 50, 3);
        assertThat(paradas).extracting(Parada::latitude).containsExactly(-10.01, -10.03);
    }

    @Test
    void paradoDesdeOPrimeiroPontoNoLocalAtual() {
        List<PontoRastro> rastro = List.of(
                new PontoRastro(-10.0200, -50.0, LocalDateTime.of(2026, 3, 10, 7, 0)),
                new PontoRastro(-10.0100, -50.0, LocalDateTime.of(2026, 3, 10, 7, 5)),
                new PontoRastro(-10.0101, -50.0, LocalDateTime.of(2026, 3, 10, 7, 7)));
        PosicaoVeiculo atual = new PosicaoVeiculo(-10.0101, -50.0, 0.0, null, false,
                LocalDateTime.of(2026, 3, 10, 7, 12));

        assertThat(ParadasAprendidas.paradoDesde(rastro, atual, 30)).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 5));
        assertThat(ParadasAprendidas.paradoDesde(List.of(), atual, 30)).isEqualTo(atual.registradaEm());
    }

    @Test
    void paradaMaisProximaComDistancia() {
        Parada perto = new Parada(-10.01, -50.0, 3, 1, 3, List.of(LocalTime.of(7, 0)));
        Parada longe = new Parada(-10.05, -50.0, 3, 1, 3, List.of(LocalTime.of(7, 0)));
        assertThat(ParadasAprendidas.maisProxima(List.of(longe, perto), -10.011, -50.0))
                .hasValueSatisfying(p -> {
                    assertThat(p.parada()).isEqualTo(perto);
                    assertThat(p.distanciaM()).isBetween(100.0, 120.0);
                });
        assertThat(ParadasAprendidas.maisProxima(List.of(), 0, 0)).isEmpty();
    }
}
