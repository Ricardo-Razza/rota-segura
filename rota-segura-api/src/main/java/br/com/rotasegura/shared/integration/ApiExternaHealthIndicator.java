package br.com.rotasegura.shared.integration;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Saúde da API externa a partir dos circuit breakers (não faz chamada extra à API).
 * Algum circuito aberto = DEGRADADO (o painel serve o último valor bom); todos abertos = fora do ar.
 * Os detalhes (estado por recurso) só aparecem para quem tem permissão.
 */
@Component("apiExterna")
public class ApiExternaHealthIndicator implements HealthIndicator {

    private final CircuitBreakerRegistry circuitos;

    public ApiExternaHealthIndicator(CircuitBreakerRegistry circuitos) {
        this.circuitos = circuitos;
    }

    @Override
    public Health health() {
        Map<String, String> estados = new LinkedHashMap<>();
        int abertos = 0;
        for (Recurso recurso : Recurso.values()) {
            CircuitBreaker.State estado = circuitos.circuitBreaker(recurso.nome()).getState();
            estados.put(recurso.nome(), estado.name());
            if (estado == CircuitBreaker.State.OPEN || estado == CircuitBreaker.State.FORCED_OPEN) {
                abertos++;
            }
        }
        Health.Builder saude = abertos == 0 ? Health.up()
                : abertos == Recurso.values().length ? Health.outOfService() : Health.status("DEGRADADO");
        return saude.withDetails(estados).build();
    }
}
