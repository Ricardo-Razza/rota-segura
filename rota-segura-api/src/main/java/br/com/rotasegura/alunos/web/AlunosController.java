package br.com.rotasegura.alunos.web;

import br.com.rotasegura.alunos.application.AlunosService;
import br.com.rotasegura.alunos.application.AlunosService.ListaDeAlunos;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.alunos.application.PendenciasCadastroService;
import br.com.rotasegura.alunos.application.PendenciasCadastroService.Pendencias;
import br.com.rotasegura.alunos.application.PendenciasCadastroService.TipoPendencia;
import br.com.rotasegura.alunos.application.PerfilAlunoService;
import br.com.rotasegura.alunos.application.PerfilAlunoService.PerfilAluno;
import br.com.rotasegura.alunos.application.SincronizacaoAlunosService;
import br.com.rotasegura.alunos.application.SincronizacaoAlunosService.ResultadoSincronizacao;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Alunos: lista, busca por nome (POST), perfil auditado, sincronização e pendências de cadastro. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Alunos")
public class AlunosController {

    private static final String PODE_SINCRONIZAR = "hasAnyRole('ADMIN','GESTAO','SECRETARIA')";

    private final AlunosService alunos;
    private final PerfilAlunoService perfis;
    private final SincronizacaoAlunosService sincronizacao;
    private final PendenciasCadastroService pendencias;

    public AlunosController(AlunosService alunos, PerfilAlunoService perfis,
                            SincronizacaoAlunosService sincronizacao, PendenciasCadastroService pendencias) {
        this.alunos = alunos;
        this.perfis = perfis;
        this.sincronizacao = sincronizacao;
        this.pendencias = pendencias;
    }

    @GetMapping("/alunos")
    @Operation(summary = "Alunos do ano letivo com a situação de hoje. Só filtros: a busca por nome é POST /alunos/busca.")
    ListaDeAlunos listar(FiltroAlunos filtro,
                         @RequestParam(required = false) Integer pagina,
                         @RequestParam(required = false) Integer tamanho) {
        return alunos.listar(filtro, null, pagina, tamanho);
    }

    @PostMapping("/alunos/busca")
    @Operation(summary = "Busca por nome (termo no corpo, sem acento e sem diferenciar maiúsculas).")
    ListaDeAlunos buscar(@Valid @RequestBody BuscaAlunosRequest pedido) {
        return alunos.listar(pedido.filtro(), pedido.termo(), pedido.pagina(), pedido.tamanho());
    }

    @GetMapping("/alunos/{id}/perfil")
    @Operation(summary = "Perfil do aluno (acesso auditado). Sem CPF, endereço ou imagem.")
    PerfilAluno perfil(@PathVariable long id) {
        return perfis.perfil(id);
    }

    @PostMapping("/alunos/sincronizar")
    @PreAuthorize(PODE_SINCRONIZAR)
    @Operation(summary = "Dispara a sincronização de alunos na API externa e registra quem disparou.")
    ResultadoSincronizacao sincronizar() {
        return sincronizacao.sincronizar();
    }

    @GetMapping("/alunos/sincronizacao/ultima")
    @PreAuthorize(PODE_SINCRONIZAR)
    @Operation(summary = "Resultado da última sincronização (204 se nunca rodou).")
    ResponseEntity<ResultadoSincronizacao> ultimaSincronizacao() {
        return sincronizacao.ultima()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/cadastro/pendencias")
    @Operation(summary = "Alunos sem biometria ou sem responsável (este só com o índice de responsáveis completo).")
    Pendencias pendencias(FiltroAlunos filtro,
                          @RequestParam(required = false) TipoPendencia tipo,
                          @RequestParam(required = false) Integer pagina,
                          @RequestParam(required = false) Integer tamanho) {
        return pendencias.listar(filtro, tipo, pagina, tamanho);
    }

    @GetMapping("/cadastro/opcoes-filtro")
    @Operation(summary = "Escolas, anos escolares e turmas do ano letivo, no escopo do usuário (para os filtros globais).")
    AlunosService.OpcoesDeFiltro opcoesDeFiltro(@RequestParam(required = false) Integer anoLetivo) {
        return alunos.opcoesDeFiltro(anoLetivo);
    }
}
