package br.com.rotasegura;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MySQLContainer;

/** MySQL descartável para os testes de integração (exige Docker em execução). */
@TestConfiguration(proxyBeanMethods = false)
public class BancoDeTeste {

    @Bean
    @ServiceConnection
    MySQLContainer<?> mysql() {
        return new MySQLContainer<>("mysql:8.4");
    }
}
