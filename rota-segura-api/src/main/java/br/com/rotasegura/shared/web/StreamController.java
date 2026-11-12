package br.com.rotasegura.shared.web;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.shared.application.CentralDeEventos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Stream de tempo real. O token vai no cabeçalho Authorization (o painel usa fetch, não EventSource). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Tempo real")
public class StreamController {

    private final CentralDeEventos central;
    private final EscopoService escopo;

    public StreamController(CentralDeEventos central, EscopoService escopo) {
        this.central = central;
        this.escopo = escopo;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Eventos: presenca.atualizada, jornada.atualizada, veiculo.atualizado, alerta.criado, "
            + "alerta.atualizado e heartbeat (15 s). Reenvie Last-Event-ID para repor o que perdeu.")
    SseEmitter stream(@RequestHeader(name = "Last-Event-ID", required = false) String ultimoId) {
        return central.conectar(escopo.atual(), ultimoId);
    }
}
