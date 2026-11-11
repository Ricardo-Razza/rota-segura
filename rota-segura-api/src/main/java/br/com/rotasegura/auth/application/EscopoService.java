package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

/**
 * Ponto único para aplicar o escopo do usuário autenticado nos serviços.
 * Todo serviço que devolve dados de escola, veículo ou aluno passa por aqui.
 */
@Service
public class EscopoService {

    /** @throws AcessoNegadoException se não houver usuário autenticado */
    public Escopo atual() {
        Authentication autenticacao = SecurityContextHolder.getContext().getAuthentication();
        if (!(autenticacao instanceof JwtAuthenticationToken token)) {
            throw new AcessoNegadoException("Usuário não autenticado.");
        }
        Jwt jwt = token.getToken();
        return new Escopo(
                Long.valueOf(jwt.getSubject()),
                Perfil.valueOf(jwt.getClaimAsString(TokenService.CLAIM_PERFIL)),
                ids(jwt, TokenService.CLAIM_ESCOLAS),
                ids(jwt, TokenService.CLAIM_VEICULOS));
    }

    public <T> List<T> filtrar(Collection<T> itens, Function<T, Long> escolaDe, Function<T, Long> veiculoDe) {
        return atual().filtrar(itens, escolaDe, veiculoDe);
    }

    public void exigirEscola(Long escolaId) {
        if (!atual().podeVerEscola(escolaId)) {
            throw new AcessoNegadoException("Escola fora do seu escopo.");
        }
    }

    public void exigirVeiculo(Long veiculoId) {
        if (!atual().podeVerVeiculo(veiculoId)) {
            throw new AcessoNegadoException("Veículo fora do seu escopo.");
        }
    }

    private static Set<Long> ids(Jwt jwt, String claim) {
        Object valor = jwt.getClaim(claim);
        if (!(valor instanceof Collection<?> colecao)) {
            return Set.of();
        }
        return colecao.stream()
                .filter(Number.class::isInstance)
                .map(numero -> ((Number) numero).longValue())
                .collect(Collectors.toUnmodifiableSet());
    }
}
