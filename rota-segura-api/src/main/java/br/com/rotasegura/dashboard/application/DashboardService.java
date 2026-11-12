package br.com.rotasegura.dashboard.application;

import br.com.rotasegura.alertas.application.AlertasService;
import br.com.rotasegura.alunos.application.AlunoResumo;
import br.com.rotasegura.alunos.application.CatalogoAlunosService;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.dashboard.domain.FaixaFrequencia;
import br.com.rotasegura.dashboard.domain.SupressaoPequenosGrupos;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.VisaoDoDiaService;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.shared.application.CentralDeEventos;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.application.StatusVeiculosService;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.EstadoVeiculo;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Indicadores do Dashboard (gestão). Respeitam filtros globais e escopo. */
@Service
public class DashboardService {

    static final String SEM_ETAPA = "Sem etapa";
    static final int DIAS_FREQUENCIA_ETAPA = 7;
    static final int ANOS_MATRICULA = 5;

    private final JornadaService jornadas;
    private final VisaoDoDiaService visao;
    private final CatalogoAlunosService catalogo;
    private final CalendarioLetivo calendario;
    private final StatusVeiculosService veiculos;
    private final AlertasService alertas;
    private final CentralDeEventos eventos;
    private final EscopoService escopo;
    private final DashboardProperties propriedades;

    public DashboardService(JornadaService jornadas, VisaoDoDiaService visao, CatalogoAlunosService catalogo,
                            CalendarioLetivo calendario, StatusVeiculosService veiculos, AlertasService alertas,
                            CentralDeEventos eventos, EscopoService escopo, DashboardProperties propriedades) {
        this.jornadas = jornadas;
        this.visao = visao;
        this.catalogo = catalogo;
        this.calendario = calendario;
        this.veiculos = veiculos;
        this.alertas = alertas;
        this.eventos = eventos;
        this.escopo = escopo;
        this.propriedades = propriedades;
    }

    public ResumoDashboard resumo(FiltroAlunos filtro) {
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        Escopo atual = escopo.atual();
        Base base = jornadas.carregarBase();
        LocalDate hoje = jornadas.hoje();
        int anoLetivo = filtro.anoLetivoOu(hoje.getYear());

        List<Linha> linhasHoje = visao.montar(hoje, filtro, atual, base).linhas();
        List<Linha> esperadosHoje = linhasHoje.stream().filter(Linha::esperado).toList();
        long naEscola = linhasHoje.stream().filter(l -> l.jornada().estado() == EstadoJornada.NA_ESCOLA).count();
        long presentesEsperados = esperadosHoje.stream()
                .filter(l -> l.jornada().estado() == EstadoJornada.NA_ESCOLA).count();

        long emRota = veiculos.status().porEstado().getOrDefault(EstadoVeiculo.EM_ROTA, 0L);
        Kpis kpis = new Kpis(esperadosHoje.size(), percentual(presentesEsperados, esperadosHoje.size()), naEscola,
                emRota, alertas.resumoAtual().abertos(), calendario.ehLetivo(hoje));

        List<List<Linha>> ultimosDias = new ArrayList<>();
        List<LocalDate> dias = new ArrayList<>();
        if (calendario.ehLetivo(hoje)) {
            dias.add(hoje);
        }
        dias.addAll(calendario.letivosAntes(hoje, DIAS_FREQUENCIA_ETAPA - dias.size()));
        for (LocalDate dia : dias) {
            ultimosDias.add(dia.equals(hoje) ? linhasHoje : visao.montar(dia, filtro, atual, base).linhas());
        }

        return new ResumoDashboard(hoje, jornadas.agora(), anoLetivo, kpis,
                propriedades.etapasConfiguradas(),
                porEtapa(ultimosDias, propriedades),
                matriculas(base, filtro, atual, anoLetivo),
                porEscolaHoje(esperadosHoje),
                anualPorEscola(base, filtro, atual, anoLetivo, hoje),
                porAnoEscolar(esperadosHoje),
                eventos.conectadosPorPerfil(),
                base.desatualizado(), base.incompleto());
    }

    /**
     * Frequência de cada etapa no período, calculada só com os alunos daquela etapa.
     * Etapas distintas nunca compartilham o mesmo cálculo (problema da versão anterior).
     */
    static List<FrequenciaEtapa> porEtapa(List<List<Linha>> dias, DashboardProperties propriedades) {
        Map<String, long[]> somas = new LinkedHashMap<>();
        propriedades.etapas().keySet().forEach(e -> somas.put(e, new long[2]));
        for (List<Linha> dia : dias) {
            for (Linha linha : dia) {
                if (!linha.esperado()) {
                    continue;
                }
                String etapa = propriedades.etapaDe(linha.aluno().anoEscolar()).orElse(SEM_ETAPA);
                long[] soma = somas.computeIfAbsent(etapa, e -> new long[2]);
                soma[0]++;
                if (linha.jornada().estado() == EstadoJornada.NA_ESCOLA) {
                    soma[1]++;
                }
            }
        }
        List<FrequenciaEtapa> resultado = new ArrayList<>();
        somas.forEach((etapa, s) -> resultado.add(new FrequenciaEtapa(etapa, s[0], s[1], percentual(s[1], s[0]))));
        return resultado;
    }

    private MatriculasPorAno matriculas(Base base, FiltroAlunos filtro, Escopo atual, int anoLetivo) {
        Set<Integer> anos = new TreeSet<>(Comparator.reverseOrder());
        base.alunos().forEach(a -> {
            if (a.matriculas() != null) {
                a.matriculas().forEach(m -> {
                    Long ano = Conversoes.paraLong(m.escolaTurmaAnoLetivo());
                    if (ano != null) {
                        anos.add(ano.intValue());
                    }
                });
            }
        });
        boolean porEtapa = propriedades.etapasConfiguradas();
        Function<AlunoResumo, String> grupo = porEtapa
                ? a -> propriedades.etapaDe(a.anoEscolar()).orElse(SEM_ETAPA)
                : a -> a.anoEscolar() == null ? "Não informado" : a.anoEscolar();
        Map<Integer, Map<String, Long>> porAno = new TreeMap<>();
        anos.stream().limit(ANOS_MATRICULA).forEach(ano -> {
            List<AlunoResumo> doAno = atual.filtrar(catalogo.doAno(base, ano).stream().filter(filtro::aceita).toList(),
                    AlunoResumo::escolaId, AlunoResumo::veiculoId);
            porAno.put(ano, new TreeMap<>(doAno.stream().collect(Collectors.groupingBy(grupo, Collectors.counting()))));
        });
        return new MatriculasPorAno(porEtapa ? "ETAPA" : "ANO_ESCOLAR", anoLetivo, porAno);
    }

    private static List<FrequenciaEscola> porEscolaHoje(List<Linha> esperados) {
        Map<Long, List<Linha>> porEscola = new HashMap<>();
        for (Linha l : esperados) {
            if (l.aluno().escolaId() != null) {
                porEscola.computeIfAbsent(l.aluno().escolaId(), e -> new ArrayList<>()).add(l);
            }
        }
        List<FrequenciaEscola> resultado = new ArrayList<>();
        porEscola.forEach((escola, linhas) -> {
            long presentes = linhas.stream().filter(l -> l.jornada().estado() == EstadoJornada.NA_ESCOLA).count();
            BigDecimal freq = percentual(presentes, linhas.size());
            resultado.add(new FrequenciaEscola(escola, nomeMaisComum(linhas.stream().map(l -> l.aluno().escolaNome()).toList()),
                    linhas.size(), presentes, freq, FaixaFrequencia.de(freq)));
        });
        resultado.sort(Comparator.comparing(FrequenciaEscola::frequencia, Comparator.nullsLast(Comparator.reverseOrder())));
        return resultado;
    }

    /**
     * Frequência acumulada do ano por escola: (aluno, dia letivo) com passagem no leitor de chegada da escola,
     * sobre alunos do ano ligados à escola × dias letivos <b>com leitura</b> nessa escola.
     * Dias letivos sem nenhuma leitura (histórico ainda não disponível, leitor desligado, feriado não cadastrado)
     * não entram no denominador: sem isso a frequência despencava para quem tem poucas semanas de dados.
     */
    private List<FrequenciaEscola> anualPorEscola(Base base, FiltroAlunos filtro, Escopo atual, int ano, LocalDate hoje) {
        LocalDate inicio = LocalDate.of(ano, 1, 1);
        LocalDate fim = ano == hoje.getYear() ? hoje : LocalDate.of(ano, 12, 31);
        if (fim.isBefore(inicio)) {
            return List.of();
        }
        Set<LocalDate> letivos = new HashSet<>(calendario.letivosEntre(inicio, fim));
        List<AlunoResumo> alunos = atual.filtrar(catalogo.doAno(base, ano).stream().filter(filtro::aceita).toList(),
                AlunoResumo::escolaId, AlunoResumo::veiculoId);
        Map<Long, List<AlunoResumo>> porEscola = alunos.stream().filter(a -> a.escolaId() != null)
                .collect(Collectors.groupingBy(AlunoResumo::escolaId));
        Set<Long> ids = alunos.stream().map(AlunoResumo::id).collect(Collectors.toSet());

        Map<Long, Leitor> leitores = base.carga().classificacao().leitores();
        Map<Long, Set<String>> presencas = new HashMap<>();
        Map<Long, Set<LocalDate>> diasComLeitura = new HashMap<>();
        LocalDateTime agora = jornadas.agora();
        for (Leitura l : base.carga().leituras()) {
            Leitor leitor = leitores.get(l.leitorId());
            LocalDate dia = l.dataHora().toLocalDate();
            if (leitor == null || leitor.tipo() != TipoLeitor.CHEGADA || leitor.escolaId() == null
                    || !letivos.contains(dia) || l.dataHora().isAfter(agora)) {
                continue;
            }
            diasComLeitura.computeIfAbsent(leitor.escolaId(), e -> new HashSet<>()).add(dia);
            if (ids.contains(l.alunoId())) {
                presencas.computeIfAbsent(leitor.escolaId(), e -> new HashSet<>()).add(l.alunoId() + "|" + dia);
            }
        }
        List<FrequenciaEscola> resultado = new ArrayList<>();
        porEscola.forEach((escola, doEscola) -> {
            long esperados = (long) doEscola.size() * diasComLeitura.getOrDefault(escola, Set.of()).size();
            long presentes = presencas.getOrDefault(escola, Set.of()).size();
            BigDecimal freq = percentual(presentes, esperados);
            resultado.add(new FrequenciaEscola(escola, nomeMaisComum(doEscola.stream().map(AlunoResumo::escolaNome).toList()),
                    esperados, presentes, freq, FaixaFrequencia.de(freq)));
        });
        resultado.sort(Comparator.comparing(FrequenciaEscola::frequencia, Comparator.nullsLast(Comparator.reverseOrder())));
        return resultado;
    }

    private static List<PorAnoEscolar> porAnoEscolar(List<Linha> esperados) {
        Map<String, List<AlunoResumo>> grupos = new TreeMap<>();
        esperados.forEach(l -> grupos.computeIfAbsent(
                l.aluno().anoEscolar() == null ? "Não informado" : l.aluno().anoEscolar(), k -> new ArrayList<>()).add(l.aluno()));
        List<PorAnoEscolar> resultado = new ArrayList<>();
        grupos.forEach((ano, lista) -> resultado.add(new PorAnoEscolar(ano, lista.size(),
                lista.stream().map(AlunoResumo::turmaId).filter(t -> t != null).distinct().count(), null)));
        return resultado;
    }

    /** Indicadores sensíveis: só GESTAO/SECRETARIA (garantido no controller) e só agregados com supressão. */
    public IndicadoresSensiveis sensiveis() {
        Perfil perfil = escopo.atual().perfil();
        if (perfil != Perfil.GESTAO && perfil != Perfil.SECRETARIA) {
            throw new br.com.rotasegura.shared.erro.AcessoNegadoException("Indicadores sensíveis restritos a gestão e secretaria.");
        }
        return new IndicadoresSensiveis(false,
                "A API externa não fornece gênero, raça nem deficiência. Os indicadores aparecem quando houver fonte autorizada.",
                SupressaoPequenosGrupos.MINIMO_PADRAO, List.of());
    }

    static BigDecimal percentual(long parte, long total) {
        if (total == 0) {
            return null;
        }
        return BigDecimal.valueOf(parte * 100L).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private static String nomeMaisComum(List<String> nomes) {
        Map<String, Long> contagem = nomes.stream().filter(n -> n != null && !n.isBlank())
                .collect(Collectors.groupingBy(n -> n, Collectors.counting()));
        return contagem.isEmpty() ? null
                : Collections.max(contagem.entrySet(), Map.Entry.comparingByValue()).getKey();
    }

    /**
     * @param frequenciaHoje presentes / esperados de hoje; nula sem esperados
     * @param diaLetivo      hoje é dia letivo (fim de semana e dias sem aula configurados não são)
     */
    public record Kpis(long alunosAtivos, BigDecimal frequenciaHoje, long naEscolaAgora, long veiculosEmRota,
                       long alertasAbertos, boolean diaLetivo) {
    }

    public record FrequenciaEtapa(String etapa, long esperados, long presentes, BigDecimal frequencia) {
    }

    /** @param agrupamento "ETAPA" quando há mapa de etapas; senão "ANO_ESCOLAR" */
    public record MatriculasPorAno(String agrupamento, int anoAtual, Map<Integer, Map<String, Long>> porAno) {
    }

    public record FrequenciaEscola(long escolaId, String escolaNome, long esperados, long presentes,
                                   BigDecimal frequencia, FaixaFrequencia faixa) {
    }

    /** @param docentes sem fonte na API: sempre nulo por enquanto */
    public record PorAnoEscolar(String anoEscolar, long alunos, long turmas, Long docentes) {
    }

    /**
     * @param frequenciaPorEtapa últimos 7 dias letivos, uma linha por etapa configurada (mais "Sem etapa")
     * @param frequenciaHojePorEscola ordenada da maior para a menor; a média é {@code kpis.frequenciaHoje}
     */
    public record ResumoDashboard(LocalDate data, LocalDateTime avaliadoEm, int anoLetivo, Kpis kpis,
                                  boolean etapasConfiguradas, List<FrequenciaEtapa> frequenciaPorEtapa,
                                  MatriculasPorAno matriculas, List<FrequenciaEscola> frequenciaHojePorEscola,
                                  List<FrequenciaEscola> frequenciaAnualPorEscola, List<PorAnoEscolar> porAnoEscolar,
                                  Map<Perfil, Long> usuariosConectados, boolean desatualizado, boolean incompleto) {
    }

    public record IndicadoresSensiveis(boolean disponivel, String motivo, int minimoPorGrupo,
                                       List<IndicadorSensivel> indicadores) {
    }

    public record IndicadorSensivel(String nome, List<SupressaoPequenosGrupos.Grupo> grupos) {
    }
}
