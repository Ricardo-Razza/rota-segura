package br.com.rotasegura.veiculos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.application.JornadaProperties;
import br.com.rotasegura.shared.application.CentralDeEventos;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.domain.Geo;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvo;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvoRepository;
import br.com.rotasegura.veiculos.domain.PosicaoVeiculo;
import br.com.rotasegura.veiculos.domain.RastroDoDia;
import br.com.rotasegura.veiculos.domain.RastroDoDia.Cerca;
import br.com.rotasegura.veiculos.domain.RastroDoDia.Mudanca;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto.LocalizacaoDto;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Rastreamento GPS ao vivo: a cada {@code rota-segura.rastreamento.intervalo} (padrão 5 s) lê a última posição
 * de cada veículo com rastreador ({@code GET /api/veiculos/{id}/dados}), guarda o rastro do dia em memória,
 * calcula a cerca virtual da escola de destino e publica {@value #EVENTO_POSICAO} no tempo real.
 *
 * <p>Cada ponto novo do rastro também vai para o banco ({@code ponto_rastro}), para achar onde o ônibus estava
 * em cada embarque e para o rastro do dia sobreviver a um reinício. O que passa da retenção (padrão 90 dias)
 * é apagado todo dia.
 *
 * <p>LGPD: o rastro revela por onde a rota passa (perto da casa das crianças). Guarda só veículo, hora e
 * posição (nenhum dado de aluno), é entregue só a quem tem o veículo no escopo e nunca vai para log (o log
 * leva só o id do veículo).
 */
@Service
public class RastreamentoService {

    public static final String EVENTO_POSICAO = "veiculo.posicao";

    private static final Logger LOG = LoggerFactory.getLogger(RastreamentoService.class);

    private final VeiculosClient veiculos;
    private final DispositivosClient dispositivos;
    private final CentralDeEventos eventos;
    private final EscopoService escopo;
    private final Clock relogio;
    private final JornadaProperties jornada;
    private final RastreamentoProperties propriedades;
    private final PontoRastroSalvoRepository salvos;

    private final Map<Long, Acompanhamento> acompanhados = new HashMap<>();

    public RastreamentoService(VeiculosClient veiculos, DispositivosClient dispositivos, CentralDeEventos eventos,
                               EscopoService escopo, Clock relogio, JornadaProperties jornada,
                               RastreamentoProperties propriedades, PontoRastroSalvoRepository salvos) {
        this.veiculos = veiculos;
        this.dispositivos = dispositivos;
        this.eventos = eventos;
        this.escopo = escopo;
        this.relogio = relogio;
        this.jornada = jornada;
        this.propriedades = propriedades;
        this.salvos = salvos;
    }

    /** Apaga do banco o trajeto mais antigo que a retenção (padrão 90 dias), uma vez por dia. */
    @Scheduled(cron = "${rota-segura.rastreamento.cron-limpeza:0 30 3 * * *}",
            zone = "${rota-segura.jornada.zona:America/Sao_Paulo}")
    public int apagarVencidos() {
        int apagados = salvos.apagarAntesDe(agora().minus(propriedades.retencao()));
        if (apagados > 0) {
            LOG.info("Trajeto antigo apagado. pontos={}", apagados);
        }
        return apagados;
    }

    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "${rota-segura.rastreamento.intervalo:5s}")
    void agendado() {
        if (!propriedades.habilitado()) {
            return;
        }
        try {
            atualizar();
        } catch (RuntimeException e) {
            LOG.warn("Rastreamento falhou; tenta de novo no próximo ciclo. motivo={}", e.getClass().getSimpleName());
        }
    }

    /**
     * Uma rodada: consulta o rastreador de cada veículo e publica o que mudou.
     * As consultas correm em paralelo (até {@code consultas-simultaneas}), então a rodada dura o tempo do
     * rastreador mais lento, não a soma de todos. Falha num veículo não interrompe os outros.
     *
     * @return quantos veículos tiveram posição nova
     */
    public int atualizar() {
        List<VeiculoDto> cadastro = Optional.ofNullable(veiculos.listarTodos())
                .map(r -> r.valor().itens()).orElse(List.of());
        Map<Long, Cerca> cercas = cercasPorVeiculo();
        List<Long> comRastreador = cadastro.stream()
                .filter(dto -> dto.identificadorRastreador() != null && !dto.identificadorRastreador().isBlank())
                .map(dto -> Conversoes.paraLong(dto.id()))
                .filter(Objects::nonNull)
                .toList();
        if (comRastreador.isEmpty()) {
            return 0;
        }
        int novas = 0;
        try (ExecutorService consultas = Executors.newFixedThreadPool(
                Math.min(propriedades.consultasSimultaneas(), comRastreador.size()), Thread.ofVirtual().factory())) {
            List<Future<Boolean>> rodada = comRastreador.stream()
                    .map(id -> consultas.submit(() -> atualizarUm(id, cercas.get(id))))
                    .toList();
            for (Future<Boolean> f : rodada) {
                if (Boolean.TRUE.equals(f.get())) {
                    novas++;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException e) {
            LOG.warn("Consulta de posição falhou. motivo={}", e.getCause().getClass().getSimpleName());
        }
        return novas;
    }

    /** Consulta e registra um veículo; {@code true} se a posição mudou. */
    private boolean atualizarUm(long id, Cerca cerca) {
        Optional<PosicaoVeiculo> posicao;
        try {
            posicao = consultar(id);
        } catch (RuntimeException e) {
            marcarFalha(id);
            LOG.debug("Posição indisponível. veiculo={} motivo={}", id, e.getClass().getSimpleName());
            return false;
        }
        return posicao.isPresent() && registrar(id, posicao.get(), cerca);
    }

    /** Veículos no escopo do usuário, com posição e rastro do dia. */
    public RastreamentoAoVivo noEscopo() {
        var atual = escopo.atual();
        List<RastreioVeiculo> todos = new ArrayList<>(todos().values());
        todos.sort(Comparator.comparingLong(RastreioVeiculo::veiculoId));
        return new RastreamentoAoVivo(agora(), propriedades.intervalo().toSeconds(), propriedades.raioEscolaM(),
                atual.filtrar(todos, RastreioVeiculo::escolaId, RastreioVeiculo::veiculoId));
    }

    /** Um veículo, respeitando o escopo. */
    public RastreioVeiculo doVeiculo(long veiculoId) {
        RastreioVeiculo rastreio = todos().get(veiculoId);
        if (rastreio == null) {
            throw new RecursoNaoEncontradoException("rastreamento", veiculoId);
        }
        if (escopo.atual().filtrar(List.of(rastreio), RastreioVeiculo::escolaId, RastreioVeiculo::veiculoId)
                .isEmpty()) {
            throw new AcessoNegadoException("Veículo fora do seu escopo.");
        }
        return rastreio;
    }

    /** Todos os veículos acompanhados, sem escopo (regras de alerta). */
    public synchronized Map<Long, RastreioVeiculo> todos() {
        LocalDateTime agora = agora();
        Map<Long, RastreioVeiculo> resultado = new HashMap<>();
        acompanhados.forEach((id, a) -> resultado.put(id, a.retrato(id, agora, true)));
        return resultado;
    }

    /** Descarta posições e rastros guardados (testes e manutenção). */
    public synchronized void reiniciar() {
        acompanhados.clear();
    }

    private Optional<PosicaoVeiculo> consultar(long id) {
        DadosVeiculoDto dados = veiculos.dados(id);
        LocalizacaoDto l = dados == null ? null : dados.localizacao();
        if (l == null || Boolean.FALSE.equals(l.valid()) || !Geo.coordenadaValida(l.latitude(), l.longitude())) {
            return Optional.empty();
        }
        LocalDateTime registradaEm = Conversoes.paraDataHora(l.fixTime(), jornada.zona());
        if (registradaEm == null) {
            return Optional.empty();
        }
        Boolean movimento = l.attributes() == null ? null : l.attributes().motion();
        return Optional.of(new PosicaoVeiculo(l.latitude(), l.longitude(), Geo.nosParaKmh(l.speed()), l.course(),
                movimento, registradaEm));
    }

    private synchronized boolean registrar(long id, PosicaoVeiculo posicao, Cerca cerca) {
        LocalDateTime agora = agora();
        Acompanhamento a = acompanhados.computeIfAbsent(id, v -> new Acompanhamento(restaurado(v, agora)));
        a.cerca = cerca;
        a.falhando = false;
        Mudanca mudanca = a.rastro.registrar(posicao, agora.toLocalDate(), cerca);
        if (mudanca == Mudanca.NENHUMA) {
            return false;
        }
        if (mudanca == Mudanca.NOVO_PONTO) {
            salvar(id, posicao);
        }
        RastreioVeiculo semRastro = a.retrato(id, agora, false);
        eventos.publicar(EVENTO_POSICAO, new PosicaoAoVivo(semRastro, mudanca == Mudanca.NOVO_PONTO),
                semRastro.escolaId(), id, true);
        return true;
    }

    /** Rastro novo de um veículo, já com o trajeto de hoje que estiver no banco (ex.: depois de reiniciar). */
    private RastroDoDia restaurado(long id, LocalDateTime agora) {
        RastroDoDia rastro = new RastroDoDia(propriedades.maxPontosRastro(), propriedades.distanciaMinimaM());
        try {
            LocalDateTime inicioDoDia = agora.toLocalDate().atStartOfDay();
            List<PontoRastro> deHoje = salvos
                    .findByVeiculoIdAndRegistradoEmBetweenOrderByRegistradoEmAsc(id, inicioDoDia, agora)
                    .stream().map(PontoRastroSalvo::paraPonto).toList();
            rastro.restaurar(deHoje, agora.toLocalDate());
        } catch (RuntimeException e) {
            LOG.warn("Trajeto do dia não pôde ser lido do banco. veiculo={} motivo={}", id,
                    e.getClass().getSimpleName());
        }
        return rastro;
    }

    /** Guarda o ponto no banco; falha aqui não para o tempo real (o ponto continua no rastro em memória). */
    private void salvar(long id, PosicaoVeiculo posicao) {
        try {
            salvos.save(new PontoRastroSalvo(id, posicao.registradaEm(), posicao.latitude(), posicao.longitude()));
        } catch (RuntimeException e) {
            LOG.warn("Ponto do trajeto não foi salvo. veiculo={} motivo={}", id, e.getClass().getSimpleName());
        }
    }

    private synchronized void marcarFalha(long id) {
        Acompanhamento a = acompanhados.get(id);
        if (a != null) {
            a.falhando = true;
        }
    }

    /** Escola de destino de cada veículo: a dos seus leitores faciais (com coordenada válida). */
    private Map<Long, Cerca> cercasPorVeiculo() {
        Map<Long, Cerca> cercas = new HashMap<>();
        List<DispositivoFacialDto> lista;
        try {
            lista = Optional.ofNullable(dispositivos.listarTodos()).map(r -> r.valor().itens()).orElse(List.of());
        } catch (RuntimeException e) {
            // Sem leitores, segue sem cerca: a posição continua aparecendo.
            return cercas;
        }
        for (DispositivoFacialDto d : lista) {
            Long veiculo = Conversoes.paraLong(d.veiculoId());
            Long escola = Conversoes.paraLong(d.escolaId());
            Double lat = Conversoes.paraDouble(d.escolaLatitude());
            Double lon = Conversoes.paraDouble(d.escolaLongitude());
            if (veiculo != null && escola != null && Geo.coordenadaValida(lat, lon)) {
                cercas.putIfAbsent(veiculo, new Cerca(escola, lat, lon, propriedades.raioEscolaM()));
            }
        }
        return cercas;
    }

    private LocalDateTime agora() {
        return LocalDateTime.ofInstant(relogio.instant(), jornada.zona());
    }

    private final class Acompanhamento {
        final RastroDoDia rastro;
        Cerca cerca;
        boolean falhando;

        Acompanhamento(RastroDoDia rastro) {
            this.rastro = rastro;
        }

        RastreioVeiculo retrato(long id, LocalDateTime agora, boolean comRastro) {
            PosicaoVeiculo p = rastro.atual();
            boolean atrasada = p == null
                    || Duration.between(p.registradaEm(), agora).compareTo(propriedades.limitePosicaoAtrasada()) > 0;
            Double distancia = p == null || cerca == null ? null : (double) Math.round(cerca.distanciaAte(p));
            return new RastreioVeiculo(id, cerca == null ? null : cerca.escolaId(), p, atrasada, falhando,
                    distancia, rastro.naCercaDesde() != null, rastro.naCercaDesde(),
                    comRastro ? rastro.pontos() : List.of());
        }
    }

    /**
     * Situação do rastreamento de um veículo.
     *
     * @param escolaId          escola de destino (a dos leitores do veículo); nula se desconhecida
     * @param posicao           última posição lida; nula se o rastreador nunca respondeu com posição válida
     * @param atrasada          a posição é mais antiga que o limite configurado (ou não há posição)
     * @param falhando          a última consulta ao rastreador falhou (o painel mostra a última posição boa)
     * @param distanciaEscolaM  distância em metros até a escola de destino
     * @param naCercaDesde      hora do GPS em que entrou no raio da escola
     * @param rastro            pontos do dia (vazio nos eventos de tempo real)
     */
    public record RastreioVeiculo(long veiculoId, Long escolaId, PosicaoVeiculo posicao, boolean atrasada,
                                  boolean falhando, Double distanciaEscolaM, boolean naCercaDaEscola,
                                  LocalDateTime naCercaDesde, List<PontoRastro> rastro) {

        public RastreioVeiculo {
            rastro = List.copyOf(rastro);
        }
    }

    /** Evento de tempo real: a posição mudou; {@code novoPonto} diz se o cliente deve estender o rastro. */
    public record PosicaoAoVivo(RastreioVeiculo veiculo, boolean novoPonto) {
    }

    /**
     * @param intervaloS  intervalo de consulta ao rastreador
     * @param raioCercaM  raio da cerca virtual das escolas
     */
    public record RastreamentoAoVivo(LocalDateTime avaliadoEm, long intervaloS, int raioCercaM,
                                     List<RastreioVeiculo> veiculos) {

        public RastreamentoAoVivo {
            veiculos = List.copyOf(veiculos);
        }
    }
}
