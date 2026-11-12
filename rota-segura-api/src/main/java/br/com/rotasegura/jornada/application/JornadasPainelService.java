package br.com.rotasegura.jornada.application;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Vinculo;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.VisaoDoDia;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.shared.application.Pagina;
import br.com.rotasegura.shared.application.Periodo;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Casos de uso da tela Jornada: o quadro do dia e o histórico de um aluno. */
@Service
public class JornadasPainelService {

    /** Período máximo do histórico de jornadas de um aluno. */
    public static final int MAXIMO_DIAS_HISTORICO = 31;

    private final JornadaService jornadas;
    private final VisaoDoDiaService visao;
    private final LeiturasDaApi leiturasDaApi;
    private final EscopoService escopo;

    public JornadasPainelService(JornadaService jornadas, VisaoDoDiaService visao, LeiturasDaApi leiturasDaApi,
                                 EscopoService escopo) {
        this.jornadas = jornadas;
        this.visao = visao;
        this.leiturasDaApi = leiturasDaApi;
        this.escopo = escopo;
    }

    /** Quadro do dia: jornadas filtradas e paginadas, com o total por estado (antes da paginação). */
    public QuadroDoDia doDia(LocalDate data, FiltroAlunos filtro, Long veiculoId, Integer pagina, Integer tamanho) {
        Escopo atual = escopo.atual();
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        if (veiculoId != null) {
            escopo.exigirVeiculo(veiculoId);
        }
        LocalDate dia = data != null ? data : jornadas.hoje();
        VisaoDoDia doDia = visao.montar(dia, filtro, atual, jornadas.carregarBase());
        List<Linha> linhas = doDia.linhas().stream()
                .filter(l -> veiculoId == null || veiculoId.equals(l.aluno().veiculoId()))
                .toList();

        Map<EstadoJornada, Long> porEstado = new EnumMap<>(EstadoJornada.class);
        for (EstadoJornada estado : EstadoJornada.values()) {
            porEstado.put(estado, 0L);
        }
        linhas.forEach(l -> porEstado.merge(l.jornada().estado(), 1L, Long::sum));

        ResumoJornadas resumo = doDia.resumo();
        return new QuadroDoDia(dia, resumo.avaliadoEm(), porEstado, Pagina.de(linhas, pagina, tamanho),
                resumo.descartes(), resumo.desatualizado(), resumo.incompleto());
    }

    /** Jornadas de um aluno em cada dia do período, respeitando o escopo pelo vínculo mais recente do aluno. */
    public List<JornadaDoDia> doAluno(long alunoId, LocalDate inicio, LocalDate fim) {
        LocalDate hoje = jornadas.hoje();
        Periodo periodo = Periodo.validar(inicio != null ? inicio : hoje, fim != null ? fim : hoje,
                MAXIMO_DIAS_HISTORICO);
        exigirAlunoNoEscopo(alunoId);
        return jornadas.doAlunoNoPeriodo(alunoId, periodo);
    }

    /**
     * DIRETOR e MONITOR só veem alunos que passaram por leitor da sua escola ou do seu veículo.
     * Aluno sem nenhuma leitura não tem vínculo conhecido e fica fora do escopo restrito.
     */
    public void exigirAlunoNoEscopo(long alunoId) {
        Escopo atual = escopo.atual();
        if (atual.perfil().escopoGlobal()) {
            return;
        }
        Vinculo vinculo = leiturasDaApi.carregar().vinculosRecentes().getOrDefault(alunoId, Vinculo.NENHUM);
        if (atual.filtrar(List.of(vinculo), Vinculo::escolaId, Vinculo::veiculoId).isEmpty()) {
            throw new AcessoNegadoException("Aluno fora do seu escopo.");
        }
    }

    /**
     * @param porEstado contagem de cada estado nas jornadas filtradas (todas as colunas aparecem, mesmo zeradas)
     */
    public record QuadroDoDia(LocalDate data, LocalDateTime avaliadoEm, Map<EstadoJornada, Long> porEstado,
                              Pagina<Linha> jornadas, ResumoJornadas.Descartes descartes,
                              boolean desatualizado, boolean incompleto) {

        public QuadroDoDia {
            // EnumMap mantém a ordem das colunas do quadro (AGUARDANDO → DIVERGENTE).
            porEstado = Collections.unmodifiableMap(new EnumMap<>(porEstado));
        }
    }
}
