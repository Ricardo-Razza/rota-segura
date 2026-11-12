package br.com.rotasegura.alertas.web;

import br.com.rotasegura.alertas.application.AlertasService;
import br.com.rotasegura.alertas.application.AlertasService.AlertaResposta;
import br.com.rotasegura.alertas.application.AlertasService.ListaDeAlertas;
import br.com.rotasegura.alertas.domain.StatusAlerta;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.jornada.domain.Severidade;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Alertas da operação (persistidos no banco próprio; nada é escrito na API externa). */
@RestController
@RequestMapping("/api/v1/alertas")
@Tag(name = "Alertas")
public class AlertasController {

    private final AlertasService alertas;

    public AlertasController(AlertasService alertas) {
        this.alertas = alertas;
    }

    @GetMapping
    @Operation(summary = "Alertas no escopo, com o resumo de abertos por severidade (só ABERTO).")
    ListaDeAlertas listar(@RequestParam(required = false) StatusAlerta status,
                          @RequestParam(required = false) Severidade severidade,
                          @RequestParam(required = false) TipoAlerta tipo,
                          @RequestParam(required = false) Integer pagina,
                          @RequestParam(required = false) Integer tamanho) {
        return alertas.listar(status, severidade, tipo, pagina, tamanho);
    }

    @GetMapping("/resumo")
    @Operation(summary = "Só os contadores (badge do menu).")
    AlertasService.ResumoAlertas resumo() {
        return alertas.resumoAtual();
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Assumir (EM_ANALISE) ou resolver (RESOLVIDO, comentário obrigatório).")
    AlertaResposta alterar(@PathVariable long id, @Valid @RequestBody AlteracaoAlerta pedido) {
        return alertas.alterar(id, pedido.status(), pedido.comentario());
    }

    public record AlteracaoAlerta(@NotNull StatusAlerta status, @Size(max = 1000) String comentario) {

        @Override
        public String toString() {
            return "AlteracaoAlerta[status=" + status + "]";
        }
    }
}
