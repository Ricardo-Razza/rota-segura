package br.com.rotasegura.shared.integration;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Configuração do acesso à API externa. Tudo vem de variável de ambiente ou do application.yml. */
@Validated
@ConfigurationProperties("rota-segura.api-externa")
public record ApiExternaProperties(
        @NotBlank String baseUrl,
        String authorization,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout,
        @Min(1) int maxPaginas,
        @NotBlank String parametroPagina) {
}
