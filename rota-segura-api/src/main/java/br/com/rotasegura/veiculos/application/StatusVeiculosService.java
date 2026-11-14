package br.com.rotasegura.veiculos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.VisaoDoDiaService;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.TipoDivergencia;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.shared.integration.ResultadoCache;
import br.com.rotasegura.veiculos.domain.FaixaOcupacao;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Situação de cada veículo hoje: embarcados x esperados, ocupação, estado e última leitura.
 *
 * <p>Limitações da fonte (documentadas para o painel):
 * <ul>
 *   <li>O cadastro do aluno não informa o veículo: "esperados" é estimado pelos alunos que embarcaram no
 *       veículo nos últimos dias letivos ({@code rota-segura.veiculos.dias-historico}).</li>
 *   <li>A API não informa capacidade: sem {@code rota-segura.veiculos.capacidade}, ocupação e faixa ficam nulas.</li>
 *   <li>{@code latitude}/{@code longitude} são da escola ligada aos leitores do veículo; o GPS ao vivo do
 *       ônibus fica no {@link RastreamentoService}.
 *       A coordenada das leituras não é usada (indicaria o ponto de embarque de uma criança).</li>
 * </ul>
 */
@Service
public class StatusVeiculosService {

    private final VeiculosClient veiculos;
    private final JornadaService jornadas;
    private final VisaoDoDiaService visao;
    private final CalendarioLetivo calendario;
    private final EscopoService escopo;
    private final VeiculosProperties propriedades;

    public StatusVeiculosService(VeiculosClient veiculos, JornadaService jornadas, VisaoDoDiaService visao,
                                 CalendarioLetivo calendario, EscopoService escopo,
                                 VeiculosProperties propriedades) {
        this.veiculos = veiculos;
        this.jornadas = jornadas;
        this.visao = visao;
        this.calendario = calendario;
        this.escopo = escopo;
        this.propriedades = propriedades;
    }

    /** Veículos no escopo do usuário. */
    public StatusDosVeiculos status() {
        Escopo atual = escopo.atual();
        Base base = jornadas.carregarBase();
        Calculo calculo = calcular(base);
        List<StatusVeiculo> noEscopo = atual.filtrar(calculo.veiculos(), StatusVeiculo::escolaId, StatusVeiculo::id);
        return montarResposta(noEscopo, calculo);
    }

    /** Detalhe de um veículo: embarcados de hoje e últimas leituras dos seus leitores. */
    public DetalheVeiculo detalhe(long veiculoId) {
        Escopo atual = escopo.atual();
        Base base = jornadas.carregarBase();
        Calculo calculo = calcular(base);
        StatusVeiculo status = calculo.veiculos().stream().filter(v -> v.id() == veiculoId).findFirst()
                .orElseThrow(() -> new RecursoNaoEncontradoException("veiculo", veiculoId));
        if (atual.filtrar(List.of(status), StatusVeiculo::escolaId, StatusVeiculo::id).isEmpty()) {
            throw new br.com.rotasegura.shared.erro.AcessoNegadoException("Veículo fora do seu escopo.");
        }
        List<Embarcado> embarcados = calculo.linhasHoje().stream()
                .filter(l -> l.jornada().embarqueEm() != null && Long.valueOf(veiculoId).equals(l.jornada().veiculoId()))
                .sorted(Comparator.comparing(l -> l.jornada().embarqueEm()))
                .map(l -> new Embarcado(l.aluno().id(), l.aluno().iniciais(), l.aluno().turma(),
                        l.jornada().estado(), l.jornada().embarqueEm(), l.jornada().chegadaEm()))
                .toList();
        Set<Long> leitores = Set.copyOf(status.leitores());
        Map<Long, Leitor> classificados = base.carga().classificacao().leitores();
        LocalDateTime agora = jornadas.agora();
        List<LeituraRecente> ultimas = base.carga().leituras().stream()
                .filter(l -> leitores.contains(l.leitorId()) && !l.dataHora().isAfter(agora))
                .sorted(Comparator.comparing(Leitura::dataHora).reversed())
                .limit(20)
                .map(l -> new LeituraRecente(l.dataHora(), l.leitorId(),
                        classificados.containsKey(l.leitorId()) ? classificados.get(l.leitorId()).tipo() : null,
                        l.alunoId()))
                .toList();
        return new DetalheVeiculo(status, embarcados, ultimas, calculo.desatualizado(), calculo.incompleto());
    }

    /** Todos os veículos, sem escopo (usado pelas regras de alerta e pelo tempo real). */
    public Calculo calcular(Base base) {
        LocalDate hoje = jornadas.hoje();
        LocalDateTime agora = jornadas.agora();
        ResultadoCache<ColecaoPaginada<VeiculoDto>> cadastro = veiculos.listarTodos();
        List<Linha> linhasHoje = visao.montar(hoje, FiltroAlunos.NENHUM, Escopo.sistema(), base).linhas();

        Map<Long, List<JornadaDoDia>> historicoPorVeiculo = new HashMap<>();
        for (LocalDate dia : calendario.letivosAntes(hoje, propriedades.diasHistorico())) {
            for (JornadaDoDia jornada : jornadas.doDia(dia, null, base).jornadas()) {
                if (jornada.embarqueEm() != null && jornada.veiculoId() != null) {
                    historicoPorVeiculo.computeIfAbsent(jornada.veiculoId(), v -> new ArrayList<>()).add(jornada);
                }
            }
        }

        Map<Long, List<DispositivoFacialDto>> leitoresPorVeiculo = new HashMap<>();
        for (DispositivoFacialDto d : base.carga().dispositivos()) {
            Long veiculo = Conversoes.paraLong(d.veiculoId());
            if (veiculo != null && Conversoes.paraLong(d.id()) != null) {
                leitoresPorVeiculo.computeIfAbsent(veiculo, v -> new ArrayList<>()).add(d);
            }
        }
        Map<Long, LocalDateTime> ultimaPorLeitor = new HashMap<>();
        for (Leitura l : base.carga().leituras()) {
            if (!l.dataHora().isAfter(agora)) {
                ultimaPorLeitor.merge(l.leitorId(), l.dataHora(), (a, b) -> a.isAfter(b) ? a : b);
            }
        }

        List<StatusVeiculo> resultado = new ArrayList<>();
        for (VeiculoDto dto : cadastro.valor().itens()) {
            Long id = Conversoes.paraLong(dto.id());
            if (id == null) {
                continue;
            }
            resultado.add(statusDe(id, dto, linhasHoje, historicoPorVeiculo.getOrDefault(id, List.of()),
                    leitoresPorVeiculo.getOrDefault(id, List.of()), ultimaPorLeitor));
        }
        resultado.sort(Comparator.comparing(StatusVeiculo::placa, Comparator.nullsLast(Comparator.naturalOrder())));
        return new Calculo(agora, resultado, linhasHoje,
                cadastro.desatualizado() || base.desatualizado(),
                cadastro.valor().truncada() || base.incompleto());
    }

    private StatusVeiculo statusDe(long id, VeiculoDto dto, List<Linha> linhasHoje, List<JornadaDoDia> historico,
                                   List<DispositivoFacialDto> leitores, Map<Long, LocalDateTime> ultimaPorLeitor) {
        List<JornadaDoDia> hoje = linhasHoje.stream().map(Linha::jornada)
                .filter(j -> j.embarqueEm() != null && Long.valueOf(id).equals(j.veiculoId()))
                .toList();
        long embarcados = hoje.size();
        // A bordo: embarcou, não chegou e ainda está dentro da janela. Quem passou da janela vira
        // divergência EMBARCOU_SEM_CHEGADA (alerta crítico) e não mantém o veículo "em rota" para sempre.
        long aBordo = hoje.stream()
                .filter(j -> j.chegadaEm() == null && !j.temDivergencia(TipoDivergencia.EMBARCOU_SEM_CHEGADA))
                .count();
        long chegaram = hoje.stream().filter(j -> j.estado() == EstadoJornada.NA_ESCOLA).count();

        Set<Long> esperados = new HashSet<>();
        historico.forEach(j -> esperados.add(j.alunoId()));
        hoje.forEach(j -> esperados.add(j.alunoId()));

        Integer capacidade = propriedades.capacidade().get(id);
        BigDecimal ocupacao = capacidade == null || capacidade <= 0 ? null
                : BigDecimal.valueOf(embarcados * 100L).divide(BigDecimal.valueOf(capacidade), 1, RoundingMode.HALF_UP);
        FaixaOcupacao faixa = FaixaOcupacao.de(ocupacao, propriedades.limiteAtencao(), propriedades.limiteCritico());

        EstadoVeiculo estado = aBordo > 0 ? EstadoVeiculo.EM_ROTA
                : embarcados > 0 ? EstadoVeiculo.CONCLUIDO : EstadoVeiculo.SEM_EMBARQUE;

        LocalDateTime saida = hoje.stream().map(JornadaDoDia::embarqueEm).min(Comparator.naturalOrder()).orElse(null);
        Long tempoMedio = mediana(historico.stream().map(JornadaDoDia::tempoTrajetoMin)
                .filter(t -> t != null).sorted().toList());
        LocalDateTime previsao = saida != null && tempoMedio != null && estado == EstadoVeiculo.EM_ROTA
                ? saida.plusMinutes(tempoMedio) : null;

        Long escolaId = null;
        Double latitude = null;
        Double longitude = null;
        List<Long> idsLeitores = new ArrayList<>();
        LocalDateTime ultimaLeitura = null;
        for (DispositivoFacialDto d : leitores) {
            Long leitorId = Conversoes.paraLong(d.id());
            idsLeitores.add(leitorId);
            if (escolaId == null) {
                escolaId = Conversoes.paraLong(d.escolaId());
                latitude = Conversoes.paraDouble(d.escolaLatitude());
                longitude = Conversoes.paraDouble(d.escolaLongitude());
            }
            LocalDateTime ultima = ultimaPorLeitor.get(leitorId);
            if (ultima != null && (ultimaLeitura == null || ultima.isAfter(ultimaLeitura))) {
                ultimaLeitura = ultima;
            }
        }
        if (escolaId == null) {
            escolaId = hoje.stream().map(JornadaDoDia::escolaId).filter(e -> e != null).findFirst().orElse(null);
        }
        String prefixo = dto.prefixo() != null && !dto.prefixo().isBlank() ? dto.prefixo()
                : leitores.stream().map(DispositivoFacialDto::veiculoPrefixo).filter(p -> p != null && !p.isBlank())
                        .findFirst().orElse(null);
        return new StatusVeiculo(id, dto.placa(), prefixo, juntar(dto.marca(), dto.modelo()), estado, embarcados,
                aBordo, chegaram, esperados.size(), capacidade, ocupacao, faixa, escolaId, latitude, longitude,
                List.copyOf(idsLeitores), ultimaLeitura, saida, tempoMedio, previsao);
    }

    static Long mediana(List<Long> ordenados) {
        if (ordenados.isEmpty()) {
            return null;
        }
        int meio = ordenados.size() / 2;
        return ordenados.size() % 2 == 1 ? ordenados.get(meio)
                : Math.round((ordenados.get(meio - 1) + ordenados.get(meio)) / 2.0);
    }

    private static String juntar(String marca, String modelo) {
        String texto = ((marca == null ? "" : marca.trim()) + " " + (modelo == null ? "" : modelo.trim())).trim();
        return texto.isEmpty() ? null : texto;
    }

    private StatusDosVeiculos montarResposta(List<StatusVeiculo> lista, Calculo calculo) {
        Map<EstadoVeiculo, Long> porEstado = new EnumMap<>(EstadoVeiculo.class);
        for (EstadoVeiculo e : EstadoVeiculo.values()) {
            porEstado.put(e, lista.stream().filter(v -> v.estado() == e).count());
        }
        return new StatusDosVeiculos(calculo.avaliadoEm(), porEstado, lista, propriedades.capacidade().isEmpty(),
                calculo.desatualizado(), calculo.incompleto());
    }

    public enum EstadoVeiculo {
        /** Há aluno embarcado que ainda não passou no leitor da escola, dentro da janela. */
        EM_ROTA,
        /** Houve embarques hoje e não há ninguém a bordo dentro da janela (quem não chegou virou alerta). */
        CONCLUIDO,
        /** Nenhum embarque hoje. */
        SEM_EMBARQUE
    }

    /**
     * @param esperados      estimado: alunos que embarcaram neste veículo hoje ou nos últimos dias letivos
     * @param capacidade     nula quando não configurada
     * @param ocupacao       embarcados do dia / capacidade, em %; nula sem capacidade
     * @param latitude       coordenada da escola ligada aos leitores do veículo (não é GPS do veículo)
     * @param tempoMedioMin  mediana do tempo de trajeto no histórico
     * @param previsaoChegada saída de hoje + tempo médio, só com o veículo em rota
     */
    public record StatusVeiculo(long id, String placa, String prefixo, String descricao, EstadoVeiculo estado,
                                long embarcados, long aBordo, long chegaram, long esperados, Integer capacidade,
                                BigDecimal ocupacao, FaixaOcupacao faixaOcupacao, Long escolaId, Double latitude,
                                Double longitude, List<Long> leitores, LocalDateTime ultimaLeitura,
                                LocalDateTime saida, Long tempoMedioMin, LocalDateTime previsaoChegada) {
    }

    /**
     * @param capacidadeNaoConfigurada nenhum veículo tem capacidade cadastrada: o painel avisa em vez de mostrar 0%
     */
    public record StatusDosVeiculos(LocalDateTime avaliadoEm, Map<EstadoVeiculo, Long> porEstado,
                                    List<StatusVeiculo> veiculos, boolean capacidadeNaoConfigurada,
                                    boolean desatualizado, boolean incompleto) {

        public StatusDosVeiculos {
            porEstado = Map.copyOf(porEstado);
            veiculos = List.copyOf(veiculos);
        }
    }

    /** Embarcado no detalhe do veículo: só iniciais e turma. */
    public record Embarcado(long alunoId, String iniciais, String turma, EstadoJornada estado,
                            LocalDateTime embarqueEm, LocalDateTime chegadaEm) {
    }

    public record LeituraRecente(LocalDateTime dataHora, long leitorId, TipoLeitor tipo, long alunoId) {
    }

    public record DetalheVeiculo(StatusVeiculo veiculo, List<Embarcado> embarcados, List<LeituraRecente> ultimasLeituras,
                                 boolean desatualizado, boolean incompleto) {
    }

    /** Resultado completo, sem escopo. */
    public record Calculo(LocalDateTime avaliadoEm, List<StatusVeiculo> veiculos, List<Linha> linhasHoje,
                          boolean desatualizado, boolean incompleto) {
    }
}
