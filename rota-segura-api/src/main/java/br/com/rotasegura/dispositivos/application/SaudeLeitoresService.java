package br.com.rotasegura.dispositivos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.LeiturasDaApi;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Carga;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.shared.integration.Conversoes;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Service;

/**
 * Saúde dos leitores faciais a partir das próprias leituras: última leitura, leituras na última hora e situação.
 * A API não informa falhas de leitura; esse indicador fica de fora até haver fonte.
 */
@Service
public class SaudeLeitoresService {

    private final LeiturasDaApi leiturasDaApi;
    private final JornadaService jornadas;
    private final EscopoService escopo;
    private final Duration limiteOffline;

    public SaudeLeitoresService(LeiturasDaApi leiturasDaApi, JornadaService jornadas, EscopoService escopo,
                                Propriedades propriedades) {
        this.leiturasDaApi = leiturasDaApi;
        this.jornadas = jornadas;
        this.escopo = escopo;
        this.limiteOffline = propriedades.limiteOffline();
    }

    public SaudeDosLeitores saude() {
        Carga carga = leiturasDaApi.carregar();
        LocalDateTime agora = jornadas.agora();
        LocalDateTime umaHoraAtras = agora.minusHours(1);

        Map<Long, LocalDateTime> ultima = new HashMap<>();
        Map<Long, Integer> naUltimaHora = new HashMap<>();
        for (Leitura leitura : carga.leituras()) {
            if (leitura.dataHora().isAfter(agora)) {
                continue;
            }
            ultima.merge(leitura.leitorId(), leitura.dataHora(), (a, b) -> a.isAfter(b) ? a : b);
            if (leitura.dataHora().isAfter(umaHoraAtras)) {
                naUltimaHora.merge(leitura.leitorId(), 1, Integer::sum);
            }
        }

        List<SaudeLeitor> leitores = new ArrayList<>();
        for (DispositivoFacialDto dispositivo : carga.dispositivos()) {
            Long id = Conversoes.paraLong(dispositivo.id());
            if (id == null) {
                continue;
            }
            Leitor classificado = carga.classificacao().leitores().get(id);
            LocalDateTime ultimaLeitura = ultima.get(id);
            leitores.add(new SaudeLeitor(id, dispositivo.descricao(),
                    classificado == null ? TipoUso.DESCONHECIDO : TipoUso.valueOf(classificado.tipo().name()),
                    dispositivo.tipoDeUsoDispositivoDescricao(),
                    Conversoes.paraLong(dispositivo.veiculoId()), dispositivo.veiculoPrefixo(),
                    Conversoes.paraLong(dispositivo.escolaId()),
                    ultimaLeitura, naUltimaHora.getOrDefault(id, 0), situacao(ultimaLeitura, agora)));
        }
        List<SaudeLeitor> noEscopo = escopo.filtrar(leitores, SaudeLeitor::escolaId, SaudeLeitor::veiculoId).stream()
                .sorted(Comparator.comparing(SaudeLeitor::escolaId, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(SaudeLeitor::veiculoId, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparingLong(SaudeLeitor::id))
                .toList();

        Map<Situacao, Long> porSituacao = new EnumMap<>(Situacao.class);
        for (Situacao s : Situacao.values()) {
            porSituacao.put(s, noEscopo.stream().filter(l -> l.situacao() == s).count());
        }
        return new SaudeDosLeitores(agora, limiteOffline.toMinutes(), porSituacao, noEscopo,
                carga.desatualizado(), carga.incompleto());
    }

    Situacao situacao(LocalDateTime ultimaLeitura, LocalDateTime agora) {
        if (ultimaLeitura == null) {
            return Situacao.SEM_LEITURA;
        }
        return Duration.between(ultimaLeitura, agora).compareTo(limiteOffline) <= 0 ? Situacao.ONLINE : Situacao.OFFLINE;
    }

    public enum TipoUso {
        EMBARQUE,
        CHEGADA,
        /** {@code tipo_de_uso_dispositivo_id} não mapeado na configuração. */
        DESCONHECIDO
    }

    public enum Situacao {
        /** Leu alguém dentro do limite configurado. */
        ONLINE,
        /** Já leu, mas não dentro do limite. Fora do horário de rota isso é esperado. */
        OFFLINE,
        /** Nenhuma leitura conhecida. */
        SEM_LEITURA
    }

    public record SaudeLeitor(long id, String descricao, TipoUso tipoUso, String tipoUsoDescricao, Long veiculoId,
                              String veiculoPrefixo, Long escolaId, LocalDateTime ultimaLeitura,
                              int leiturasUltimaHora, Situacao situacao) {
    }

    /** @param limiteOfflineMin sem leitura há mais que isso, o leitor é considerado offline */
    public record SaudeDosLeitores(LocalDateTime avaliadoEm, long limiteOfflineMin, Map<Situacao, Long> porSituacao,
                                   List<SaudeLeitor> leitores, boolean desatualizado, boolean incompleto) {

        public SaudeDosLeitores {
            leitores = List.copyOf(leitores);
        }
    }

    @ConfigurationProperties("rota-segura.dispositivos")
    public record Propriedades(Duration limiteOffline) {

        public Propriedades {
            if (limiteOffline == null || limiteOffline.isNegative() || limiteOffline.isZero()) {
                throw new IllegalArgumentException("rota-segura.dispositivos.limite-offline deve ser positivo");
            }
        }
    }
}
