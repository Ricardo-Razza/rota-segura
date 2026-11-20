package br.com.rotasegura.veiculos.web;

import br.com.rotasegura.veiculos.application.HistoricoDeRotasService;
import br.com.rotasegura.veiculos.application.HistoricoDeRotasService.ParadasDoVeiculo;
import br.com.rotasegura.veiculos.application.HistoricoDeRotasService.TrajetoDoDia;
import br.com.rotasegura.veiculos.application.RastreamentoService;
import br.com.rotasegura.veiculos.application.RastreamentoService.RastreamentoAoVivo;
import br.com.rotasegura.veiculos.application.RastreamentoService.RastreioVeiculo;
import br.com.rotasegura.veiculos.application.StatusVeiculosService;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.DetalheVeiculo;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusDosVeiculos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operação dos veículos hoje. */
@RestController
@RequestMapping("/api/v1/veiculos")
@Tag(name = "Veículos")
public class VeiculosController {

    private final StatusVeiculosService status;
    private final RastreamentoService rastreamento;
    private final HistoricoDeRotasService historico;

    public VeiculosController(StatusVeiculosService status, RastreamentoService rastreamento,
                              HistoricoDeRotasService historico) {
        this.status = status;
        this.rastreamento = rastreamento;
        this.historico = historico;
    }

    @GetMapping("/status")
    @Operation(summary = "Embarcados x esperados (estimado), ocupação, estado e última leitura de cada veículo.")
    StatusDosVeiculos status() {
        return status.status();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalhe do veículo: embarcados de hoje (iniciais e turma) e últimas leituras.")
    DetalheVeiculo detalhe(@PathVariable long id) {
        return status.detalhe(id);
    }

    @GetMapping("/rastreamento")
    @Operation(summary = "GPS ao vivo: posição, rastro do dia e cerca virtual dos veículos no escopo. "
            + "Atualizações chegam pelo evento SSE veiculo.posicao.")
    RastreamentoAoVivo rastreamento() {
        return rastreamento.noEscopo();
    }

    @GetMapping("/{id}/rastreamento")
    @Operation(summary = "GPS ao vivo de um veículo: posição, rastro do dia e cerca virtual.")
    RastreioVeiculo rastreamento(@PathVariable long id) {
        return rastreamento.doVeiculo(id);
    }

    @GetMapping("/{id}/trajeto")
    @Operation(summary = "Trajeto guardado de um dia (padrão: hoje) para o replay: pontos do GPS, embarques "
            + "(hora e local, sem aluno) e escola de destino. Acesso auditado.")
    TrajetoDoDia trajeto(@PathVariable long id,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data) {
        return historico.trajeto(id, data);
    }

    @GetMapping("/{id}/paradas")
    @Operation(summary = "Paradas reais aprendidas dos embarques dos últimos dias letivos, com horário típico. "
            + "Acesso auditado.")
    ParadasDoVeiculo paradas(@PathVariable long id) {
        return historico.paradas(id);
    }
}
