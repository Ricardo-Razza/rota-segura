package br.com.rotasegura.shared.integration;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tempos de vida do cache das respostas da API externa.
 *
 * @param cadastrosTtl   alunos, veículos, responsáveis e dispositivos
 * @param tempoRealTtl   presença e KPIs
 * @param ultimoValorTtl por quanto tempo o último valor bom fica disponível como "desatualizado"
 * @param janelaRevalidacao depois que o TTL vence, por quanto tempo o valor ainda é servido na hora enquanto
 *                          a atualização roda em segundo plano (nulo = 30 min)
 */
@Validated
@ConfigurationProperties("rota-segura.cache")
public record CacheProperties(
        @NotNull Duration cadastrosTtl,
        @NotNull Duration tempoRealTtl,
        @NotNull Duration ultimoValorTtl,
        Duration janelaRevalidacao) {

    public CacheProperties {
        if (janelaRevalidacao == null) {
            janelaRevalidacao = Duration.ofMinutes(30);
        }
    }
}
