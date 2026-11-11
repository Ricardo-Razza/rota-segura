package br.com.rotasegura.shared.web;

import br.com.rotasegura.shared.erro.AcessoNegadoException;
import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Erros no formato ProblemDetail (RFC 9457). As respostas nunca carregam dado pessoal nem stack trace. */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiExternaIndisponivelException.class)
    ProblemDetail apiExternaIndisponivel(ApiExternaIndisponivelException e) {
        ProblemDetail problema = problema(HttpStatus.SERVICE_UNAVAILABLE, "Fonte de dados indisponível",
                "A fonte de dados está indisponível no momento. Tente de novo em instantes.",
                "api-externa-indisponivel");
        problema.setProperty("recurso", e.getRecurso());
        return problema;
    }

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    ProblemDetail naoEncontrado(RecursoNaoEncontradoException e) {
        return problema(HttpStatus.NOT_FOUND, "Recurso não encontrado", e.getMessage(), "nao-encontrado");
    }

    @ExceptionHandler(AcessoNegadoException.class)
    ProblemDetail foraDoEscopo(AcessoNegadoException e) {
        return problema(HttpStatus.FORBIDDEN, "Acesso negado", e.getMessage(), "acesso-negado");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail acessoNegado(AccessDeniedException e) {
        return problema(HttpStatus.FORBIDDEN, "Acesso negado",
                "Você não tem permissão para esta operação.", "acesso-negado");
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail naoAutenticado(AuthenticationException e) {
        return problema(HttpStatus.UNAUTHORIZED, "Não autenticado",
                "Token ausente, inválido ou expirado.", "nao-autenticado");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail erroInesperado(Exception e) {
        // Só o tipo da exceção vai para o log: a mensagem pode conter dado pessoal.
        log.error("Erro inesperado: {}", e.getClass().getName());
        return problema(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno", "Ocorreu um erro inesperado.", "interno");
    }

    private static ProblemDetail problema(HttpStatus status, String titulo, String detalhe, String tipo) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setType(URI.create("urn:rota-segura:erro:" + tipo));
        return problema;
    }
}
