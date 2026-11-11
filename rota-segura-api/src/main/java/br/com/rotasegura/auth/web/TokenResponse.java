package br.com.rotasegura.auth.web;

/** Resposta de login e refresh. O refresh token não vem aqui: vai só no cookie httpOnly. */
public record TokenResponse(String accessToken, long expiraEmSegundos, UsuarioResponse usuario) {

    @Override
    public String toString() {
        return "TokenResponse[usuarioId=" + usuario.id() + "]";
    }
}
