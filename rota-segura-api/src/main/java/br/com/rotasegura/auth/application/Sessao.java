package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.Usuario;

/** Resultado de um login ou refresh: token de acesso, novo refresh token e o usuário. */
public record Sessao(String accessToken, long expiraEmSegundos, String refreshToken, Usuario usuario) {

    @Override
    public String toString() {
        return "Sessao[usuarioId=" + usuario.getId() + "]";
    }
}
