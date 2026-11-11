package br.com.rotasegura.auth.web;

import br.com.rotasegura.auth.application.AuthExceptions.CredenciaisInvalidasException;
import br.com.rotasegura.auth.application.AuthExceptions.MuitasTentativasException;
import br.com.rotasegura.auth.application.AuthExceptions.RefreshInvalidoException;
import java.net.URI;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Erros do fluxo de autenticação em ProblemDetail. */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthExceptionHandler {

    @ExceptionHandler(CredenciaisInvalidasException.class)
    ProblemDetail credenciaisInvalidas(CredenciaisInvalidasException e) {
        return problema(HttpStatus.UNAUTHORIZED, "Credenciais inválidas", e.getMessage(), "credenciais-invalidas");
    }

    @ExceptionHandler(RefreshInvalidoException.class)
    ProblemDetail refreshInvalido(RefreshInvalidoException e) {
        return problema(HttpStatus.UNAUTHORIZED, "Sessão expirada", e.getMessage(), "sessao-expirada");
    }

    @ExceptionHandler(MuitasTentativasException.class)
    ProblemDetail muitasTentativas(MuitasTentativasException e) {
        return problema(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas", e.getMessage(), "muitas-tentativas");
    }

    private static ProblemDetail problema(HttpStatus status, String titulo, String detalhe, String tipo) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setType(URI.create("urn:rota-segura:erro:" + tipo));
        return problema;
    }
}
