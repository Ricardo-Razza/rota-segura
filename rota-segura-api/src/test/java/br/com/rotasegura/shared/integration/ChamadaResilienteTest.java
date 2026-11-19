package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Cache com revalidação em segundo plano e busca única por chave (sem API real: só fornecedores locais). */
class ChamadaResilienteTest {

    /** TTL curto só para ALUNOS (cadastro), usado no teste de vencimento. */
    private static final Duration TTL = Duration.ofMillis(100);
    /**
     * PRESENCA (tempo real) com TTL longo: no teste de concorrência nenhuma thread lenta do CI pode chegar
     * depois do vencimento e disparar uma revalidação legítima, que contaria como segunda busca.
     */
    private static final Duration TTL_LONGO = Duration.ofHours(1);

    private ChamadaResiliente chamada;
    private ExecutorService threads;

    @BeforeEach
    void criar() {
        var props = new CacheProperties(TTL, TTL_LONGO, Duration.ofHours(1), Duration.ofMinutes(30));
        chamada = new ChamadaResiliente(CircuitBreakerRegistry.ofDefaults(), RetryRegistry.ofDefaults(), props,
                Clock.systemUTC(), new SimpleMeterRegistry());
        threads = Executors.newFixedThreadPool(4);
    }

    @AfterEach
    void encerrar() {
        threads.shutdownNow();
        chamada.encerrar();
    }

    @Test
    void cacheVencidoRespondeNaHoraComOValorAnteriorEAtualizaEmSegundoPlano() throws Exception {
        AtomicInteger versao = new AtomicInteger();
        CountDownLatch liberar = new CountDownLatch(1);
        var primeira = chamada.comCache(Recurso.ALUNOS, "k", () -> "v" + versao.incrementAndGet());
        assertThat(primeira.valor()).isEqualTo("v1");

        Thread.sleep(TTL.toMillis() * 2);
        // A atualização fica presa até liberar: a resposta não pode esperar por ela.
        long inicio = System.nanoTime();
        var vencida = chamada.comCache(Recurso.ALUNOS, "k", () -> {
            aguardar(liberar);
            return "v" + versao.incrementAndGet();
        });
        // A atualização está presa no latch (até 5 s): responder bem antes disso prova que não esperou.
        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofSeconds(2));
        assertThat(vencida.valor()).isEqualTo("v1");
        assertThat(vencida.obtidoEm()).isEqualTo(primeira.obtidoEm());

        liberar.countDown();
        long limite = System.currentTimeMillis() + 10_000;
        Object atual = vencida.valor();
        while (!"v2".equals(atual) && System.currentTimeMillis() < limite) {
            Thread.sleep(20);
            atual = chamada.comCache(Recurso.ALUNOS, "k", () -> "nao-deveria-buscar").valor();
        }
        assertThat(atual).isEqualTo("v2");
    }

    @Test
    void pedidosSimultaneosDaMesmaChaveFazemUmaUnicaBusca() throws Exception {
        AtomicInteger buscas = new AtomicInteger();
        CountDownLatch todosChegaram = new CountDownLatch(1);
        Future<?>[] pedidos = new Future<?>[4];
        for (int i = 0; i < pedidos.length; i++) {
            pedidos[i] = threads.submit(() -> chamada.comCache(Recurso.PRESENCA, "todas", () -> {
                buscas.incrementAndGet();
                aguardar(todosChegaram);
                return "dados";
            }).valor());
        }
        Thread.sleep(300);
        todosChegaram.countDown();
        for (Future<?> pedido : pedidos) {
            assertThat(pedido.get(10, TimeUnit.SECONDS)).isEqualTo("dados");
        }
        assertThat(buscas).hasValue(1);
    }

    @Test
    void depoisDeInvalidarBuscaDeNovoNaHora() {
        chamada.comCache(Recurso.ALUNOS, "k", () -> "antigo");
        chamada.invalidarRecentes(Recurso.ALUNOS);
        assertThat(chamada.comCache(Recurso.ALUNOS, "k", () -> "novo").valor()).isEqualTo("novo");
    }

    private static void aguardar(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
