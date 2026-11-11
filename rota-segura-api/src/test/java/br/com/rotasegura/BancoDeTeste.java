package br.com.rotasegura;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;

/** PostgreSQL descartável para os testes de integração (exige Docker em execução). */
@TestConfiguration(proxyBeanMethods = false)
public class BancoDeTeste {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>("postgres:17-alpine");
    }
}
