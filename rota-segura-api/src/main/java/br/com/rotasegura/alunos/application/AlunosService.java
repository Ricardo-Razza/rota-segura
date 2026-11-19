package br.com.rotasegura.alunos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.dashboard.application.DashboardProperties;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.shared.application.Pagina;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Lista de alunos do painel com a situação de hoje.
 * A busca por nome recebe o termo no corpo da requisição (nunca na URL: regra 1 do CLAUDE.md).
 */
@Service
public class AlunosService {

    /** Termo de busca mínimo, para não devolver a escola inteira a cada letra. */
    public static final int TERMO_MINIMO = 2;

    private final JornadaService jornadas;
    private final CatalogoAlunosService catalogo;
    private final EscopoService escopo;
    private final DashboardProperties etapas;

    public AlunosService(JornadaService jornadas, CatalogoAlunosService catalogo, EscopoService escopo,
                         DashboardProperties etapas) {
        this.jornadas = jornadas;
        this.catalogo = catalogo;
        this.escopo = escopo;
        this.etapas = etapas;
    }

    public ListaDeAlunos listar(FiltroAlunos filtro, String termo, Integer pagina, Integer tamanho) {
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        Escopo atual = escopo.atual();
        LocalDate hoje = jornadas.hoje();
        int anoLetivo = filtro.anoLetivoOu(hoje.getYear());
        Base base = jornadas.carregarBase();

        String termoNormalizado = normalizar(termo);
        List<AlunoResumo> alunos = catalogo.doAno(base, anoLetivo).stream()
                .filter(filtro::aceita)
                .filter(a -> termoNormalizado.isEmpty() || normalizar(a.nome()).contains(termoNormalizado))
                .toList();
        List<AlunoResumo> noEscopo = atual.filtrar(alunos, AlunoResumo::escolaId, AlunoResumo::veiculoId);

        Map<Long, EstadoJornada> estadoHoje = new HashMap<>();
        if (anoLetivo == hoje.getYear()) {
            for (JornadaDoDia jornada : jornadas.doDia(hoje, null, base).jornadas()) {
                estadoHoje.put(jornada.alunoId(), jornada.estado());
            }
        }
        Pagina<AlunoComSituacao> resultado = Pagina.de(noEscopo, pagina, tamanho)
                .mapear(a -> new AlunoComSituacao(a, estadoHoje.get(a.id())));
        return new ListaDeAlunos(anoLetivo, resultado, base.desatualizado(), base.incompleto());
    }

    /**
     * Opções dos filtros globais (escola, ano escolar, turma) a partir das matrículas do ano, já no escopo.
     * Só nomes de escola e turma: nenhum dado de aluno.
     */
    public OpcoesDeFiltro opcoesDeFiltro(Integer anoLetivo) {
        Escopo atual = escopo.atual();
        LocalDate hoje = jornadas.hoje();
        int ano = anoLetivo == null ? hoje.getYear() : anoLetivo;
        Base base = jornadas.carregarBase();
        List<AlunoResumo> noEscopo = atual.filtrar(catalogo.doAno(base, ano), AlunoResumo::escolaId,
                AlunoResumo::veiculoId);
        java.text.Collator collator = java.text.Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        Map<Long, String> escolas = new HashMap<>();
        Map<Long, OpcaoTurma> turmas = new HashMap<>();
        java.util.Set<String> anos = new java.util.TreeSet<>(collator);
        java.util.Set<String> turnos = new java.util.TreeSet<>(collator);
        for (AlunoResumo a : noEscopo) {
            if (a.escolaId() != null) {
                escolas.putIfAbsent(a.escolaId(), a.escolaNome() == null ? "Escola #" + a.escolaId() : a.escolaNome());
            }
            if (a.anoEscolar() != null && !a.anoEscolar().isBlank()) {
                anos.add(a.anoEscolar());
            }
            if (a.turno() != null && !a.turno().isBlank()) {
                turnos.add(a.turno());
            }
            if (a.turmaId() != null) {
                turmas.putIfAbsent(a.turmaId(), new OpcaoTurma(a.turmaId(),
                        a.turma() == null ? "Turma #" + a.turmaId() : a.turma(), a.escolaId(), a.anoEscolar()));
            }
        }
        List<OpcaoEscola> listaEscolas = escolas.entrySet().stream()
                .map(e -> new OpcaoEscola(e.getKey(), e.getValue()))
                .sorted(java.util.Comparator.comparing(OpcaoEscola::nome, collator)).toList();
        List<OpcaoTurma> listaTurmas = turmas.values().stream()
                .sorted(java.util.Comparator.comparing(OpcaoTurma::nome, collator)).toList();
        return new OpcoesDeFiltro(ano, listaEscolas, List.copyOf(anos), listaTurmas,
                List.copyOf(etapas.etapas().keySet()), List.copyOf(turnos), base.desatualizado());
    }

    static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toLowerCase(Locale.ROOT);
    }

    /** @param estadoHoje nulo quando a lista é de outro ano letivo */
    public record AlunoComSituacao(AlunoResumo aluno, EstadoJornada estadoHoje) {
    }

    public record OpcaoEscola(long id, String nome) {
    }

    public record OpcaoTurma(long id, String nome, Long escolaId, String anoEscolar) {
    }

    public record OpcoesDeFiltro(int anoLetivo, List<OpcaoEscola> escolas, List<String> anosEscolares,
                                 List<OpcaoTurma> turmas, List<String> etapas, List<String> turnos,
                                 boolean desatualizado) {
    }

    public record ListaDeAlunos(int anoLetivo, Pagina<AlunoComSituacao> alunos, boolean desatualizado,
                                boolean incompleto) {
    }
}
