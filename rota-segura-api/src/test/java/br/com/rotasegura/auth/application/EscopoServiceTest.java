package br.com.rotasegura.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class EscopoServiceTest {

    private final EscopoService servico = new EscopoService();

    @AfterEach
    void limpar() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void semAutenticacaoNegaAcesso() {
        assertThatThrownBy(servico::atual).isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    void leEscopoDoTokenEAplicaNoFiltro() {
        autenticar(Perfil.DIRETOR, List.of(1, 2L), List.of());

        Escopo escopo = servico.atual();

        assertThat(escopo.usuarioId()).isEqualTo(10L);
        assertThat(escopo.perfil()).isEqualTo(Perfil.DIRETOR);
        assertThat(escopo.escolas()).containsExactlyInAnyOrder(1L, 2L);
        assertThat(servico.filtrar(List.of(1L, 2L, 3L), id -> id, id -> null)).containsExactly(1L, 2L);
        assertThatCode(() -> servico.exigirEscola(2L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> servico.exigirEscola(3L)).isInstanceOf(AcessoNegadoException.class);
        assertThatThrownBy(() -> servico.exigirVeiculo(7L)).isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    void monitorSoPassaPelosSeusVeiculos() {
        autenticar(Perfil.MONITOR, List.of(), List.of(7));

        assertThatCode(() -> servico.exigirVeiculo(7L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> servico.exigirVeiculo(8L)).isInstanceOf(AcessoNegadoException.class);
        assertThatThrownBy(() -> servico.exigirEscola(1L)).isInstanceOf(AcessoNegadoException.class);
    }

    private static void autenticar(Perfil perfil, List<?> escolas, List<?> veiculos) {
        Jwt jwt = Jwt.withTokenValue("token-de-teste")
                .header("alg", "HS256")
                .subject("10")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .claim(TokenService.CLAIM_PERFIL, perfil.name())
                .claim(TokenService.CLAIM_ESCOLAS, escolas)
                .claim(TokenService.CLAIM_VEICULOS, veiculos)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
