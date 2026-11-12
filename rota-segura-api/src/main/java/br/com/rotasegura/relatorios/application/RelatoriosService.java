package br.com.rotasegura.relatorios.application;

import br.com.rotasegura.alunos.application.AlunoResumo;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.auth.application.AuditoriaService;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.VisaoDoDiaService;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.TipoDivergencia;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.relatorios.domain.EscritorCsv;
import br.com.rotasegura.relatorios.domain.Tabela;
import br.com.rotasegura.relatorios.domain.TipoRelatorio;
import br.com.rotasegura.shared.application.Periodo;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Collator;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Service;

/**
 * Relatórios de frequência e de veículos, com prévia e exportação (CSV e PDF). Toda exportação é auditada.
 * Período padrão: últimos 7 dias; máximo de 92 dias. Só dias letivos até hoje entram no cálculo.
 */
@Service
public class RelatoriosService {

    public static final int MAXIMO_DIAS = 92;
    public static final int LINHAS_PREVIA = 20;
    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JornadaService jornadas;
    private final VisaoDoDiaService visao;
    private final CalendarioLetivo calendario;
    private final VeiculosClient veiculos;
    private final EscopoService escopo;
    private final AuditoriaService auditoria;

    public RelatoriosService(JornadaService jornadas, VisaoDoDiaService visao, CalendarioLetivo calendario,
                             VeiculosClient veiculos, EscopoService escopo, AuditoriaService auditoria) {
        this.jornadas = jornadas;
        this.visao = visao;
        this.calendario = calendario;
        this.veiculos = veiculos;
        this.escopo = escopo;
        this.auditoria = auditoria;
    }

    public Previa previa(Pedido pedido) {
        Tabela completa = gerar(pedido);
        return new Previa(completa.primeiras(LINHAS_PREVIA), completa.linhas().size());
    }

    /** Gera a tabela inteira (no fio da requisição, onde o escopo do usuário está disponível). */
    public Tabela gerar(Pedido pedido) {
        if (pedido.filtro().escolaId() != null) {
            escopo.exigirEscola(pedido.filtro().escolaId());
        }
        Escopo atual = escopo.atual();
        Periodo periodo = periodo(pedido);
        Base base = jornadas.carregarBase();
        LocalDate hoje = jornadas.hoje();
        List<LocalDate> dias = calendario.letivosEntre(periodo.inicio(), periodo.fim().isAfter(hoje) ? hoje : periodo.fim());
        Map<LocalDate, List<Linha>> porDia = new LinkedHashMap<>();
        for (LocalDate dia : dias) {
            porDia.put(dia, visao.montar(dia, pedido.filtro(), atual, base).linhas());
        }
        String rotulo = BR.format(periodo.inicio()) + " a " + BR.format(periodo.fim());
        return pedido.tipo() == TipoRelatorio.VEICULOS ? veiculos(porDia, rotulo, atual) : frequencia(porDia, rotulo);
    }

    /** Exporta e audita. O nome do arquivo leva só tipo e datas. */
    public Exportacao exportar(Pedido pedido, Formato formato) {
        Tabela tabela = gerar(pedido);
        Periodo periodo = periodo(pedido);
        String sufixo = periodo.inicio() + "_" + periodo.fim();
        auditoria.registrar(AcaoAuditoria.EXPORTACAO, "relatorio-" + pedido.tipo().name().toLowerCase(Locale.ROOT),
                sufixo + (formato == Formato.PDF ? "_pdf" : "_csv"));
        String nome = pedido.tipo().name().toLowerCase(Locale.ROOT) + "_" + sufixo + "." + formato.extensao;
        return new Exportacao(nome, formato, tabela);
    }

    public static byte[] emBytes(Exportacao exportacao) {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        escrever(exportacao, saida);
        return saida.toByteArray();
    }

    public static void escrever(Exportacao exportacao, OutputStream saida) {
        try {
            if (exportacao.formato() == Formato.PDF) {
                EscritorPdf.escrever(exportacao.tabela(), saida);
            } else {
                EscritorCsv.escrever(exportacao.tabela(), saida);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    Periodo periodo(Pedido pedido) {
        LocalDate hoje = jornadas.hoje();
        LocalDate fim = pedido.dataFim() != null ? pedido.dataFim() : hoje;
        LocalDate inicio = pedido.dataInicio() != null ? pedido.dataInicio() : fim.minusDays(6);
        return Periodo.validar(inicio, fim, MAXIMO_DIAS);
    }

    private static Tabela frequencia(Map<LocalDate, List<Linha>> porDia, String periodo) {
        Map<Long, AlunoResumo> alunos = new HashMap<>();
        Map<Long, long[]> contagem = new HashMap<>();
        porDia.values().forEach(linhas -> linhas.stream().filter(Linha::esperado).forEach(l -> {
            alunos.put(l.aluno().id(), l.aluno());
            long[] c = contagem.computeIfAbsent(l.aluno().id(), id -> new long[2]);
            c[0]++;
            if (l.jornada().estado() == EstadoJornada.NA_ESCOLA) {
                c[1]++;
            }
        }));
        Collator collator = Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        List<AlunoResumo> ordenados = alunos.values().stream()
                .sorted(Comparator.comparing((AlunoResumo a) -> a.nome() == null ? "" : a.nome(), collator))
                .toList();
        List<List<String>> linhas = new ArrayList<>();
        for (AlunoResumo a : ordenados) {
            long[] c = contagem.get(a.id());
            linhas.add(List.of(String.valueOf(a.id()), texto(a.nome()), texto(a.turma()), texto(a.anoEscolar()),
                    texto(a.escolaNome()), String.valueOf(c[0]), String.valueOf(c[1]), String.valueOf(c[0] - c[1]),
                    percentual(c[1], c[0])));
        }
        return new Tabela("Frequência por aluno", periodo,
                List.of("ID", "Aluno", "Turma", "Ano escolar", "Escola", "Dias letivos", "Presenças", "Faltas",
                        "Frequência (%)"),
                linhas);
    }

    private Tabela veiculos(Map<LocalDate, List<Linha>> porDia, String periodo, Escopo atual) {
        Map<Long, List<JornadaDoDia>> porVeiculo = new HashMap<>();
        Map<Long, Set<LocalDate>> viagens = new HashMap<>();
        porDia.forEach((dia, linhas) -> linhas.stream()
                .map(Linha::jornada)
                .filter(j -> j.embarqueEm() != null && j.veiculoId() != null)
                .forEach(j -> {
                    porVeiculo.computeIfAbsent(j.veiculoId(), v -> new ArrayList<>()).add(j);
                    viagens.computeIfAbsent(j.veiculoId(), v -> new TreeSet<>()).add(dia);
                }));
        Map<Long, VeiculoDto> cadastro = new HashMap<>();
        veiculos.listarTodos().valor().itens().forEach(v -> {
            Long id = Conversoes.paraLong(v.id());
            if (id != null) {
                cadastro.put(id, v);
            }
        });
        Set<Long> ids = new TreeSet<>(porVeiculo.keySet());
        if (atual.perfil().escopoGlobal()) {
            ids.addAll(cadastro.keySet());
        }
        List<List<String>> linhas = new ArrayList<>();
        for (Long id : ids) {
            List<JornadaDoDia> js = porVeiculo.getOrDefault(id, List.of());
            int nViagens = viagens.getOrDefault(id, Set.of()).size();
            List<Long> tempos = js.stream().map(JornadaDoDia::tempoTrajetoMin).filter(t -> t != null).sorted().toList();
            long atrasos = js.stream().filter(j -> j.temDivergencia(TipoDivergencia.EMBARCOU_SEM_CHEGADA)).count();
            VeiculoDto v = cadastro.get(id);
            linhas.add(List.of(String.valueOf(id), v == null ? "" : texto(v.placa()), v == null ? "" : texto(v.prefixo()),
                    String.valueOf(nViagens), String.valueOf(js.size()),
                    nViagens == 0 ? "" : BigDecimal.valueOf(js.size()).divide(BigDecimal.valueOf(nViagens), 1,
                            RoundingMode.HALF_UP).toPlainString(),
                    tempos.isEmpty() ? "" : String.valueOf(tempos.get(tempos.size() / 2)),
                    String.valueOf(atrasos)));
        }
        return new Tabela("Operação por veículo", periodo,
                List.of("ID", "Placa", "Prefixo", "Viagens", "Embarques", "Média por viagem",
                        "Tempo de trajeto (mediana, min)", "Atrasos (sem chegada na janela)"),
                linhas);
    }

    private static String texto(String valor) {
        return valor == null ? "" : valor;
    }

    private static String percentual(long parte, long total) {
        return total == 0 ? "" : BigDecimal.valueOf(parte * 100L)
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP).toPlainString();
    }

    public enum Formato {
        CSV("csv", "text/csv; charset=UTF-8"),
        PDF("pdf", "application/pdf");

        final String extensao;
        public final String contentType;

        Formato(String extensao, String contentType) {
            this.extensao = extensao;
            this.contentType = contentType;
        }
    }

    public record Pedido(TipoRelatorio tipo, LocalDate dataInicio, LocalDate dataFim, FiltroAlunos filtro) {

        public Pedido {
            tipo = tipo == null ? TipoRelatorio.FREQUENCIA : tipo;
            filtro = filtro == null ? FiltroAlunos.NENHUM : filtro;
        }
    }

    public record Previa(Tabela tabela, int totalLinhas) {
    }

    public record Exportacao(String nomeArquivo, Formato formato, Tabela tabela) {
    }
}
