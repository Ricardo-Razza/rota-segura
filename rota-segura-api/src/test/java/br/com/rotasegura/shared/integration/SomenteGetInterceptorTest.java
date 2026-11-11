package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpResponse;

class SomenteGetInterceptorTest {

    private final SomenteGetInterceptor interceptor = new SomenteGetInterceptor();
    private final HttpRequest request = mock(HttpRequest.class);
    private final ClientHttpRequestExecution execution = mock(ClientHttpRequestExecution.class);

    @Test
    void deixaPassarGet() throws IOException {
        ClientHttpResponse resposta = mock(ClientHttpResponse.class);
        when(request.getMethod()).thenReturn(HttpMethod.GET);
        when(execution.execute(request, new byte[0])).thenReturn(resposta);

        assertThat(interceptor.intercept(request, new byte[0], execution)).isSameAs(resposta);
        verify(execution).execute(request, new byte[0]);
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void bloqueiaQualquerOutroMetodo(String metodo) {
        when(request.getMethod()).thenReturn(HttpMethod.valueOf(metodo));

        assertThatThrownBy(() -> interceptor.intercept(request, new byte[0], execution))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(metodo);
        verifyNoInteractions(execution);
    }
}
