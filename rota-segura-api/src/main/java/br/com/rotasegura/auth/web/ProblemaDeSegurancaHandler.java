package br.com.rotasegura.auth.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** Respostas 401 e 403 do filtro de segurança no formato ProblemDetail. */
@Component
public class ProblemaDeSegurancaHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper json;

    public ProblemaDeSegurancaHandler(ObjectMapper json) {
        this.json = json;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        escrever(response, HttpStatus.UNAUTHORIZED, "Não autenticado",
                "Token ausente, inválido ou expirado.", "urn:rota-segura:erro:nao-autenticado");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
            throws IOException {
        escrever(response, HttpStatus.FORBIDDEN, "Acesso negado",
                "Você não tem permissão para esta operação.", "urn:rota-segura:erro:acesso-negado");
    }

    private void escrever(HttpServletResponse response, HttpStatus status, String titulo, String detalhe,
                          String tipo) throws IOException {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("type", tipo);
        corpo.put("title", titulo);
        corpo.put("status", status.value());
        corpo.put("detail", detalhe);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        json.writeValue(response.getWriter(), corpo);
    }
}
