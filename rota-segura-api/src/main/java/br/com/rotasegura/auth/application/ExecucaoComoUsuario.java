package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.Usuario;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Executa uma tarefa em segundo plano com o escopo de um usuário (ex.: relatório agendado),
 * para que os serviços apliquem as mesmas regras de escopo de uma requisição dele.
 * O token montado aqui nunca sai do processo.
 */
@Component
public class ExecucaoComoUsuario {

    public <T> T executar(Usuario usuario, Supplier<T> tarefa) {
        SecurityContext anterior = SecurityContextHolder.getContext();
        SecurityContext contexto = SecurityContextHolder.createEmptyContext();
        Instant agora = Instant.now();
        Jwt jwt = Jwt.withTokenValue("interno")
                .header("alg", "none")
                .subject(String.valueOf(usuario.getId()))
                .claim(TokenService.CLAIM_PERFIL, usuario.getPerfil().name())
                .claim(TokenService.CLAIM_ESCOLAS, usuario.getEscolas().stream().sorted().toList())
                .claim(TokenService.CLAIM_VEICULOS, usuario.getVeiculos().stream().sorted().toList())
                .issuedAt(agora)
                .expiresAt(agora.plusSeconds(300))
                .build();
        contexto.setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getPerfil().name()))));
        SecurityContextHolder.setContext(contexto);
        try {
            return tarefa.get();
        } finally {
            SecurityContextHolder.setContext(anterior);
        }
    }
}
