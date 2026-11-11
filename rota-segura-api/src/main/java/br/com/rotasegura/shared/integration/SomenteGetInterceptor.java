package br.com.rotasegura.shared.integration;

import java.io.IOException;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

/** Trava de segurança: nesta fase nada além de GET sai para a API externa. */
public class SomenteGetInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        if (!HttpMethod.GET.equals(request.getMethod())) {
            throw new IllegalStateException(
                    "Somente GET é permitido na API externa; método bloqueado: " + request.getMethod());
        }
        return execution.execute(request, body);
    }
}
