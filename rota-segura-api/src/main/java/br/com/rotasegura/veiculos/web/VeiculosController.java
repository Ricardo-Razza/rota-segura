package br.com.rotasegura.veiculos.web;

import br.com.rotasegura.veiculos.application.StatusVeiculosService;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.DetalheVeiculo;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusDosVeiculos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operação dos veículos hoje. */
@RestController
@RequestMapping("/api/v1/veiculos")
@Tag(name = "Veículos")
public class VeiculosController {

    private final StatusVeiculosService status;

    public VeiculosController(StatusVeiculosService status) {
        this.status = status;
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
}
