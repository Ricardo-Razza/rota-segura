package br.com.rotasegura.veiculos.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.application.JornadaProperties;
import br.com.rotasegura.shared.application.CentralDeEventos;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import br.com.rotasegura.veiculos.application.RastreamentoService.PosicaoAoVivo;
import br.com.rotasegura.veiculos.application.RastreamentoService.RastreioVeiculo;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto.Atributos;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto.LocalizacaoDto;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.ResourceAccessException;

/** Consulta periódica do GPS com relógio fixo (10/03/2026 08:00 em Brasília) e dados fictícios. */
class RastreamentoServiceTest {

    private static final Instant AGORA = Instant.parse("2026-03-10T11:00:00Z");

    private final VeiculosClient veiculos = mock(VeiculosClient.class);
    private final DispositivosClient dispositivos = mock(DispositivosClient.class);
    private final CentralDeEventos eventos = mock(CentralDeEventos.class);
    private final JornadaProperties jornada = mock(JornadaProperties.class);
    private RastreamentoService servico;

    @BeforeEach
    void cenario() {
        when(jornada.zona()).thenReturn(ZoneId.of("America/Sao_Paulo"));
        servico = new RastreamentoService(veiculos, dispositivos, eventos, mock(EscopoService.class),
                Clock.fixed(AGORA, ZoneOffset.UTC), jornada,
                new RastreamentoProperties(true, null, 300, null, null, null, null));
        when(veiculos.listarTodos()).thenReturn(atual(List.of(
                new VeiculoDto("7", "AAA0A07", null, null, "R-7", null, null, "P-07"),
                new VeiculoDto("8", "BBB0B08", null, null, "R-8", null, null, "P-08"),
                new VeiculoDto("9", "CCC0C09", null, null, "", null, null, "P-09"))));
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                new DispositivoFacialDto("11", "Leitor fictício", "7", null, "P-07", "R-7", "1", null,
                        "-10.0", "-50.0", "50"))));
    }

    @Test
    void publicaSoQuandoAPosicaoMudaEConverteVelocidadeEFuso() {
        when(veiculos.dados(7)).thenReturn(dados(-10.01, "2026-03-10T07:59:55.000-03:00", 10.0));

        assertThat(servico.atualizar()).isEqualTo(1);
        assertThat(servico.atualizar()).as("mesma leitura do rastreador").isZero();

        ArgumentCaptor<Object> evento = ArgumentCaptor.forClass(Object.class);
        verify(eventos, times(1)).publicar(eq(RastreamentoService.EVENTO_POSICAO), evento.capture(), eq(50L),
                eq(7L), eq(true));
        PosicaoAoVivo aoVivo = (PosicaoAoVivo) evento.getValue();
        assertThat(aoVivo.novoPonto()).isTrue();
        assertThat(aoVivo.veiculo().rastro()).as("evento não carrega o rastro inteiro").isEmpty();
        assertThat(aoVivo.veiculo().posicao().velocidadeKmh()).isEqualTo(18.5);
        assertThat(aoVivo.veiculo().posicao().registradaEm()).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 59, 55));
        assertThat(aoVivo.veiculo().atrasada()).isFalse();
        assertThat(aoVivo.veiculo().distanciaEscolaM()).isBetween(1100.0, 1125.0);

        RastreioVeiculo guardado = servico.todos().get(7L);
        assertThat(guardado.rastro()).hasSize(1);
    }

    @Test
    void veiculoSemRastreadorNaoEConsultadoEFalhaNumNaoParaOsOutros() {
        when(veiculos.dados(7)).thenThrow(new ResourceAccessException("timeout fictício"));
        when(veiculos.dados(8)).thenReturn(dados(-10.5, "2026-03-10T07:59:00-03:00", 0.0));

        assertThat(servico.atualizar()).isEqualTo(1);

        verify(veiculos, never()).dados(9);
        assertThat(servico.todos()).containsOnlyKeys(8L);
        assertThat(servico.todos().get(8L).escolaId()).as("sem leitor ligado: sem cerca").isNull();
    }

    @Test
    void localizacaoComErroDoRastreadorOuSemSinalEDescartada() {
        // O ERP devolve {"msg": ..., "error": true} no lugar da posição quando o rastreador falha.
        when(veiculos.dados(7)).thenReturn(new DadosVeiculoDto(
                new LocalizacaoDto(null, null, null, null, null, null, null)));
        when(veiculos.dados(8)).thenReturn(new DadosVeiculoDto(
                new LocalizacaoDto(-10.0, -50.0, 0.0, 0.0, "2026-03-10T07:59:00-03:00", false, null)));

        assertThat(servico.atualizar()).isZero();
        verify(eventos, never()).publicar(any(), any(), any(), any(), anyBoolean());
    }

    @Test
    void falhaDepoisDeUmaPosicaoBoaMantemAUltimaEMarcaFalhando() {
        when(veiculos.dados(7)).thenReturn(dados(-10.01, "2026-03-10T07:30:00-03:00", 0.0))
                .thenThrow(new ResourceAccessException("timeout fictício"));

        servico.atualizar();
        servico.atualizar();

        RastreioVeiculo r = servico.todos().get(7L);
        assertThat(r.falhando()).isTrue();
        assertThat(r.atrasada()).as("posição de 30 min atrás").isTrue();
        assertThat(r.posicao()).isNotNull();
    }

    private static DadosVeiculoDto dados(double latitude, String fixTime, double nos) {
        return new DadosVeiculoDto(new LocalizacaoDto(latitude, -50.0, nos, 180.0, fixTime, true,
                new Atributos(true)));
    }

    private static <T> ResultadoCache<ColecaoPaginada<T>> atual(List<T> itens) {
        return new ResultadoCache<>(new ColecaoPaginada<>(itens, 1, false), AGORA, false);
    }
}
