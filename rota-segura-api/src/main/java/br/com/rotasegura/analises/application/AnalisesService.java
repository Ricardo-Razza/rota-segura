package br.com.rotasegura.analises.application;

import br.com.rotasegura.alertas.domain.Alerta;
import br.com.rotasegura.alertas.domain.AlertaRepository;
import br.com.rotasegura.alertas.domain.StatusAlerta;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.alunos.application.AlunoResumo;
import br.com.rotasegura.alunos.application.CatalogoAlunosService;
import br.com.rotasegura.analises.application.Recorte.Granularidade;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.dashboard.application.DashboardProperties;
import br.com.rotasegura.dashboard.domain.FaixaFrequencia;
import br.com.rotasegura.jornada.application.JornadaProperties;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService;
import br.com.rotasegura.shared.application.Periodo;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.Comparator;
import java.util.EnumMap;
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

/**
 * Análises de crescimento e tendência (frequência, matrículas e cadastro, frota e alertas).
 * Usa só os dados já carregados (GET da API externa, em cache) e o banco próprio (alertas).
 * Cada cálculo percorre as leituras uma vez, mesmo para um ano inteiro.
 */
@Service
public class AnalisesService {

    static final int MAXIMO_DIAS = 366;
    static final int DIAS_PADRAO = 30;
    static final int ANOS_MATRICULA = 5;
    static final String SEM_ETAPA = "Sem etapa";
    static final String NAO_INFORMADO = "Não informado";
    /** Abaixo disso o aluno entra na contagem de risco (só contagem, nunca lista). */
    static final int LIMITE_RISCO = 75;
    private static final String[] DIAS_SEMANA = {"Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"};
    private static final long DIAS_CHAVE = 100_000L;

    private final JornadaService jornadas;
    private final CatalogoAlunosService catalogo;
    private final CalendarioLetivo calendario;
    private final VinculosResponsaveisService responsaveis;
    private final VeiculosClient veiculos;
    private final AlertaRepository alertas;
    private final EscopoService escopo;
    private final DashboardProperties etapas;
    private final JornadaProperties regras;

    public AnalisesService(JornadaService jornadas, CatalogoAlunosService catalogo, CalendarioLetivo calendario,
                           VinculosResponsaveisService responsaveis, VeiculosClient veiculos,
                           AlertaRepository alertas, EscopoService escopo, DashboardProperties etapas,
                           JornadaProperties regras) {
        this.jornadas = jornadas;
        this.catalogo = catalogo;
        this.calendario = calendario;
        this.responsaveis = responsaveis;
        this.veiculos = veiculos;
        this.alertas = alertas;
        this.escopo = escopo;
        this.etapas = etapas;
        this.regras = regras;
    }

    // ---------------------------------------------------------------- frequência

    public AnaliseFrequencia frequencia(FiltroAnalise filtro) {
        Contexto c = contexto(filtro);
        Recorte recorte = new Recorte(c.periodo());
        Frequencias atual = frequencias(c, alunos(c, filtro, c.ano()), c.periodo(), recorte);
        Frequencias ref = c.referencia() == null ? null
                : frequencias(c, alunos(c, filtro, c.anoReferencia()), c.referencia(),
                        new Recorte(c.referencia(), recorte.granularidade()));

        BigDecimal media = percentual(atual.total.presentes, atual.total.esperados);
        BigDecimal mediaRef = ref == null ? null : percentual(ref.total.presentes, ref.total.esperados);

        return new AnaliseFrequencia(c.periodo(), c.referencia(), recorte.granularidade(),
                new Indicador(media, mediaRef, diferenca(media, mediaRef)),
                atual.diasLetivos, atual.alunosAvaliados,
                new Indicador(BigDecimal.valueOf(atual.abaixoDoLimite),
                        ref == null ? null : BigDecimal.valueOf(ref.abaixoDoLimite),
                        ref == null ? null : variacao(atual.abaixoDoLimite, ref.abaixoDoLimite)),
                LIMITE_RISCO,
                pontos(recorte.grupos(), atual.serie),
                ref == null ? List.of() : pontos(new Recorte(c.referencia(), recorte.granularidade()).grupos(), ref.serie),
                grupos(atual.porEscola, ref == null ? null : ref.porEscola,
                        id -> atual.nomes.getOrDefault(id, "Escola #" + id), true),
                grupos(atual.porEtapa, ref == null ? null : ref.porEtapa, e -> e, false),
                grupos(atual.porTurno, ref == null ? null : ref.porTurno, t -> t, false),
                grupos(atual.porDiaSemana, ref == null ? null : ref.porDiaSemana,
                        d -> DIAS_SEMANA[d.ordinal()], false),
                etapas.etapasConfiguradas(), c.base().desatualizado(), c.base().incompleto());
    }

    /**
     * Uma passada nas leituras de chegada. Denominador: alunos da escola × dias letivos <b>com leitura</b>
     * naquela escola (mesma regra da frequência anual do Dashboard).
     */
    private Frequencias frequencias(Contexto c, List<AlunoResumo> alunos, Periodo periodo, Recorte recorte) {
        List<LocalDate> letivos = calendario.letivosEntre(periodo.inicio(), periodo.fim()).stream()
                .filter(d -> !d.isAfter(c.hoje())).toList();
        Map<LocalDate, Integer> posicao = new HashMap<>();
        for (int i = 0; i < letivos.size(); i++) {
            posicao.put(letivos.get(i), i);
        }
        Set<Long> ids = alunos.stream().map(AlunoResumo::id).collect(Collectors.toSet());
        Map<Long, BitSet> diasDaEscola = new HashMap<>();
        Map<Long, BitSet> presencas = new HashMap<>();
        Map<Long, Leitor> leitores = c.base().carga().classificacao().leitores();
        for (Leitura l : c.base().carga().leituras()) {
            Leitor leitor = leitores.get(l.leitorId());
            if (leitor == null || leitor.tipo() != TipoLeitor.CHEGADA || leitor.escolaId() == null
                    || l.dataHora().isAfter(c.agora())) {
                continue;
            }
            Integer i = posicao.get(l.dataHora().toLocalDate());
            if (i == null) {
                continue;
            }
            diasDaEscola.computeIfAbsent(leitor.escolaId(), e -> new BitSet()).set(i);
            if (ids.contains(l.alunoId())) {
                presencas.computeIfAbsent(l.alunoId(), a -> new BitSet()).set(i);
            }
        }

        Frequencias r = new Frequencias(recorte.grupos().size());
        BitSet diasComLeitura = new BitSet();
        BitSet vazio = new BitSet();
        for (AlunoResumo a : alunos) {
            BitSet dias = a.escolaId() == null ? null : diasDaEscola.get(a.escolaId());
            if (dias == null || dias.isEmpty()) {
                continue;
            }
            diasComLeitura.or(dias);
            BitSet presente = presencas.getOrDefault(a.id(), vazio);
            String etapa = etapas.etapaDe(a.anoEscolar()).orElse(SEM_ETAPA);
            String turno = a.turno() == null || a.turno().isBlank() ? NAO_INFORMADO : a.turno();
            r.nomes.putIfAbsent(a.escolaId(), a.escolaNome());
            long esperados = 0;
            long presentes = 0;
            for (int i = dias.nextSetBit(0); i >= 0; i = dias.nextSetBit(i + 1)) {
                boolean veio = presente.get(i);
                LocalDate dia = letivos.get(i);
                int p = veio ? 1 : 0;
                r.total.somar(1, p);
                r.serie[recorte.indice(dia)].somar(1, p);
                r.porEscola.computeIfAbsent(a.escolaId(), k -> new Soma()).somar(1, p);
                r.porEtapa.computeIfAbsent(etapa, k -> new Soma()).somar(1, p);
                r.porTurno.computeIfAbsent(turno, k -> new Soma()).somar(1, p);
                r.porDiaSemana.computeIfAbsent(dia.getDayOfWeek(), k -> new Soma()).somar(1, p);
                esperados++;
                presentes += p;
            }
            r.alunosAvaliados++;
            if (presentes * 100 < (long) LIMITE_RISCO * esperados) {
                r.abaixoDoLimite++;
            }
        }
        r.diasLetivos = diasComLeitura.cardinality();
        return r;
    }

    private static List<Ponto> pontos(List<LocalDate> grupos, Soma[] serie) {
        List<Ponto> pontos = new ArrayList<>();
        for (int i = 0; i < grupos.size(); i++) {
            Soma s = serie[i];
            pontos.add(new Ponto(grupos.get(i), s.esperados, s.presentes, percentual(s.presentes, s.esperados)));
        }
        return pontos;
    }

    private static <K> List<Grupo> grupos(Map<K, Soma> atual, Map<K, Soma> ref, Function<K, String> rotulo,
                                          boolean ordenarPorFrequencia) {
        List<Grupo> lista = new ArrayList<>();
        atual.forEach((chave, s) -> {
            BigDecimal freq = percentual(s.presentes, s.esperados);
            Soma anterior = ref == null ? null : ref.get(chave);
            BigDecimal freqRef = anterior == null ? null : percentual(anterior.presentes, anterior.esperados);
            lista.add(new Grupo(String.valueOf(chave), rotulo.apply(chave), s.esperados, s.presentes, freq, freqRef,
                    diferenca(freq, freqRef), FaixaFrequencia.de(freq)));
        });
        if (ordenarPorFrequencia) {
            lista.sort(Comparator.comparing(Grupo::frequencia, Comparator.nullsLast(Comparator.reverseOrder())));
        }
        return lista;
    }

    // ---------------------------------------------------------------- matrículas e cadastro

    public AnaliseMatriculas matriculas(FiltroAnalise filtro) {
        Contexto c = contexto(filtro);
        int ano = c.ano();
        boolean porEtapa = etapas.etapasConfiguradas();
        Function<AlunoResumo, String> grupo = porEtapa
                ? a -> etapas.etapaDe(a.anoEscolar()).orElse(SEM_ETAPA)
                : a -> a.anoEscolar() == null ? NAO_INFORMADO : a.anoEscolar();

        List<MatriculasDoAno> serie = new ArrayList<>();
        for (int a : anosComMatricula(c.base(), ano)) {
            List<AlunoResumo> doAno = alunos(c, filtro, a);
            serie.add(new MatriculasDoAno(a, doAno.size(),
                    new TreeMap<>(doAno.stream().collect(Collectors.groupingBy(grupo, Collectors.counting())))));
        }

        List<AlunoResumo> atual = alunos(c, filtro, ano);
        List<AlunoResumo> anterior = alunos(c, filtro, ano - 1);
        long turmas = atual.stream().map(AlunoResumo::turmaId).filter(t -> t != null).distinct().count();
        long turmasAnt = anterior.stream().map(AlunoResumo::turmaId).filter(t -> t != null).distinct().count();
        Map<Long, String> nomes = new HashMap<>();
        atual.forEach(a -> { if (a.escolaId() != null) nomes.putIfAbsent(a.escolaId(), a.escolaNome()); });
        anterior.forEach(a -> { if (a.escolaId() != null) nomes.putIfAbsent(a.escolaId(), a.escolaNome()); });

        return new AnaliseMatriculas(ano, porEtapa ? "ETAPA" : "ANO_ESCOLAR",
                new Indicador(BigDecimal.valueOf(atual.size()), BigDecimal.valueOf(anterior.size()),
                        variacao(atual.size(), anterior.size())),
                new Indicador(BigDecimal.valueOf(turmas), BigDecimal.valueOf(turmasAnt), variacao(turmas, turmasAnt)),
                serie,
                comparar(atual, anterior, a -> a.anoEscolar() == null ? NAO_INFORMADO : a.anoEscolar(), k -> k),
                comparar(atual, anterior, a -> a.escolaId() == null ? "0" : String.valueOf(a.escolaId()),
                        k -> "0".equals(k) ? "Sem escola" : nomes.getOrDefault(Long.valueOf(k), "Escola #" + k)),
                comparar(atual, anterior, a -> a.turno() == null || a.turno().isBlank() ? NAO_INFORMADO : a.turno(),
                        k -> k),
                cobertura(atual), c.base().desatualizado(), c.base().incompleto());
    }

    private static List<Integer> anosComMatricula(Base base, int ate) {
        Set<Integer> anos = new TreeSet<>(Comparator.reverseOrder());
        base.alunos().forEach(a -> {
            if (a.matriculas() != null) {
                a.matriculas().forEach(m -> {
                    Long ano = Conversoes.paraLong(m.escolaTurmaAnoLetivo());
                    if (ano != null && ano <= ate) {
                        anos.add(ano.intValue());
                    }
                });
            }
        });
        List<Integer> recentes = new ArrayList<>(anos.stream().limit(ANOS_MATRICULA).toList());
        recentes.sort(Comparator.naturalOrder());
        return recentes;
    }

    private static List<Comparativo> comparar(List<AlunoResumo> atual, List<AlunoResumo> anterior,
                                              Function<AlunoResumo, String> chave, Function<String, String> rotulo) {
        Map<String, Long> agora = atual.stream().collect(Collectors.groupingBy(chave, Collectors.counting()));
        Map<String, Long> antes = anterior.stream().collect(Collectors.groupingBy(chave, Collectors.counting()));
        Set<String> chaves = new TreeSet<>(agora.keySet());
        chaves.addAll(antes.keySet());
        List<Comparativo> lista = new ArrayList<>();
        for (String k : chaves) {
            long a = agora.getOrDefault(k, 0L);
            long b = antes.getOrDefault(k, 0L);
            lista.add(new Comparativo(k, rotulo.apply(k), a, b, variacao(a, b)));
        }
        return lista;
    }

    private List<Cobertura> cobertura(List<AlunoResumo> alunos) {
        long comBiometriaInformada = alunos.stream().filter(a -> a.biometria() != null).count();
        long comBiometria = alunos.stream().filter(a -> Boolean.TRUE.equals(a.biometria())).count();
        long comVeiculo = alunos.stream().filter(a -> a.veiculoId() != null).count();
        List<Cobertura> lista = new ArrayList<>();
        lista.add(new Cobertura("BIOMETRIA", "Rosto cadastrado no leitor", comBiometria, comBiometriaInformada,
                percentual(comBiometria, comBiometriaInformada), comBiometriaInformada > 0));
        lista.add(new Cobertura("VEICULO", "Com veículo no cadastro", comVeiculo, alunos.size(),
                percentual(comVeiculo, alunos.size()), true));
        VinculosResponsaveisService.Indice indice = responsaveis.atual();
        if (indice.confiavel()) {
            long comResponsavel = alunos.stream().filter(a -> !indice.doAluno(a.id()).isEmpty()).count();
            lista.add(new Cobertura("RESPONSAVEL", "Com responsável vinculado", comResponsavel, alunos.size(),
                    percentual(comResponsavel, alunos.size()), true));
        } else {
            lista.add(new Cobertura("RESPONSAVEL", "Com responsável vinculado", 0, 0, null, false));
        }
        return lista;
    }

    // ---------------------------------------------------------------- frota e alertas

    public AnaliseFrota frota(FiltroAnalise filtro) {
        Contexto c = contexto(filtro);
        Recorte recorte = new Recorte(c.periodo());
        Recorte recorteRef = c.referencia() == null ? null : new Recorte(c.referencia(), recorte.granularidade());
        long janela = regras.janelaSemChegada().toMinutes();

        Viagens atual = viagens(c, filtro, alunos(c, filtro, c.ano()), c.periodo(), recorte, janela);
        Viagens ref = recorteRef == null ? null
                : viagens(c, filtro, alunos(c, filtro, c.anoReferencia()), c.referencia(), recorteRef, janela);
        List<Alerta> doPeriodo = alertasDe(c, filtro, c.periodo());
        List<Alerta> doRef = c.referencia() == null ? null : alertasDe(c, filtro, c.referencia());
        long[] alertasPorGrupo = new long[recorte.grupos().size()];
        long[] criticosPorGrupo = new long[recorte.grupos().size()];
        ZoneId zona = regras.zona();
        for (Alerta a : doPeriodo) {
            int i = recorte.indice(a.getPrimeiraOcorrenciaEm().atZone(zona).toLocalDate());
            if (i >= 0) {
                alertasPorGrupo[i]++;
                if (a.getSeveridade() == Severidade.CRITICO) {
                    criticosPorGrupo[i]++;
                }
            }
        }

        Map<Long, VeiculoDto> cadastro = new HashMap<>();
        veiculos.listarTodos().valor().itens().forEach(v -> {
            Long id = Conversoes.paraLong(v.id());
            if (id != null) {
                cadastro.put(id, v);
            }
        });
        List<VeiculoAnalise> porVeiculo = new ArrayList<>();
        atual.porVeiculo.forEach((id, s) -> {
            VeiculoDto dto = cadastro.get(id);
            long alertasDoVeiculo = doPeriodo.stream().filter(a -> id.equals(a.getVeiculoId())).count();
            porVeiculo.add(new VeiculoAnalise(id, dto == null ? null : dto.placa(), dto == null ? null : dto.prefixo(),
                    s.dias.size(), s.embarques, s.embarques - s.comChegada, media(s.somaMin, s.comChegada),
                    percentual(s.noPrazo, s.comChegada), alertasDoVeiculo));
        });
        porVeiculo.sort(Comparator.comparingLong(VeiculoAnalise::embarques).reversed());

        List<PontoFrota> serie = new ArrayList<>();
        List<LocalDate> grupos = recorte.grupos();
        for (int i = 0; i < grupos.size(); i++) {
            SomaViagem s = atual.serie[i];
            serie.add(new PontoFrota(grupos.get(i), s.embarques, media(s.somaMin, s.comChegada),
                    percentual(s.noPrazo, s.comChegada), alertasPorGrupo[i], criticosPorGrupo[i]));
        }
        List<PontoFrota> serieRef = new ArrayList<>();
        if (ref != null) {
            List<LocalDate> gruposRef = recorteRef.grupos();
            for (int i = 0; i < gruposRef.size(); i++) {
                SomaViagem s = ref.serie[i];
                serieRef.add(new PontoFrota(gruposRef.get(i), s.embarques, media(s.somaMin, s.comChegada),
                        percentual(s.noPrazo, s.comChegada), 0, 0));
            }
        }

        SomaViagem t = atual.total;
        SomaViagem tr = ref == null ? null : ref.total;
        BigDecimal tempo = media(t.somaMin, t.comChegada);
        BigDecimal tempoRef = tr == null ? null : media(tr.somaMin, tr.comChegada);
        BigDecimal prazo = percentual(t.noPrazo, t.comChegada);
        BigDecimal prazoRef = tr == null ? null : percentual(tr.noPrazo, tr.comChegada);

        return new AnaliseFrota(c.periodo(), c.referencia(), recorte.granularidade(), janela,
                contagem(t.embarques, tr == null ? null : tr.embarques),
                contagem(atual.viagens(), ref == null ? null : ref.viagens()),
                new Indicador(tempo, tempoRef, diferenca(tempo, tempoRef)),
                new Indicador(prazo, prazoRef, diferenca(prazo, prazoRef)),
                serie, serieRef, porVeiculo, resumoAlertas(doPeriodo, doRef),
                c.base().desatualizado(), c.base().incompleto());
    }

    /**
     * Primeiro embarque de cada (aluno, dia) e a primeira chegada depois dele. Uma "viagem" do veículo
     * é um dia com ao menos um embarque.
     */
    private Viagens viagens(Contexto c, FiltroAnalise filtro, List<AlunoResumo> alunos, Periodo periodo,
                            Recorte recorte, long janelaMin) {
        Set<Long> ids = alunos.stream().map(AlunoResumo::id).collect(Collectors.toSet());
        Map<Long, Leitor> leitores = c.base().carga().classificacao().leitores();
        Map<Long, long[]> embarques = new HashMap<>();
        Map<Long, Long> chegadas = new HashMap<>();
        for (Leitura l : c.base().carga().leituras()) {
            Leitor leitor = leitores.get(l.leitorId());
            if (leitor == null || leitor.tipo() != TipoLeitor.EMBARQUE || !dentro(l, periodo, c)
                    || !ids.contains(l.alunoId())) {
                continue;
            }
            Long veiculo = leitor.veiculoId() != null ? leitor.veiculoId() : l.veiculoId();
            if (veiculo == null || !filtro.aceitaVeiculo(veiculo) || !veiculoVisivel(c.escopo(), veiculo)) {
                continue;
            }
            long chave = chave(l);
            long instante = segundos(l.dataHora());
            long[] atual = embarques.get(chave);
            if (atual == null || instante < atual[0]) {
                embarques.put(chave, new long[] {instante, veiculo});
            }
        }
        for (Leitura l : c.base().carga().leituras()) {
            Leitor leitor = leitores.get(l.leitorId());
            if (leitor == null || leitor.tipo() != TipoLeitor.CHEGADA || !dentro(l, periodo, c)) {
                continue;
            }
            long chave = chave(l);
            long[] embarque = embarques.get(chave);
            long instante = segundos(l.dataHora());
            if (embarque != null && instante >= embarque[0]) {
                chegadas.merge(chave, instante, Math::min);
            }
        }

        Viagens r = new Viagens(recorte.grupos().size());
        embarques.forEach((chave, e) -> {
            LocalDate dia = LocalDate.ofEpochDay(chave % DIAS_CHAVE);
            Long chegada = chegadas.get(chave);
            Long minutos = chegada == null ? null : (chegada - e[0]) / 60;
            r.total.somar(dia, minutos, janelaMin);
            r.serie[recorte.indice(dia)].somar(dia, minutos, janelaMin);
            r.porVeiculo.computeIfAbsent(e[1], v -> new SomaViagem()).somar(dia, minutos, janelaMin);
        });
        return r;
    }

    private static boolean dentro(Leitura l, Periodo periodo, Contexto c) {
        LocalDate dia = l.dataHora().toLocalDate();
        return !dia.isBefore(periodo.inicio()) && !dia.isAfter(periodo.fim()) && !l.dataHora().isAfter(c.agora());
    }

    private static long chave(Leitura l) {
        return l.alunoId() * DIAS_CHAVE + l.dataHora().toLocalDate().toEpochDay();
    }

    private static long segundos(LocalDateTime dataHora) {
        return dataHora.toEpochSecond(ZoneOffset.UTC);
    }

    /** Monitor só vê os seus veículos; os demais perfis já chegam aqui com os alunos do próprio escopo. */
    private static boolean veiculoVisivel(Escopo escopo, Long veiculo) {
        return escopo.perfil() != Perfil.MONITOR || escopo.podeVerVeiculo(veiculo);
    }

    private List<Alerta> alertasDe(Contexto c, FiltroAnalise filtro, Periodo periodo) {
        ZoneId zona = regras.zona();
        return alertas.findByPrimeiraOcorrenciaEmBetween(periodo.inicio().atStartOfDay(zona).toInstant(),
                        periodo.fim().plusDays(1).atStartOfDay(zona).toInstant().minusNanos(1)).stream()
                .filter(a -> visivel(c.escopo(), a))
                .filter(a -> filtro.escolaIds().isEmpty() || filtro.aceitaEscola(a.getEscolaId()))
                .filter(a -> filtro.aceitaVeiculo(a.getVeiculoId()))
                .toList();
    }

    private static boolean visivel(Escopo escopo, Alerta a) {
        if (escopo.perfil().escopoGlobal()) {
            return true;
        }
        return escopo.perfil() == Perfil.DIRETOR ? escopo.podeVerEscola(a.getEscolaId())
                : escopo.podeVerVeiculo(a.getVeiculoId());
    }

    private static AlertasDoPeriodo resumoAlertas(List<Alerta> lista, List<Alerta> ref) {
        Map<Severidade, Long> porSeveridade = new EnumMap<>(Severidade.class);
        for (Severidade s : Severidade.values()) {
            porSeveridade.put(s, 0L);
        }
        Map<TipoAlerta, Long> porTipo = new EnumMap<>(TipoAlerta.class);
        long abertos = 0;
        long resolvidos = 0;
        long somaMin = 0;
        for (Alerta a : lista) {
            porSeveridade.merge(a.getSeveridade(), 1L, Long::sum);
            porTipo.merge(a.getTipo(), 1L, Long::sum);
            if (a.getStatus() == StatusAlerta.RESOLVIDO) {
                if (a.getResolvidoEm() != null) {
                    resolvidos++;
                    somaMin += Math.max(0, (a.getResolvidoEm().getEpochSecond()
                            - a.getPrimeiraOcorrenciaEm().getEpochSecond()) / 60);
                }
            } else {
                abertos++;
            }
        }
        Map<TipoAlerta, Long> ordenado = porTipo.entrySet().stream()
                .sorted(Map.Entry.<TipoAlerta, Long>comparingByValue().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
        return new AlertasDoPeriodo(contagem(lista.size(), ref == null ? null : (long) ref.size()), abertos,
                porSeveridade, ordenado, media(somaMin, resolvidos));
    }

    // ---------------------------------------------------------------- comum

    private Contexto contexto(FiltroAnalise filtro) {
        filtro.escolaIds().forEach(escopo::exigirEscola);
        if (filtro.veiculoId() != null && escopo.atual().perfil() == Perfil.MONITOR) {
            escopo.exigirVeiculo(filtro.veiculoId());
        }
        LocalDate hoje = jornadas.hoje();
        LocalDate fim = filtro.dataFim() != null ? filtro.dataFim() : hoje;
        LocalDate inicio = filtro.dataInicio() != null ? filtro.dataInicio() : fim.minusDays(DIAS_PADRAO - 1L);
        Periodo periodo = Periodo.validar(inicio, fim, MAXIMO_DIAS);
        Periodo referencia = filtro.comparar().referencia(periodo);
        int ano = filtro.anoLetivo() != null ? filtro.anoLetivo() : fim.getYear();
        int anoReferencia = referencia == null ? ano : ano + referencia.fim().getYear() - fim.getYear();
        return new Contexto(escopo.atual(), jornadas.carregarBase(), hoje, jornadas.agora(), periodo, referencia,
                ano, anoReferencia);
    }

    private List<AlunoResumo> alunos(Contexto c, FiltroAnalise filtro, int ano) {
        return c.escopo().filtrar(catalogo.doAno(c.base(), ano).stream()
                        .filter(a -> filtro.aceita(a, etapas::etapaDe)).toList(),
                AlunoResumo::escolaId, AlunoResumo::veiculoId);
    }

    static BigDecimal percentual(long parte, long total) {
        if (total == 0) {
            return null;
        }
        return BigDecimal.valueOf(parte * 100L).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    /** Variação percentual de uma contagem; nula sem base de comparação. */
    static BigDecimal variacao(long atual, long anterior) {
        if (anterior == 0) {
            return null;
        }
        return BigDecimal.valueOf((atual - anterior) * 100L).divide(BigDecimal.valueOf(anterior), 1,
                RoundingMode.HALF_UP);
    }

    /** Diferença entre dois valores (pontos percentuais para frequência, minutos para tempo). */
    static BigDecimal diferenca(BigDecimal atual, BigDecimal anterior) {
        return atual == null || anterior == null ? null : atual.subtract(anterior);
    }

    private static BigDecimal media(long soma, long n) {
        return n == 0 ? null : BigDecimal.valueOf(soma).divide(BigDecimal.valueOf(n), 1, RoundingMode.HALF_UP);
    }

    private static Indicador contagem(long atual, Long anterior) {
        return new Indicador(BigDecimal.valueOf(atual), anterior == null ? null : BigDecimal.valueOf(anterior),
                anterior == null ? null : variacao(atual, anterior));
    }

    private record Contexto(Escopo escopo, Base base, LocalDate hoje, LocalDateTime agora, Periodo periodo,
                            Periodo referencia, int ano, int anoReferencia) {
    }

    private static final class Soma {
        long esperados;
        long presentes;

        void somar(long e, long p) {
            esperados += e;
            presentes += p;
        }
    }

    private static final class Frequencias {
        final Soma total = new Soma();
        final Soma[] serie;
        final Map<Long, Soma> porEscola = new HashMap<>();
        final Map<String, Soma> porEtapa = new TreeMap<>();
        final Map<String, Soma> porTurno = new TreeMap<>();
        final Map<DayOfWeek, Soma> porDiaSemana = new EnumMap<>(DayOfWeek.class);
        final Map<Long, String> nomes = new HashMap<>();
        long alunosAvaliados;
        long abaixoDoLimite;
        long diasLetivos;

        Frequencias(int grupos) {
            serie = new Soma[grupos];
            for (int i = 0; i < grupos; i++) {
                serie[i] = new Soma();
            }
        }
    }

    private static final class SomaViagem {
        final Set<LocalDate> dias = new HashSet<>();
        long embarques;
        long comChegada;
        long somaMin;
        long noPrazo;

        void somar(LocalDate dia, Long minutos, long janelaMin) {
            dias.add(dia);
            embarques++;
            if (minutos != null) {
                comChegada++;
                somaMin += minutos;
                if (minutos <= janelaMin) {
                    noPrazo++;
                }
            }
        }
    }

    private static final class Viagens {
        final SomaViagem total = new SomaViagem();
        final SomaViagem[] serie;
        final Map<Long, SomaViagem> porVeiculo = new HashMap<>();

        Viagens(int grupos) {
            serie = new SomaViagem[grupos];
            for (int i = 0; i < grupos; i++) {
                serie[i] = new SomaViagem();
            }
        }

        long viagens() {
            return porVeiculo.values().stream().mapToLong(s -> s.dias.size()).sum();
        }
    }

    // ---------------------------------------------------------------- respostas

    /**
     * Valor do período, do período de referência e a variação. A unidade da variação depende do indicador:
     * pontos percentuais para frequências, minutos para tempo, % para contagens.
     */
    public record Indicador(BigDecimal atual, BigDecimal anterior, BigDecimal variacao) {
    }

    public record Ponto(LocalDate inicio, long esperados, long presentes, BigDecimal frequencia) {
    }

    /** @param variacao em pontos percentuais em relação ao período de referência */
    public record Grupo(String chave, String rotulo, long esperados, long presentes, BigDecimal frequencia,
                        BigDecimal anterior, BigDecimal variacao, FaixaFrequencia faixa) {
    }

    /**
     * @param abaixoDoLimite alunos com frequência abaixo de {@code limiteRisco}% no período (só a contagem)
     * @param serieReferencia mesma granularidade da série, alinhada pela posição
     */
    public record AnaliseFrequencia(Periodo periodo, Periodo referencia, Granularidade granularidade,
                                    Indicador frequencia, long diasLetivos, long alunosAvaliados,
                                    Indicador abaixoDoLimite, int limiteRisco, List<Ponto> serie,
                                    List<Ponto> serieReferencia, List<Grupo> porEscola, List<Grupo> porEtapa,
                                    List<Grupo> porTurno, List<Grupo> porDiaSemana, boolean etapasConfiguradas,
                                    boolean desatualizado, boolean incompleto) {
    }

    public record MatriculasDoAno(int ano, long total, Map<String, Long> porGrupo) {
    }

    /** @param variacao % em relação ao ano letivo anterior; nula se não havia matrícula */
    public record Comparativo(String chave, String rotulo, long atual, long anterior, BigDecimal variacao) {
    }

    /** @param disponivel falso quando a fonte do dado ainda não está completa (ex.: índice de responsáveis) */
    public record Cobertura(String chave, String rotulo, long com, long total, BigDecimal percentual,
                            boolean disponivel) {
    }

    /** @param agrupamento "ETAPA" quando há mapa de etapas; senão "ANO_ESCOLAR" */
    public record AnaliseMatriculas(int anoLetivo, String agrupamento, Indicador total, Indicador turmas,
                                    List<MatriculasDoAno> porAno, List<Comparativo> porAnoEscolar,
                                    List<Comparativo> porEscola, List<Comparativo> porTurno,
                                    List<Cobertura> cobertura, boolean desatualizado, boolean incompleto) {
    }

    /** @param noPrazo % das chegadas em até {@code janelaMin} minutos depois do embarque */
    public record PontoFrota(LocalDate inicio, long embarques, BigDecimal tempoMedioMin, BigDecimal noPrazo,
                             long alertas, long criticos) {
    }

    public record VeiculoAnalise(long id, String placa, String prefixo, long viagens, long embarques,
                                 long semChegada, BigDecimal tempoMedioMin, BigDecimal noPrazo, long alertas) {
    }

    /** @param tempoMedioResolucaoMin da primeira ocorrência até a resolução, só dos resolvidos */
    public record AlertasDoPeriodo(Indicador total, long abertos, Map<Severidade, Long> porSeveridade,
                                   Map<TipoAlerta, Long> porTipo, BigDecimal tempoMedioResolucaoMin) {
    }

    /** @param viagens dias com ao menos um embarque, somados por veículo no total */
    public record AnaliseFrota(Periodo periodo, Periodo referencia, Granularidade granularidade, long janelaMin,
                               Indicador embarques, Indicador viagens, Indicador tempoMedioMin, Indicador noPrazo,
                               List<PontoFrota> serie, List<PontoFrota> serieReferencia,
                               List<VeiculoAnalise> veiculos, AlertasDoPeriodo alertas, boolean desatualizado,
                               boolean incompleto) {
    }
}
