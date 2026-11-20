package br.com.rotasegura.alertas.application.regras;

import br.com.rotasegura.alertas.application.ContextoAvaliacao;
import br.com.rotasegura.alertas.application.RegraAlerta;
import br.com.rotasegura.alertas.domain.EntidadeAlerta;
import br.com.rotasegura.alertas.domain.Ocorrencia;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.veiculos.application.HistoricoDeRotasService;
import br.com.rotasegura.veiculos.application.HistoricoDeRotasService.HistoricoRota;
import br.com.rotasegura.veiculos.application.RastreamentoService;
import br.com.rotasegura.veiculos.application.RastreamentoService.RastreioVeiculo;
import br.com.rotasegura.veiculos.application.RotasProperties;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusVeiculo;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas;
import br.com.rotasegura.veiculos.domain.ParadasAprendidas.ParadaProxima;
import br.com.rotasegura.veiculos.domain.PosicaoVeiculo;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Regras sobre o trajeto ao vivo comparado com o histórico do veículo. Só valem com aluno a bordo, posição
 * recente, fora da cerca da escola e com histórico suficiente ({@code rota-segura.rotas.minimo-dias}).
 * Sem histórico, não há "normal" para comparar: melhor não alertar que alertar por palpite.
 */
public final class RegrasDeTrajeto {

    private static final Logger LOG = LoggerFactory.getLogger(RegrasDeTrajeto.class);

    private RegrasDeTrajeto() {
    }

    /** Veículo em condições de ser comparado com o histórico, com o que as regras precisam. */
    record EmRota(StatusVeiculo veiculo, RastreioVeiculo rastreio, PosicaoVeiculo posicao, HistoricoRota historico) {
    }

    static List<EmRota> emRota(ContextoAvaliacao ctx, RastreamentoService rastreamento,
                               HistoricoDeRotasService historicos) {
        Map<Long, RastreioVeiculo> rastreios = rastreamento.todos();
        List<EmRota> resultado = new ArrayList<>();
        for (StatusVeiculo v : ctx.veiculos()) {
            RastreioVeiculo r = rastreios.get(v.id());
            if (v.aBordo() == 0 || r == null || r.atrasada() || r.posicao() == null || r.naCercaDaEscola()) {
                continue;
            }
            try {
                resultado.add(new EmRota(v, r, r.posicao(), historicos.historico(v.id())));
            } catch (RuntimeException e) {
                LOG.warn("Histórico do trajeto indisponível. veiculo={} motivo={}", v.id(),
                        e.getClass().getSimpleName());
            }
        }
        return resultado;
    }

    /** Desvio: o ônibus está a mais de {@code distancia-desvio-m} de qualquer trajeto recente há mais que {@code tempo-desvio}. */
    @Component
    public static class DesvioDeRota implements RegraAlerta {

        private final RastreamentoService rastreamento;
        private final HistoricoDeRotasService historicos;
        private final RotasProperties propriedades;

        public DesvioDeRota(RastreamentoService rastreamento, HistoricoDeRotasService historicos,
                            RotasProperties propriedades) {
            this.rastreamento = rastreamento;
            this.historicos = historicos;
            this.propriedades = propriedades;
        }

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            List<Ocorrencia> resultado = new ArrayList<>();
            for (EmRota e : emRota(ctx, rastreamento, historicos)) {
                if (e.historico().corredor().dias() < propriedades.minimoDias()) {
                    continue;
                }
                Optional<LocalDateTime> fora = e.historico().corredor().foraDesde(e.rastreio().rastro(), e.posicao(),
                        propriedades.distanciaDesvioM());
                if (fora.isEmpty()) {
                    continue;
                }
                Duration tempo = Duration.between(fora.get(), ctx.agora());
                if (tempo.compareTo(propriedades.tempoDesvio()) < 0) {
                    continue;
                }
                String rotulo = ctx.rotuloVeiculo(e.veiculo().id());
                String mensagem = "Veículo " + rotulo + " fora do trajeto habitual desde "
                        + ContextoAvaliacao.hora(fora.get()) + " (" + tempo.toMinutes() + " min), a mais de "
                        + propriedades.distanciaDesvioM() + " m do caminho dos últimos "
                        + e.historico().corredor().dias() + " dias letivos, com " + aBordo(e.veiculo()) + ".";
                resultado.add(new Ocorrencia(TipoAlerta.DESVIO_DE_ROTA, Severidade.ATENCAO, EntidadeAlerta.VEICULO,
                        String.valueOf(e.veiculo().id()), rotulo, ctx.janelaDoDia(), mensagem,
                        e.veiculo().escolaId(), e.veiculo().id()));
            }
            return resultado;
        }
    }

    /**
     * Parada fora do padrão: o ônibus está parado há mais que {@code tempo-parado}, a mais de
     * {@code distancia-parada-conhecida-m} de toda parada aprendida. Sem paradas aprendidas, não avalia.
     */
    @Component
    public static class ParadaForaDoPadrao implements RegraAlerta {

        private final RastreamentoService rastreamento;
        private final HistoricoDeRotasService historicos;
        private final RotasProperties propriedades;

        public ParadaForaDoPadrao(RastreamentoService rastreamento, HistoricoDeRotasService historicos,
                                  RotasProperties propriedades) {
            this.rastreamento = rastreamento;
            this.historicos = historicos;
            this.propriedades = propriedades;
        }

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            List<Ocorrencia> resultado = new ArrayList<>();
            for (EmRota e : emRota(ctx, rastreamento, historicos)) {
                if (e.historico().paradas().isEmpty()) {
                    continue;
                }
                LocalDateTime desde = ParadasAprendidas.paradoDesde(e.rastreio().rastro(),
                        e.posicao(), propriedades.raioParadoM());
                Duration parado = Duration.between(desde, ctx.agora());
                if (parado.compareTo(propriedades.tempoParado()) < 0) {
                    continue;
                }
                Optional<ParadaProxima> proxima = ParadasAprendidas.maisProxima(e.historico().paradas(),
                        e.posicao().latitude(), e.posicao().longitude());
                if (proxima.isPresent() && proxima.get().distanciaM() <= propriedades.distanciaParadaConhecidaM()) {
                    continue;
                }
                if (e.historico().escola() != null && e.historico().escola().distanciaAte(e.posicao())
                        <= propriedades.distanciaParadaConhecidaM() + e.historico().escola().raioM()) {
                    continue;
                }
                String rotulo = ctx.rotuloVeiculo(e.veiculo().id());
                String longe = proxima.map(p -> ", a " + Math.round(p.distanciaM()) + " m da parada conhecida mais perto")
                        .orElse("");
                String mensagem = "Veículo " + rotulo + " parado desde " + ContextoAvaliacao.hora(desde) + " ("
                        + parado.toMinutes() + " min) fora das paradas habituais" + longe + ", com "
                        + aBordo(e.veiculo()) + ".";
                resultado.add(new Ocorrencia(TipoAlerta.PARADA_FORA_DO_PADRAO, Severidade.ATENCAO,
                        EntidadeAlerta.VEICULO, String.valueOf(e.veiculo().id()), rotulo, ctx.janelaDoDia(), mensagem,
                        e.veiculo().escolaId(), e.veiculo().id()));
            }
            return resultado;
        }
    }

    private static String aBordo(StatusVeiculo v) {
        return v.aBordo() + (v.aBordo() == 1 ? " aluno a bordo" : " alunos a bordo");
    }
}
