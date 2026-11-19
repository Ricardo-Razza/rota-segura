package br.com.rotasegura.shared.integration;

import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Clock;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import jakarta.annotation.PreDestroy;
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
    private static final java.time.Duration JANELA_MAXIMA_TEMPO_REAL = java.time.Duration.ofMinutes(2);

    private final CircuitBreakerRegistry circuitBreakers;
    private final RetryRegistry retries;
    private final Clock clock;
    private final MeterRegistry metricas;
    private final Map<Recurso, Cache<String, ResultadoCache<?>>> recentes = new EnumMap<>(Recurso.class);
    /** Valores já vencidos que ainda podem ser servidos enquanto a atualização roda em segundo plano. */
    private final Map<Recurso, Cache<String, ResultadoCache<?>>> revalidaveis = new EnumMap<>(Recurso.class);
    private final Cache<String, ResultadoCache<?>> ultimosValores;
    private final Map<String, CompletableFuture<ResultadoCache<?>>> emAndamento = new ConcurrentHashMap<>();
    private final ExecutorService segundoPlano = Executors.newVirtualThreadPerTaskExecutor();

    public ChamadaResiliente(CircuitBreakerRegistry circuitBreakers, RetryRegistry retries,
                             CacheProperties cache, Clock clock, MeterRegistry metricas) {
        this.metricas = metricas;
        this.circuitBreakers = circuitBreakers;
        this.retries = retries;
        this.clock = clock;
        for (Recurso recurso : Recurso.values()) {
            var ttl = recurso.tempoReal() ? cache.tempoRealTtl() : cache.cadastrosTtl();
            recentes.put(recurso, Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(5_000).build());
            // Presença não pode parecer "ao vivo" estando velha: no tempo real a janela é de no máximo 2 min.
            var janela = recurso.tempoReal() && cache.janelaRevalidacao().compareTo(JANELA_MAXIMA_TEMPO_REAL) > 0
                    ? JANELA_MAXIMA_TEMPO_REAL : cache.janelaRevalidacao();
            revalidaveis.put(recurso, Caffeine.newBuilder()
                    .expireAfterWrite(ttl.plus(janela))
                    .maximumSize(5_000)
                    .build());
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
        Timer.Sample inicio = Timer.start(metricas);
        String resultado = "erro";
        try {
            T valor = circuitBreaker.executeSupplier(Retry.decorateSupplier(retry, chamada));
            resultado = "sucesso";
            return valor;
        } catch (CallNotPermittedException e) {
            resultado = "circuito-aberto";
            throw e;
        } finally {
            inicio.stop(Timer.builder("rota.api_externa.chamadas")
                    .description("Latência das chamadas GET à API externa, com retry")
                    .tag("recurso", recurso.nome())
                    .tag("resultado", resultado)
                    .register(metricas));
        }
    }

    /**
     * Devolve o valor do cache se ainda válido. Se venceu mas ainda está dentro da janela de revalidação,
     * devolve esse valor na hora (com a hora em que foi obtido) e atualiza em segundo plano: ninguém espera
     * a coleção inteira ser relida. Sem nada em cache, busca na hora; pedidos simultâneos da mesma chave
     * compartilham uma única busca.
     * Se a chamada falhar por indisponibilidade da API, devolve o último valor bom como desatualizado.
     */
    @SuppressWarnings("unchecked")
    public <T> ResultadoCache<T> comCache(Recurso recurso, String chave, Supplier<T> chamada) {
        ResultadoCache<?> recente = recentes.get(recurso).getIfPresent(chave);
        if (recente != null) {
            return (ResultadoCache<T>) recente;
        }
        ResultadoCache<?> anterior = revalidaveis.get(recurso).getIfPresent(chave);
        if (anterior != null) {
            revalidarEmSegundoPlano(recurso, chave, chamada);
            return (ResultadoCache<T>) anterior;
        }
        return buscarUmaVez(recurso, chave, chamada);
    }

    private <T> void revalidarEmSegundoPlano(Recurso recurso, String chave, Supplier<T> chamada) {
        if (emAndamento.containsKey(recurso.nome() + ':' + chave)) {
            return;
        }
        segundoPlano.execute(() -> {
            try {
                buscarUmaVez(recurso, chave, chamada);
            } catch (RuntimeException e) {
                log.warn("Falha ao atualizar o cache em segundo plano. recurso={} motivo={}",
                        recurso.nome(), e.getClass().getSimpleName());
            }
        });
    }

    /** Busca e guarda; quem chega enquanto a mesma chave já está sendo buscada espera essa busca. */
    @SuppressWarnings("unchecked")
    private <T> ResultadoCache<T> buscarUmaVez(Recurso recurso, String chave, Supplier<T> chamada) {
        String chaveGlobal = recurso.nome() + ':' + chave;
        CompletableFuture<ResultadoCache<?>> minha = new CompletableFuture<>();
        CompletableFuture<ResultadoCache<?>> existente = emAndamento.putIfAbsent(chaveGlobal, minha);
        if (existente != null) {
            try {
                return (ResultadoCache<T>) existente.join();
            } catch (CompletionException e) {
                throw e.getCause() instanceof RuntimeException r ? r : e;
            }
        }
        try {
            ResultadoCache<T> resultado = buscar(recurso, chave, chamada);
            minha.complete(resultado);
            return resultado;
        } catch (RuntimeException e) {
            minha.completeExceptionally(e);
            throw e;
        } finally {
            emAndamento.remove(chaveGlobal, minha);
        }
    }

    @SuppressWarnings("unchecked")
    private <T> ResultadoCache<T> buscar(Recurso recurso, String chave, Supplier<T> chamada) {
        String chaveGlobal = recurso.nome() + ':' + chave;
        try {
            var resultado = new ResultadoCache<>(chamada.get(), clock.instant(), false);
            recentes.get(recurso).put(chave, resultado);
            revalidaveis.get(recurso).put(chave, resultado);
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
        revalidaveis.get(recurso).invalidateAll();
    }

    /** Descarta os valores recentes (os "últimos valores bons" são mantidos). */
    public void invalidarRecentes() {
        recentes.values().forEach(Cache::invalidateAll);
        revalidaveis.values().forEach(Cache::invalidateAll);
    }

    @PreDestroy
    void encerrar() {
        segundoPlano.shutdownNow();
    }

    /** Descarta tudo, inclusive os últimos valores bons. */
    public void limparTudo() {
        invalidarRecentes();
        ultimosValores.invalidateAll();
    }
}
