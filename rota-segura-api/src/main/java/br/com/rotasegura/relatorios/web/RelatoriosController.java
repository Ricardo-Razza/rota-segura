package br.com.rotasegura.relatorios.web;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.relatorios.application.RelatoriosAgendadosService;
import br.com.rotasegura.relatorios.application.RelatoriosAgendadosService.Agendamento;
import br.com.rotasegura.relatorios.application.RelatoriosService;
import br.com.rotasegura.relatorios.application.RelatoriosService.Exportacao;
import br.com.rotasegura.relatorios.application.RelatoriosService.Formato;
import br.com.rotasegura.relatorios.application.RelatoriosService.Pedido;
import br.com.rotasegura.relatorios.application.RelatoriosService.Previa;
import br.com.rotasegura.relatorios.domain.TipoRelatorio;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** Relatórios: prévia, exportação (CSV/PDF, auditada) e agendamento semanal por e-mail. */
@RestController
@RequestMapping("/api/v1/relatorios")
@Tag(name = "Relatórios")
public class RelatoriosController {

    private final RelatoriosService relatorios;
    private final RelatoriosAgendadosService agendados;

    public RelatoriosController(RelatoriosService relatorios, RelatoriosAgendadosService agendados) {
        this.relatorios = relatorios;
        this.agendados = agendados;
    }

    @PostMapping("/previa")
    @Operation(summary = "Primeiras 20 linhas e total, antes de exportar. Sem datas = últimos 7 dias.")
    Previa previa(@RequestBody PedidoRequest pedido) {
        return relatorios.previa(pedido.paraPedido());
    }

    @GetMapping("/frequencia.csv")
    ResponseEntity<StreamingResponseBody> frequenciaCsv(Filtros filtros) {
        return exportar(TipoRelatorio.FREQUENCIA, filtros, Formato.CSV);
    }

    @GetMapping("/frequencia.pdf")
    ResponseEntity<StreamingResponseBody> frequenciaPdf(Filtros filtros) {
        return exportar(TipoRelatorio.FREQUENCIA, filtros, Formato.PDF);
    }

    @GetMapping("/veiculos.csv")
    ResponseEntity<StreamingResponseBody> veiculosCsv(Filtros filtros) {
        return exportar(TipoRelatorio.VEICULOS, filtros, Formato.CSV);
    }

    @GetMapping("/veiculos.pdf")
    ResponseEntity<StreamingResponseBody> veiculosPdf(Filtros filtros) {
        return exportar(TipoRelatorio.VEICULOS, filtros, Formato.PDF);
    }

    @GetMapping("/agendados")
    List<Agendamento> meusAgendados() {
        return agendados.meus();
    }

    @PostMapping("/agendados")
    @Operation(summary = "Agenda envio semanal para o e-mail do próprio usuário.")
    Agendamento agendar(@RequestBody AgendamentoRequest pedido) {
        return agendados.agendar(pedido.tipo(), pedido.escolaId(), pedido.diaSemana());
    }

    @DeleteMapping("/agendados/{id}")
    ResponseEntity<Void> cancelar(@PathVariable long id) {
        agendados.cancelar(id);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<StreamingResponseBody> exportar(TipoRelatorio tipo, Filtros filtros, Formato formato) {
        // A tabela é montada aqui, no fio da requisição (escopo do usuário); o corpo só escreve.
        Exportacao exportacao = relatorios.exportar(filtros.paraPedido(tipo), formato);
        StreamingResponseBody corpo = saida -> RelatoriosService.escrever(exportacao, saida);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(exportacao.nomeArquivo()).build().toString())
                .contentType(MediaType.parseMediaType(formato.contentType))
                .body(corpo);
    }

    /** Filtros da exportação: só datas e ids (nada pessoal na URL). */
    public record Filtros(@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
                          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
                          Integer anoLetivo, Long escolaId, String anoEscolar, Long turmaId, String turno) {

        Pedido paraPedido(TipoRelatorio tipo) {
            return new Pedido(tipo, dataInicio, dataFim, new FiltroAlunos(anoLetivo, escolaId, anoEscolar, turmaId, turno));
        }
    }

    public record PedidoRequest(TipoRelatorio tipo, LocalDate dataInicio, LocalDate dataFim, Integer anoLetivo,
                                Long escolaId, String anoEscolar, Long turmaId, String turno) {

        Pedido paraPedido() {
            return new Pedido(tipo, dataInicio, dataFim, new FiltroAlunos(anoLetivo, escolaId, anoEscolar, turmaId, turno));
        }
    }

    public record AgendamentoRequest(TipoRelatorio tipo, Long escolaId, DayOfWeek diaSemana) {
    }
}
