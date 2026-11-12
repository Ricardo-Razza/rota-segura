package br.com.rotasegura.shared.application;

import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Tempo real do painel (SSE). Cada assinante recebe só os eventos do seu escopo; os últimos eventos ficam
 * guardados para repor o que a conexão perdeu ({@code Last-Event-ID}). Heartbeat a cada 15 s.
 */
@Service
public class CentralDeEventos {

    public static final String HEARTBEAT = "heartbeat";
    static final int EVENTOS_GUARDADOS = 1000;
    static final long TEMPO_CONEXAO_MS = 30 * 60 * 1000L;

    private static final Logger LOG = LoggerFactory.getLogger(CentralDeEventos.class);

    private final ObjectMapper json;
    private final AtomicLong sequencia = new AtomicLong();
    private final Deque<Evento> recentes = new ArrayDeque<>();
    private final List<Assinante> assinantes = new CopyOnWriteArrayList<>();

    public CentralDeEventos(ObjectMapper json) {
        this.json = json;
    }

    /**
     * Publica um evento.
     *
     * @param escolaId  escola do evento (DIRETOR recebe só das suas)
     * @param veiculoId veículo do evento (MONITOR recebe só dos seus)
     * @param restrito  falso para sinais sem dado de entidade (ex.: "presença mudou"), entregues a todos
     */
    public Evento publicar(String tipo, Object dados, Long escolaId, Long veiculoId, boolean restrito) {
        Evento evento;
        synchronized (recentes) {
            evento = new Evento(sequencia.incrementAndGet(), tipo, serializar(dados), escolaId, veiculoId, restrito);
            recentes.addLast(evento);
            while (recentes.size() > EVENTOS_GUARDADOS) {
                recentes.removeFirst();
            }
        }
        assinantes.forEach(a -> entregar(a, evento));
        return evento;
    }

    /** Abre a conexão SSE do usuário e repõe os eventos depois de {@code ultimoId}. */
    public SseEmitter conectar(Escopo escopo, String ultimoId) {
        SseEmitter emitter = new SseEmitter(TEMPO_CONEXAO_MS);
        Assinante assinante = new AssinanteSse(escopo, emitter);
        emitter.onCompletion(() -> assinantes.remove(assinante));
        emitter.onTimeout(() -> assinantes.remove(assinante));
        emitter.onError(e -> assinantes.remove(assinante));
        registrar(assinante, ultimoId);
        return emitter;
    }

    /** Registra o assinante, repondo primeiro o que ele perdeu. Visível para os testes. */
    void registrar(Assinante assinante, String ultimoId) {
        Long desde = parse(ultimoId);
        List<Evento> perdidos = new ArrayList<>();
        synchronized (recentes) {
            if (desde != null) {
                recentes.stream().filter(e -> e.id() > desde).forEach(perdidos::add);
            }
            assinantes.add(assinante);
        }
        perdidos.forEach(e -> entregar(assinante, e));
        if (perdidos.isEmpty()) {
            // Primeiro evento abre o stream no cliente (sem ele o indicador fica "reconectando" até o heartbeat).
            entregar(assinante, new Evento(sequencia.get(), HEARTBEAT, "{}", null, null, false));
        }
    }

    @Scheduled(fixedRateString = "${rota-segura.tempo-real.heartbeat:15s}")
    public void heartbeat() {
        Evento batida = new Evento(sequencia.get(), HEARTBEAT, "{}", null, null, false);
        assinantes.forEach(a -> entregar(a, batida));
    }

    /** Usuários distintos conectados agora, por perfil. */
    public Map<Perfil, Long> conectadosPorPerfil() {
        Map<Perfil, Set<Long>> usuarios = new EnumMap<>(Perfil.class);
        for (Assinante a : assinantes) {
            usuarios.computeIfAbsent(a.escopo().perfil(), p -> new HashSet<>()).add(a.escopo().usuarioId());
        }
        Map<Perfil, Long> resultado = new EnumMap<>(Perfil.class);
        for (Perfil p : Perfil.values()) {
            resultado.put(p, (long) usuarios.getOrDefault(p, Set.of()).size());
        }
        return resultado;
    }

    public int conexoes() {
        return assinantes.size();
    }

    private void entregar(Assinante assinante, Evento evento) {
        if (!podeVer(assinante.escopo(), evento)) {
            return;
        }
        try {
            assinante.enviar(evento);
        } catch (IOException | IllegalStateException e) {
            // Conexão caiu: o cliente reconecta com Last-Event-ID.
            assinantes.remove(assinante);
        }
    }

    static boolean podeVer(Escopo escopo, Evento evento) {
        if (!evento.restrito() || escopo.perfil().escopoGlobal()) {
            return true;
        }
        return !escopo.filtrar(List.of(evento), Evento::escolaId, Evento::veiculoId).isEmpty();
    }

    private String serializar(Object dados) {
        try {
            return json.writeValueAsString(dados);
        } catch (JsonProcessingException e) {
            LOG.warn("Evento não serializável descartado. motivo={}", e.getClass().getSimpleName());
            return "{}";
        }
    }

    private static Long parse(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(id.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public record Evento(long id, String tipo, String dados, Long escolaId, Long veiculoId, boolean restrito) {
    }

    interface Assinante {
        Escopo escopo();

        void enviar(Evento evento) throws IOException;
    }

    private record AssinanteSse(Escopo escopo, SseEmitter emitter) implements Assinante {

        @Override
        public void enviar(Evento evento) throws IOException {
            emitter.send(SseEmitter.event().id(String.valueOf(evento.id())).name(evento.tipo()).data(evento.dados()));
        }
    }
}
