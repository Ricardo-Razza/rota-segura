package br.com.rotasegura.shared.application;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Métricas de negócio (Micrometer). Só contagens e tipos: nenhuma tag carrega id ou dado de aluno.
 * <ul>
 *   <li>{@code rota.alertas.criados} (contador; tags tipo, severidade)</li>
 *   <li>{@code rota.leitores.offline} (gauge, atualizado a cada ciclo de operação)</li>
 *   <li>{@code rota.api_externa.chamadas} (timer; tags recurso, resultado) — em ChamadaResiliente</li>
 * </ul>
 */
@Component
public class MetricasOperacao {

    private final MeterRegistry registro;
    private final AtomicInteger leitoresOffline = new AtomicInteger();

    public MetricasOperacao(MeterRegistry registro) {
        this.registro = registro;
        Gauge.builder("rota.leitores.offline", leitoresOffline, AtomicInteger::get)
                .description("Leitores faciais sem leitura dentro do limite configurado")
                .register(registro);
    }

    public void alertaCriado(String tipo, String severidade) {
        registro.counter("rota.alertas.criados", "tipo", tipo, "severidade", severidade).increment();
    }

    public void leitoresOffline(int quantidade) {
        leitoresOffline.set(quantidade);
    }

    public MeterRegistry registro() {
        return registro;
    }
}
