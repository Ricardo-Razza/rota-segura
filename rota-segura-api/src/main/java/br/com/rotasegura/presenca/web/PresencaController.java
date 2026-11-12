package br.com.rotasegura.presenca.web;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.presenca.application.PresencaService;
import br.com.rotasegura.presenca.application.PresencaService.PresencaHoje;
import br.com.rotasegura.presenca.application.PresencaService.PresencaPeriodo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Presença do dia e frequência no período (só dias letivos). */
@RestController
@RequestMapping("/api/v1/presenca")
@Tag(name = "Presença")
public class PresencaController {

    private final PresencaService presenca;

    public PresencaController(PresencaService presenca) {
        this.presenca = presenca;
    }

    @GetMapping("/hoje")
    @Operation(summary = "Contagem de hoje e lista paginada de quem ainda não chegou à escola.")
    PresencaHoje hoje(FiltroAlunos filtro,
                      @RequestParam(required = false) Integer pagina,
                      @RequestParam(required = false) Integer tamanho) {
        return presenca.hoje(filtro, pagina, tamanho);
    }

    @GetMapping("/periodo")
    @Operation(summary = "Frequência por dia letivo no período (padrão: últimos 7 dias; máximo 92).")
    PresencaPeriodo periodo(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                            LocalDate dataInicio,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                            LocalDate dataFim,
                            FiltroAlunos filtro) {
        return presenca.periodo(dataInicio, dataFim, filtro);
    }
}
