package br.com.rotasegura.auth.application;

/** Erros do fluxo de autenticação. As mensagens são genéricas de propósito. */
public final class AuthExceptions {

    private AuthExceptions() {
    }

    /** Login ou senha incorretos, ou usuário inativo (a resposta não diz qual). */
    public static class CredenciaisInvalidasException extends RuntimeException {
        public CredenciaisInvalidasException() {
            super("Login ou senha inválidos.");
        }
    }

    /** Tentativas de login demais na janela configurada. */
    public static class MuitasTentativasException extends RuntimeException {
        public MuitasTentativasException() {
            super("Muitas tentativas de login. Aguarde e tente de novo.");
        }
    }

    /** Refresh token ausente, desconhecido, expirado, já usado ou revogado. */
    public static class RefreshInvalidoException extends RuntimeException {
        public RefreshInvalidoException() {
            super("Sessão expirada. Entre de novo.");
        }
    }
}
