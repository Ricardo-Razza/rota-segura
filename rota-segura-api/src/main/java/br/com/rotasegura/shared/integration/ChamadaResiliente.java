package br.com.rotasegura.shared.integration;

import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import java.time.Clock;
import java.util.EnumMap;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

/**
 * Envolve as chamadas à API externa com retry, circuit breaker e cache.
 * Quando a API falha, devolve o último valor bom marcado como desatualizado.
 */
@Component
public class ChamadaResiliente {

    private static final Logger log = LoggerFactory.getLogger(ChamadaResiliente.class);

    private final CircuitBreakerRegistry circuitBreakers;
    private final RetryRegistry retries;
    private final Clock clock;
    private final Map<Recurso, Cache<String, ResultadoCache<?>>> recentes = new EnumMap<>(Recurso.class);
    private final Cache<String, ResultadoCache<?>> ultimosValores;

    public ChamadaResiliente(CircuitBreakerRegistry circuitBreakers, RetryRegistry retries,
                             CacheProperties cache, Clock clock) {
        this.circuitBreakers = circuitBreakers;
        this.retries = retries;
        this.clock = clock;
        for (Recurso recurso : Recurso.values()) {
            var ttl = recurso.tempoReal() ? cache.tempoRealTtl() : cache.cadastrosTtl();
            recentes.put(recurso, Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(5_000).build());
        }
        this.ultimosValores = Caffeine.newBuilder()
                .expireAfterWrite(cache.ultimoValorTtl())
                .maximumSize(5_000)
                .build();
    }

    /** Executa a chamada com retry (5xx/timeout) dentro do circuit breaker do recurso. */
    public <T> T protegida(Recurso recurso, Supplier<T> chamada) {
        CircuitBreaker circuitBreaker = circuitBreakers.circuitBreaker(recurso.nome());
        Retry retry = retries.retry(recurso.nome());
        return circuitBreaker.executeSupplier(Retry.decorateSupplier(retry, chamada));
    }

    /**
     * Devolve o valor do cache se ainda válido; senão executa a chamada e guarda o resultado.
     * Se a chamada falhar por indisponibilidade da API, devolve o último valor bom como desatualizado.
     */
    @SuppressWarnings("unchecked")
    public <T> ResultadoCache<T> comCache(Recurso recurso, String chave, Supplier<T> chamada) {
        Cache<String, ResultadoCache<?>> cache = recentes.get(recurso);
        ResultadoCache<?> recente = cache.getIfPresent(chave);
        if (recente != null) {
            return (ResultadoCache<T>) recente;
        }
        String chaveGlobal = recurso.nome() + ':' + chave;
        try {
            var resultado = new ResultadoCache<>(chamada.get(), clock.instant(), false);
            cache.put(chave, resultado);
            ultimosValores.put(chaveGlobal, resultado);
            return resultado;
        } catch (HttpServerErrorException | ResourceAccessException | CallNotPermittedException e) {
            ResultadoCache<?> ultimo = ultimosValores.getIfPresent(chaveGlobal);
            if (ultimo != null) {
                log.warn("API externa indisponível; servindo valor desatualizado. recurso={} motivo={}",
                        recurso.nome(), e.getClass().getSimpleName());
                return (ResultadoCache<T>) ultimo.comoDesatualizado();
            }
            log.error("API externa indisponível e sem valor em cache. recurso={} motivo={}",
                    recurso.nome(), e.getClass().getSimpleName());
            throw new ApiExternaIndisponivelException(recurso.nome(), e);
        }
    }

    /** Descarta os valores recentes de um recurso (ex.: depois de sincronizar alunos). */
    public void invalidarRecentes(Recurso recurso) {
        recentes.get(recurso).invalidateAll();
    }

    /** Descarta os valores recentes (os "últimos valores bons" são mantidos). */
    public void invalidarRecentes() {
        recentes.values().forEach(Cache::invalidateAll);
    }

    /** Descarta tudo, inclusive os últimos valores bons. */
    public void limparTudo() {
        invalidarRecentes();
        ultimosValores.invalidateAll();
    }
}
