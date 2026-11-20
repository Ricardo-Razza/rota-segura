package br.com.rotasegura.veiculos.application;

import br.com.rotasegura.auth.application.AuditoriaService;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.Passo;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.domain.CorredorDaRota;
import br.com.rotasegura.veiculos.domain.CorredorDaRota.DiaDeRota;
import br.com.rotasegura.veiculos.domain.Geo;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas.EmbarqueLocalizado;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas.Parada;
import br.com.rotasegura.veiculos.domain.PontoNoMomento;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvo;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvoRepository;
import br.com.rotasegura.veiculos.domain.PosicaoVeiculo;
import br.com.rotasegura.veiculos.domain.PrevisaoPorTrajeto;
import br.com.rotasegura.veiculos.domain.PrevisaoPorTrajeto.Previsao;
import br.com.rotasegura.veiculos.domain.RastroDoDia.Cerca;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * O que se aprende do trajeto guardado ({@code ponto_rastro}) de cada veículo: o caminho habitual, as paradas
 * reais e a previsão de chegada pela posição ao vivo. Também entrega o trajeto de um dia para o replay.
 * <p>
 * Tudo vem do banco próprio e das leituras já carregadas: nenhuma chamada nova à API externa.
 * <p>
 * LGPD: o trajeto e as paradas mostram por onde a rota passa (perto da casa das crianças). Saem só para quem
 * tem o veículo no escopo, cada consulta é auditada (só o id do veículo) e nenhum id de aluno vai junto.
 */
@Service
public class HistoricoDeRotasService {

    private static final Logger LOG = LoggerFactory.getLogger(HistoricoDeRotasService.class);

    private final PontoRastroSalvoRepository salvos;
    private final JornadaService jornadas;
    private final CalendarioLetivo calendario;
    private final DispositivosClient dispositivos;
    private final VeiculosClient veiculos;
    private final EscopoService escopo;
    private final AuditoriaService auditoria;
    private final RastreamentoProperties rastreamento;
    private final RotasProperties propriedades;

    private final Cache<Chave, HistoricoRota> historicos;
    private final Cache<LocalDate, Map<Long, List<Embarque>>> embarquesAnteriores;

    public HistoricoDeRotasService(PontoRastroSalvoRepository salvos, JornadaService jornadas,
                                   CalendarioLetivo calendario, DispositivosClient dispositivos,
                                   VeiculosClient veiculos, EscopoService escopo, AuditoriaService auditoria,
                                   RastreamentoProperties rastreamento, RotasProperties propriedades) {
        this.salvos = salvos;
        this.jornadas = jornadas;
        this.calendario = calendario;
        this.dispositivos = dispositivos;
        this.veiculos = veiculos;
        this.escopo = escopo;
        this.auditoria = auditoria;
        this.rastreamento = rastreamento;
        this.propriedades = propriedades;
        this.historicos = Caffeine.newBuilder().expireAfterWrite(propriedades.cache()).maximumSize(1_000).build();
        this.embarquesAnteriores = Caffeine.newBuilder().expireAfterWrite(propriedades.cache()).maximumSize(4).build();
    }

    /** Trajeto de um dia, com os embarques (hora e local, sem aluno) e a escola de destino, para o replay. */
    public TrajetoDoDia trajeto(long veiculoId, LocalDate data) {
        LocalDate hoje = jornadas.hoje();
        LocalDate dia = data != null ? data : hoje;
        if (dia.isAfter(hoje)) {
            throw new RequisicaoInvalidaException("A data do trajeto não pode ser futura.");
        }
        Cerca escola = exigirNoEscopo(veiculoId);
        auditoria.registrar(AcaoAuditoria.ACESSO_LOCAL_EMBARQUE, "veiculo", veiculoId);

        List<PontoRastro> pontos = pontosEntre(veiculoId, dia, dia.plusDays(1)).getOrDefault(dia, List.of());
        Base base = jornadas.carregarBase();
        List<EmbarqueNoTrajeto> embarques = embarquesDoDia(dia, base).getOrDefault(veiculoId, List.of()).stream()
                .map(e -> {
                    Optional<PontoRastro> local = localDoEmbarque(pontos, e.em());
                    return new EmbarqueNoTrajeto(e.em(), local.map(PontoRastro::latitude).orElse(null),
                            local.map(PontoRastro::longitude).orElse(null));
                })
                .toList();
        return new TrajetoDoDia(veiculoId, dia, pontos, embarques, Destino.de(escola), base.desatualizado());
    }

    /** Paradas reais aprendidas dos embarques dos últimos dias letivos. */
    public ParadasDoVeiculo paradas(long veiculoId) {
        exigirNoEscopo(veiculoId);
        auditoria.registrar(AcaoAuditoria.ACESSO_LOCAL_EMBARQUE, "veiculo", veiculoId);
        HistoricoRota h = historico(veiculoId);
        return new ParadasDoVeiculo(veiculoId, h.diasAnalisados(), h.embarquesLocalizados(), h.paradas());
    }

    /** Previsão de chegada pela posição atual; vazia sem histórico suficiente (o painel usa a estimativa pela saída). */
    public Optional<Previsao> previsao(long veiculoId, PosicaoVeiculo atual, LocalDateTime agora) {
        HistoricoRota h = historico(veiculoId);
        if (h.escola() == null) {
            return Optional.empty();
        }
        return PrevisaoPorTrajeto.estimar(atual, agora, h.dias(), h.escola(), propriedades.raioBuscaPrevisaoM(),
                propriedades.folgaHorarioPrevisao(), propriedades.minimoDias());
    }

    /** Histórico de um veículo para hoje, sem escopo (regras de alerta e previsão). Calculado uma vez a cada {@code cache}. */
    public HistoricoRota historico(long veiculoId) {
        LocalDate hoje = jornadas.hoje();
        return historicos.get(new Chave(veiculoId, hoje), c -> calcular(veiculoId, hoje));
    }

    /** Descarta o que foi calculado (testes e manutenção). */
    public void reiniciar() {
        historicos.invalidateAll();
        embarquesAnteriores.invalidateAll();
    }

    private HistoricoRota calcular(long veiculoId, LocalDate hoje) {
        int quantos = Math.max(propriedades.diasCorredor(), propriedades.diasParadas());
        List<LocalDate> letivos = calendario.letivosAntes(hoje, quantos);
        Cerca escola = escolaDoVeiculo(veiculoId).orElse(null);
        if (letivos.isEmpty()) {
            return new HistoricoRota(List.of(), new CorredorDaRota(List.of()), List.of(), 0, 0, escola);
        }
        Set<LocalDate> corredor = new HashSet<>(letivos.stream()
                .sorted(Comparator.reverseOrder()).limit(propriedades.diasCorredor()).toList());
        Set<LocalDate> paraParadas = new HashSet<>(letivos.stream()
                .sorted(Comparator.reverseOrder()).limit(propriedades.diasParadas()).toList());
        LocalDate primeiro = letivos.stream().min(Comparator.naturalOrder()).orElseThrow();

        Map<LocalDate, List<PontoRastro>> porDia;
        try {
            porDia = pontosEntre(veiculoId, primeiro, hoje);
        } catch (RuntimeException e) {
            LOG.warn("Trajetos anteriores não puderam ser lidos. veiculo={} motivo={}", veiculoId,
                    e.getClass().getSimpleName());
            return new HistoricoRota(List.of(), new CorredorDaRota(List.of()), List.of(), 0, 0, escola);
        }
        List<DiaDeRota> dias = new ArrayList<>();
        porDia.forEach((dia, pontos) -> {
            if (corredor.contains(dia)) {
                dias.add(new DiaDeRota(dia, pontos));
            }
        });

        List<EmbarqueLocalizado> localizados = new ArrayList<>();
        Set<LocalDate> diasComEmbarque = new HashSet<>();
        for (Embarque e : embarquesAnteriores(hoje).getOrDefault(veiculoId, List.of())) {
            LocalDate dia = e.em().toLocalDate();
            if (!paraParadas.contains(dia)) {
                continue;
            }
            diasComEmbarque.add(dia);
            localDoEmbarque(porDia.getOrDefault(dia, List.of()), e.em())
                    .ifPresent(p -> localizados.add(new EmbarqueLocalizado(p.latitude(), p.longitude(), e.em(),
                            e.alunoId())));
        }
        List<Parada> paradas = ParadasAprendidas.agrupar(localizados, propriedades.raioParadaM(),
                propriedades.minimoEmbarquesParada());
        return new HistoricoRota(dias, new CorredorDaRota(dias), paradas, diasComEmbarque.size(), localizados.size(),
                escola);
    }

    /** Embarques dos últimos dias letivos de todos os veículos (uma passada nas leituras para todos). */
    private Map<Long, List<Embarque>> embarquesAnteriores(LocalDate hoje) {
        return embarquesAnteriores.get(hoje, h -> {
            Base base = jornadas.carregarBase();
            Map<Long, List<Embarque>> porVeiculo = new HashMap<>();
            int quantos = Math.max(propriedades.diasCorredor(), propriedades.diasParadas());
            for (LocalDate dia : calendario.letivosAntes(h, quantos)) {
                embarquesDoDia(dia, base).forEach((v, lista) ->
                        porVeiculo.computeIfAbsent(v, x -> new ArrayList<>()).addAll(lista));
            }
            return porVeiculo;
        });
    }

    /** Todo embarque aceito do dia (inclusive o segundo, num embarque duplicado), por veículo. */
    private Map<Long, List<Embarque>> embarquesDoDia(LocalDate dia, Base base) {
        Map<Long, List<Embarque>> porVeiculo = new HashMap<>();
        for (JornadaDoDia jornada : jornadas.doDia(dia, null, base).jornadas()) {
            for (Passo passo : jornada.passos()) {
                if (passo.tipo() == TipoLeitor.EMBARQUE && passo.veiculoId() != null) {
                    porVeiculo.computeIfAbsent(passo.veiculoId(), v -> new ArrayList<>())
                            .add(new Embarque(jornada.alunoId(), passo.dataHora()));
                }
            }
        }
        porVeiculo.values().forEach(l -> l.sort(Comparator.comparing(Embarque::em)));
        return porVeiculo;
    }

    /** Pontos do veículo de {@code inicio} (inclusive) até {@code fim} (exclusive), agrupados por dia. */
    private Map<LocalDate, List<PontoRastro>> pontosEntre(long veiculoId, LocalDate inicio, LocalDate fim) {
        Map<LocalDate, List<PontoRastro>> porDia = new TreeMap<>();
        salvos.findByVeiculoIdAndRegistradoEmBetweenOrderByRegistradoEmAsc(veiculoId, inicio.atStartOfDay(),
                        fim.atStartOfDay().minusNanos(1000))
                .stream().map(PontoRastroSalvo::paraPonto)
                .forEach(p -> porDia.computeIfAbsent(p.em().toLocalDate(), d -> new ArrayList<>()).add(p));
        return porDia;
    }

    /** Onde o ônibus estava na hora do embarque, pelos pontos do dia (em ordem de hora). */
    static Optional<PontoRastro> localDoEmbarque(List<PontoRastro> pontos, LocalDateTime hora) {
        int baixo = 0;
        int alto = pontos.size() - 1;
        int ultimoAntes = -1;
        while (baixo <= alto) {
            int meio = (baixo + alto) >>> 1;
            if (!pontos.get(meio).em().isAfter(hora)) {
                ultimoAntes = meio;
                baixo = meio + 1;
            } else {
                alto = meio - 1;
            }
        }
        PontoRastro antes = ultimoAntes >= 0 ? pontos.get(ultimoAntes) : null;
        PontoRastro depois = null;
        if (antes != null && antes.em().equals(hora)) {
            depois = antes;
        } else if (ultimoAntes + 1 < pontos.size()) {
            depois = pontos.get(ultimoAntes + 1);
        }
        return PontoNoMomento.escolher(hora, antes, depois);
    }

    /** Lança 404 se o veículo não existe e 403 se está fora do escopo; devolve a escola de destino (ou nulo). */
    private Cerca exigirNoEscopo(long veiculoId) {
        boolean existe = Optional.ofNullable(veiculos.listarTodos()).map(r -> r.valor().itens()).orElse(List.of())
                .stream().anyMatch(v -> Objects.equals(Conversoes.paraLong(v.id()), veiculoId));
        if (!existe) {
            throw new RecursoNaoEncontradoException("veiculo", veiculoId);
        }
        Cerca escola = escolaDoVeiculo(veiculoId).orElse(null);
        Long escolaId = escola == null ? null : escola.escolaId();
        if (escopo.atual().filtrar(List.of(veiculoId), v -> escolaId, v -> v).isEmpty()) {
            throw new AcessoNegadoException("Veículo fora do seu escopo.");
        }
        return escola;
    }

    /** Escola de destino: a dos leitores faciais do veículo (com coordenada válida). */
    private Optional<Cerca> escolaDoVeiculo(long veiculoId) {
        List<DispositivoFacialDto> lista;
        try {
            lista = Optional.ofNullable(dispositivos.listarTodos()).map(r -> r.valor().itens()).orElse(List.of());
        } catch (RuntimeException e) {
            return Optional.empty();
        }
        for (DispositivoFacialDto d : lista) {
            Long escola = Conversoes.paraLong(d.escolaId());
            Double lat = Conversoes.paraDouble(d.escolaLatitude());
            Double lon = Conversoes.paraDouble(d.escolaLongitude());
            if (Objects.equals(Conversoes.paraLong(d.veiculoId()), veiculoId) && escola != null
                    && Geo.coordenadaValida(lat, lon)) {
                return Optional.of(new Cerca(escola, lat, lon, rastreamento.raioEscolaM()));
            }
        }
        return Optional.empty();
    }

    private record Chave(long veiculoId, LocalDate dia) {
    }

    private record Embarque(long alunoId, LocalDateTime em) {
    }

    /**
     * Histórico de um veículo, sem escopo.
     *
     * @param dias                 trajetos dos últimos dias letivos (caminho habitual e previsão)
     * @param diasAnalisados       dias com embarque usados para aprender as paradas
     * @param embarquesLocalizados embarques com local do ônibus conhecido
     * @param escola               destino do veículo; nulo quando desconhecido
     */
    public record HistoricoRota(List<DiaDeRota> dias, CorredorDaRota corredor, List<Parada> paradas,
                                int diasAnalisados, int embarquesLocalizados, Cerca escola) {

        public HistoricoRota {
            dias = List.copyOf(dias);
            paradas = List.copyOf(paradas);
        }
    }

    /** Embarque no replay: hora e local do ônibus (nulo sem trajeto naquela hora), sem aluno. */
    public record EmbarqueNoTrajeto(LocalDateTime em, Double latitude, Double longitude) {
    }

    public record Destino(long escolaId, double latitude, double longitude, int raioM) {

        static Destino de(Cerca cerca) {
            return cerca == null ? null
                    : new Destino(cerca.escolaId(), cerca.latitude(), cerca.longitude(), (int) cerca.raioM());
        }
    }

    /**
     * @param escola        destino; nulo quando desconhecido
     * @param desatualizado as leituras vieram do cache por falha da API externa
     */
    public record TrajetoDoDia(long veiculoId, LocalDate data, List<PontoRastro> pontos,
                               List<EmbarqueNoTrajeto> embarques, Destino escola, boolean desatualizado) {

        public TrajetoDoDia {
            pontos = List.copyOf(pontos);
            embarques = List.copyOf(embarques);
        }
    }

    /**
     * @param diasAnalisados       dias letivos com embarque no período analisado
     * @param embarquesLocalizados embarques com local conhecido que entraram no aprendizado
     */
    public record ParadasDoVeiculo(long veiculoId, int diasAnalisados, int embarquesLocalizados,
                                   List<Parada> paradas) {

        public ParadasDoVeiculo {
            paradas = List.copyOf(paradas);
        }
    }
}
