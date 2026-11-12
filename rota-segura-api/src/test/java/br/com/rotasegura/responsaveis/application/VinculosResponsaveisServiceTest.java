package br.com.rotasegura.responsaveis.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService.Indice;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService.Propriedades;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService.ResponsavelResumo;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.responsaveis.integration.ResponsavelAlunoDto;
import br.com.rotasegura.responsaveis.integration.ResponsavelDto;
import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Índice aluno → responsáveis com cliente simulado e dados fictícios. */
class VinculosResponsaveisServiceTest {

    private static final Instant AGORA = Instant.parse("2026-03-10T10:00:00Z");

    private final ResponsaveisClient cliente = mock(ResponsaveisClient.class);

    private VinculosResponsaveisService servico(int maxBuscas) {
        return new VinculosResponsaveisService(cliente, new Propriedades(true, Duration.ofMinutes(10), maxBuscas),
                Clock.fixed(AGORA, ZoneOffset.UTC));
    }

    @Test
    void antesDaPrimeiraMontagemNaoEhConfiavel() {
        Indice indice = servico(10).atual();

        assertThat(indice.pronto()).isFalse();
        assertThat(indice.confiavel()).isFalse();
        assertThat(indice.doAluno(101)).isEmpty();
    }

    @Test
    void montaOIndicePelosDetalhesDeCadaResponsavel() {
        listar(false, responsavel("1", null), responsavel("2", null), responsavel("3", "2026-01-01"));
        detalhar("1", "101", "102");
        detalhar("2", "101");

        VinculosResponsaveisService servico = servico(10);
        servico.atualizar();
        Indice indice = servico.atual();

        assertThat(indice.confiavel()).isTrue();
        assertThat(indice.montadoEm()).isEqualTo(AGORA);
        assertThat(indice.doAluno(101)).extracting(ResponsavelResumo::id).containsExactly(1L, 2L);
        assertThat(indice.doAluno(102)).extracting(ResponsavelResumo::id).containsExactly(1L);
        verify(cliente, never()).buscarPorId(3L);
    }

    @Test
    void tetoDeBuscasOuListaTruncadaDeixamOIndiceIncompleto() {
        listar(false, responsavel("1", null), responsavel("2", null));
        detalhar("1", "101");
        VinculosResponsaveisService comTeto = servico(1);
        comTeto.atualizar();
        assertThat(comTeto.atual().completo()).isFalse();
        assertThat(comTeto.atual().confiavel()).isFalse();

        listar(true, responsavel("1", null));
        VinculosResponsaveisService truncado = servico(10);
        truncado.atualizar();
        assertThat(truncado.atual().completo()).isFalse();
    }

    @Test
    void falhaNaApiMantemAVersaoAnterior() {
        listar(false, responsavel("1", null));
        detalhar("1", "101");
        VinculosResponsaveisService servico = servico(10);
        servico.atualizar();

        when(cliente.buscarPorId(anyLong())).thenThrow(new ApiExternaIndisponivelException("RESPONSAVEIS", null));
        servico.atualizar();

        assertThat(servico.atual().doAluno(101)).hasSize(1);
        assertThat(servico.atual().confiavel()).isTrue();
    }

    @Test
    void toStringNaoExpoeNome() {
        assertThat(new ResponsavelResumo(1, "Responsável Fictício").toString()).doesNotContain("Fictício");
    }

    private void listar(boolean truncada, ResponsavelDto... itens) {
        when(cliente.listarTodos()).thenReturn(new ResultadoCache<>(
                new ColecaoPaginada<>(List.of(itens), 1, truncada), AGORA, false));
    }

    private void detalhar(String id, String... alunos) {
        List<ResponsavelAlunoDto> detalhes = java.util.Arrays.stream(alunos)
                .map(a -> new ResponsavelAlunoDto(a, "Aluno Fictício " + a, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null))
                .toList();
        when(cliente.buscarPorId(Long.parseLong(id))).thenReturn(new ResultadoCache<>(
                new ResponsavelDto(id, "Responsável Fictício " + id, null, null, null, null, detalhes), AGORA, false));
    }

    private static ResponsavelDto responsavel(String id, String excluidoEm) {
        return new ResponsavelDto(id, "Responsável Fictício " + id, null, excluidoEm, null, null, null);
    }
}
