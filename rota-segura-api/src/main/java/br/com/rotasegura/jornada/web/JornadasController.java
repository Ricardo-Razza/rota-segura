package br.com.rotasegura.jornada.web;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.jornada.application.JornadasPainelService;
import br.com.rotasegura.jornada.application.JornadasPainelService.QuadroDoDia;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Jornada do aluno: quadro do dia (colunas por estado) e histórico de um aluno. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Jornada")
public class JornadasController {

    private final JornadasPainelService painel;

    public JornadasController(JornadasPainelService painel) {
        this.painel = painel;
    }

    @GetMapping("/jornadas")
    @Operation(summary = "Jornadas do dia por aluno, com total por estado. Sem data = hoje.")
    QuadroDoDia doDia(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data,
                      FiltroAlunos filtro,
                      @RequestParam(required = false) Long veiculoId,
                      @RequestParam(required = false) Integer pagina,
                      @RequestParam(required = false) Integer tamanho) {
        return painel.doDia(data, filtro, veiculoId, pagina, tamanho);
    }

    @GetMapping("/alunos/{id}/jornadas")
    @Operation(summary = "Jornadas de um aluno no período (até 31 dias). Sem datas = hoje.")
    List<JornadaDoDia> doAluno(@PathVariable long id,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                               LocalDate inicio,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                               LocalDate fim) {
        return painel.doAluno(id, inicio, fim);
    }
}
