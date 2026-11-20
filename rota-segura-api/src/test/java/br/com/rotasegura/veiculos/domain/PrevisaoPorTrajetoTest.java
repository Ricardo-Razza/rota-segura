package br.com.rotasegura.veiculos.domain;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.veiculos.domain.CorredorDaRota.DiaDeRota;
import br.com.rotasegura.veiculos.domain.PrevisaoPorTrajeto.Previsao;
import br.com.rotasegura.veiculos.domain.RastroDoDia.Cerca;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** Previsão pela posição: escola fictícia em (-10, -50); o ônibus sai de ~1,1 km ao sul. */
class PrevisaoPorTrajetoTest {

    private static final Cerca ESCOLA = new Cerca(50, -10.0, -50.0, 300);
    private static final LocalDateTime AGORA = LocalDateTime.of(2026, 3, 10, 7, 5);
    private static final PosicaoVeiculo LONGE = new PosicaoVeiculo(-10.010, -50.0, 30.0, null, true, AGORA);

    /** Um dia em que o ônibus passou pela partida às 07:00 e entrou na cerca depois de {@code minutos}. */
    private static DiaDeRota dia(int dia, int minutos) {
        LocalDateTime partida = LocalDateTime.of(2026, 3, dia, 7, 0);
        return new DiaDeRota(LocalDate.of(2026, 3, dia), List.of(
                new PontoRastro(-10.010, -50.0, partida),
                new PontoRastro(-10.006, -50.0, partida.plusMinutes(minutos / 2)),
                new PontoRastro(-10.001, -50.0, partida.plusMinutes(minutos))));
    }

    private static Optional<Previsao> estimar(PosicaoVeiculo atual, List<DiaDeRota> dias) {
        return PrevisaoPorTrajeto.estimar(atual, AGORA, dias, ESCOLA, 300, Duration.ofMinutes(90), 3);
    }

    @Test
    void usaAMedianaDoTempoRestanteEComparaComOHorarioNormal() {
        Optional<Previsao> previsao = estimar(LONGE, List.of(dia(5, 18), dia(6, 20), dia(9, 22)));

        assertThat(previsao).hasValueSatisfying(p -> {
            assertThat(p.restanteMin()).isEqualTo(20);
            assertThat(p.chegada()).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 25));
            assertThat(p.chegadaNormal()).isEqualTo(LocalTime.of(7, 20));
            assertThat(p.diferencaMin()).as("5 min depois do normal").isEqualTo(5);
            assertThat(p.diasUsados()).isEqualTo(3);
        });
    }

    @Test
    void semDiasSuficientesNaoPreve() {
        assertThat(estimar(LONGE, List.of(dia(5, 18), dia(6, 20)))).isEmpty();
    }

    @Test
    void passagemEmOutroHorarioNaoConta() {
        // Agora são 07:05; uma passagem às 17:00 é outra viagem.
        DiaDeRota tarde = new DiaDeRota(LocalDate.of(2026, 3, 4), List.of(
                new PontoRastro(-10.010, -50.0, LocalDateTime.of(2026, 3, 4, 17, 0)),
                new PontoRastro(-10.001, -50.0, LocalDateTime.of(2026, 3, 4, 17, 20))));
        assertThat(estimar(LONGE, List.of(dia(5, 18), dia(6, 20), tarde))).isEmpty();
    }

    @Test
    void longeDeQualquerPassagemOuJaNaEscolaNaoPreve() {
        List<DiaDeRota> dias = List.of(dia(5, 18), dia(6, 20), dia(9, 22));
        PosicaoVeiculo foraDoCaminho = new PosicaoVeiculo(-10.010, -50.02, 30.0, null, true, AGORA);
        PosicaoVeiculo naEscola = new PosicaoVeiculo(-10.0005, -50.0, 0.0, null, false, AGORA);
        assertThat(estimar(foraDoCaminho, dias)).isEmpty();
        assertThat(estimar(naEscola, dias)).isEmpty();
    }
}
