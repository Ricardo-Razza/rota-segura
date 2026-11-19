package br.com.rotasegura.veiculos.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import br.com.rotasegura.veiculos.domain.RastroDoDia.Cerca;
import br.com.rotasegura.veiculos.domain.RastroDoDia.Mudanca;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** Rastro do dia e cerca virtual, com coordenadas fictícias (0,001° de latitude ≈ 111 m). */
class RastroDoDiaTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 3, 10);
    private static final Cerca ESCOLA = new Cerca(50, -10.0, -50.0, 300);

    private final RastroDoDia rastro = new RastroDoDia(4, 15);

    @Test
    void distanciaENos() {
        assertThat(Geo.distanciaMetros(-10.0, -50.0, -10.001, -50.0)).isCloseTo(111.2, within(0.5));
        assertThat(Geo.distanciaMetros(-10.0, -50.0, -10.0, -50.0)).isZero();
        assertThat(Geo.nosParaKmh(10.0)).isEqualTo(18.5);
        assertThat(Geo.nosParaKmh(null)).isNull();
        assertThat(Geo.coordenadaValida(0.0, 0.0)).as("(0,0) é GPS sem sinal").isFalse();
        assertThat(Geo.coordenadaValida(-91.0, -50.0)).isFalse();
        assertThat(Geo.coordenadaValida(null, -50.0)).isFalse();
        assertThat(Geo.coordenadaValida(-10.0, -50.0)).isTrue();
    }

    @Test
    void mesmaLeituraNaoMudaNadaEPertoDemaisNaoEntraNoRastro() {
        assertThat(rastro.registrar(pos(-10.01, "07:00:00"), HOJE, ESCOLA)).isEqualTo(Mudanca.NOVO_PONTO);
        assertThat(rastro.registrar(pos(-10.01, "07:00:00"), HOJE, ESCOLA)).isEqualTo(Mudanca.NENHUMA);
        // ~5 m: posição nova, mas não vira ponto do rastro.
        assertThat(rastro.registrar(pos(-10.01005, "07:00:05"), HOJE, ESCOLA)).isEqualTo(Mudanca.POSICAO);
        assertThat(rastro.registrar(pos(-10.0095, "07:00:10"), HOJE, ESCOLA)).isEqualTo(Mudanca.NOVO_PONTO);

        assertThat(rastro.pontos()).hasSize(2);
        assertThat(rastro.atual().registradaEm()).isEqualTo(HOJE.atTime(7, 0, 10));
    }

    @Test
    void restauraSoOTrajetoDeHojeERespeitaOTeto() {
        rastro.restaurar(java.util.List.of(
                new RastroDoDia.PontoRastro(-10.03, -50.0, HOJE.minusDays(1).atTime(17, 0)),
                new RastroDoDia.PontoRastro(-10.02, -50.0, HOJE.atTime(6, 50)),
                new RastroDoDia.PontoRastro(-10.019, -50.0, HOJE.atTime(6, 51))), HOJE);
        assertThat(rastro.pontos()).extracting(RastroDoDia.PontoRastro::em)
                .containsExactly(HOJE.atTime(6, 50), HOJE.atTime(6, 51));

        // Depois de restaurado, a próxima posição continua o mesmo trajeto.
        assertThat(rastro.registrar(pos(-10.018, "06:52:00"), HOJE, ESCOLA)).isEqualTo(Mudanca.NOVO_PONTO);
        assertThat(rastro.pontos()).hasSize(3);
    }

    @Test
    void guardaSoOsPontosMaisRecentes() {
        for (int i = 0; i < 6; i++) {
            rastro.registrar(pos(-10.02 + i * 0.001, "07:0" + i + ":00"), HOJE, ESCOLA);
        }
        assertThat(rastro.pontos()).hasSize(4);
        assertThat(rastro.pontos().get(0).em()).isEqualTo(HOJE.atTime(7, 2));
    }

    @Test
    void cercaMarcaAEntradaESaidaZera() {
        rastro.registrar(pos(-10.01, "07:00:00"), HOJE, ESCOLA);
        assertThat(rastro.naCercaDesde()).as("1,1 km da escola").isNull();

        rastro.registrar(pos(-10.002, "07:20:00"), HOJE, ESCOLA);
        rastro.registrar(pos(-10.001, "07:21:00"), HOJE, ESCOLA);
        assertThat(rastro.naCercaDesde()).as("primeira posição dentro do raio").isEqualTo(HOJE.atTime(7, 20));

        rastro.registrar(pos(-10.01, "07:40:00"), HOJE, ESCOLA);
        assertThat(rastro.naCercaDesde()).isNull();
    }

    @Test
    void posicaoDeOutroDiaNaoEntraNoRastroNemNaCerca() {
        PosicaoVeiculo ontem = new PosicaoVeiculo(-10.0, -50.0, 0.0, null, false,
                LocalDateTime.of(2026, 3, 9, 18, 0));
        assertThat(rastro.registrar(ontem, HOJE, ESCOLA)).isEqualTo(Mudanca.POSICAO);
        assertThat(rastro.atual()).isEqualTo(ontem);
        assertThat(rastro.pontos()).isEmpty();
        assertThat(rastro.naCercaDesde()).isNull();
    }

    @Test
    void viradaDoDiaRecomecaORastro() {
        rastro.registrar(pos(-10.001, "07:00:00"), HOJE, ESCOLA);
        assertThat(rastro.naCercaDesde()).isNotNull();

        LocalDate amanha = HOJE.plusDays(1);
        rastro.registrar(new PosicaoVeiculo(-10.01, -50.0, 30.0, 90.0, true, amanha.atTime(6, 30)), amanha, ESCOLA);
        assertThat(rastro.pontos()).hasSize(1);
        assertThat(rastro.pontos().get(0).em()).isEqualTo(amanha.atTime(6, 30));
        assertThat(rastro.naCercaDesde()).isNull();
    }

    @Test
    void semCercaNaoMarcaEntrada() {
        rastro.registrar(pos(-10.0, "07:00:00"), HOJE, null);
        assertThat(rastro.naCercaDesde()).isNull();
        assertThat(rastro.pontos()).hasSize(1);
    }

    private static PosicaoVeiculo pos(double latitude, String hora) {
        return new PosicaoVeiculo(latitude, -50.0, 30.0, 180.0, true,
                LocalDateTime.parse(HOJE + "T" + hora));
    }
}
