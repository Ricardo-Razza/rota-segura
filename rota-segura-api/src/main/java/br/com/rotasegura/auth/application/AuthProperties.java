package br.com.rotasegura.auth.application;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Configuração da autenticação do painel. Segredos vêm só de variável de ambiente. */
@Validated
@ConfigurationProperties("rota-segura.auth")
public record AuthProperties(
        @NotNull @Size(min = 32, message = "o segredo do JWT precisa de pelo menos 32 caracteres") String jwtSecret,
        @NotNull Duration accessTtl,
        @NotNull Duration refreshTtl,
        boolean cookieSecure,
        @NotEmpty List<String> corsOrigens,
        @Min(1) int loginMaxTentativas,
        @NotNull Duration loginJanela,
        String adminLogin,
        String adminSenha) {

    @Override
    public String toString() {
        return "AuthProperties[segredos omitidos]";
    }
}
