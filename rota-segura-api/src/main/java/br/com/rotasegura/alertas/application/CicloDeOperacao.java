package br.com.rotasegura.alertas.application;

import br.com.rotasegura.alertas.application.AlertasProperties.Janela;
import br.com.rotasegura.alertas.domain.Ocorrencia;
import br.com.rotasegura.dispositivos.application.SaudeLeitoresService;
import br.com.rotasegura.jornada.application.JornadaProperties;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.presenca.application.CalendarioLetivo;
import br.com.rotasegura.shared.application.CentralDeEventos;
import br.com.rotasegura.veiculos.application.StatusVeiculosService;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.Calculo;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusVeiculo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Ciclo de 30 s da operação: avalia as regras de alerta e publica no tempo real o que mudou
 * (jornadas, veículos, presença). Roda sem usuário, com escopo de sistema; a entrega por SSE aplica o escopo.
 */
@Service
public class CicloDeOperacao {

    public static final String EVENTO_JORNADA = "jornada.atualizada";
    public static final String EVENTO_VEICULO = "veiculo.atualizado";
    public static final String EVENTO_PRESENCA = "presenca.atualizada";

    private static final Logger LOG = LoggerFactory.getLogger(CicloDeOperacao.class);

    private final JornadaService jornadas;
    private final StatusVeiculosService veiculos;
    private final SaudeLeitoresService leitores;
    private final CalendarioLetivo calendario;
    private final JornadaProperties jornadaProperties;
    private final AlertasProperties propriedades;
    private final List<RegraAlerta> regras;
    private final AlertasService alertas;
    private final CentralDeEventos eventos;
    private final br.com.rotasegura.shared.application.MetricasOperacao metricas;

    private Map<Long, Linha> jornadasAnteriores = Map.of();
    private Map<Long, StatusVeiculo> veiculosAnteriores = Map.of();
    private LocalDate diaAnterior;

    public CicloDeOperacao(JornadaService jornadas, StatusVeiculosService veiculos, SaudeLeitoresService leitores,
                           CalendarioLetivo calendario, JornadaProperties jornadaProperties,
                           AlertasProperties propriedades, List<RegraAlerta> regras, AlertasService alertas,
                           CentralDeEventos eventos, br.com.rotasegura.shared.application.MetricasOperacao metricas) {
        this.metricas = metricas;
        this.jornadas = jornadas;
        this.veiculos = veiculos;
        this.leitores = leitores;
        this.calendario = calendario;
        this.jornadaProperties = jornadaProperties;
        this.propriedades = propriedades;
        this.regras = List.copyOf(regras);
        this.alertas = alertas;
        this.eventos = eventos;
    }

    @Scheduled(initialDelayString = "PT10S", fixedDelayString = "${rota-segura.alertas.intervalo:30s}")
    void agendado() {
        if (!propriedades.avaliacaoHabilitada()) {
            return;
        }
        try {
            executar();
        } catch (RuntimeException e) {
            // Só o tipo: a mensagem pode carregar dado da API.
            LOG.warn("Ciclo de operação falhou; tenta de novo no próximo. motivo={}", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada completa. Público para os testes chamarem sem esperar o agendamento. */
    public synchronized ResultadoCiclo executar() {
        Base base = jornadas.carregarBase();
        ContextoAvaliacao contexto = contexto(base);

        List<Ocorrencia> ocorrencias = new ArrayList<>();
        for (RegraAlerta regra : regras) {
            ocorrencias.addAll(regra.avaliar(contexto));
        }
        AlertasService.ResultadoAvaliacao avaliacao = alertas.aplicar(ocorrencias);
        metricas.leitoresOffline((int) contexto.leitores().stream()
                .filter(l -> l.situacao() == br.com.rotasegura.dispositivos.application.SaudeLeitoresService.Situacao.OFFLINE)
                .count());
        int mudancas = publicarMudancas(contexto);
        return new ResultadoCiclo(ocorrencias.size(), avaliacao.criados(), avaliacao.atualizados(), mudancas);
    }

    ContextoAvaliacao contexto(Base base) {
        LocalDateTime agora = jornadas.agora();
        Calculo calculo = veiculos.calcular(base);
        Optional<Janela> janela = propriedades.janelas().stream().filter(j -> j.contem(agora.toLocalTime())).findFirst();
        return new ContextoAvaliacao(agora, agora.toLocalDate(), calendario.ehLetivo(agora.toLocalDate()), janela,
                calculo.linhasHoje(), calculo.veiculos(), leitores.calcular(base.carga(), agora),
                leitores.limiteOffline(), jornadaProperties.janelaSemChegada(),
                base.carga().classificacao().tipoDesconhecido(), base.carga().dispositivos());
    }

    private int publicarMudancas(ContextoAvaliacao ctx) {
        int mudancas = 0;
        boolean virouDia = !ctx.hoje().equals(diaAnterior);
        Map<Long, Linha> atuais = new HashMap<>();
        for (Linha linha : ctx.linhasHoje()) {
            atuais.put(linha.aluno().id(), linha);
            Linha anterior = jornadasAnteriores.get(linha.aluno().id());
            if (!virouDia && (anterior == null || !Objects.equals(anterior.jornada(), linha.jornada()))) {
                eventos.publicar(EVENTO_JORNADA, linha, linha.aluno().escolaId(), linha.aluno().veiculoId(), true);
                mudancas++;
            }
        }
        Map<Long, StatusVeiculo> veiculosAtuais = new HashMap<>();
        for (StatusVeiculo v : ctx.veiculos()) {
            veiculosAtuais.put(v.id(), v);
            StatusVeiculo anterior = veiculosAnteriores.get(v.id());
            if (!virouDia && anterior != null && !mesmoEstado(anterior, v)) {
                eventos.publicar(EVENTO_VEICULO, v, v.escolaId(), v.id(), true);
                mudancas++;
            }
        }
        if (mudancas > 0 || virouDia) {
            // Sinal sem dado de aluno: cada tela recarrega a presença no próprio escopo.
            eventos.publicar(EVENTO_PRESENCA, Map.of("data", ctx.hoje().toString()), null, null, false);
        }
        jornadasAnteriores = Map.copyOf(atuais);
        veiculosAnteriores = Map.copyOf(veiculosAtuais);
        diaAnterior = ctx.hoje();
        return mudancas;
    }

    private static boolean mesmoEstado(StatusVeiculo a, StatusVeiculo b) {
        return a.estado() == b.estado() && a.embarcados() == b.embarcados() && a.aBordo() == b.aBordo()
                && a.chegaram() == b.chegaram() && Objects.equals(a.ultimaLeitura(), b.ultimaLeitura());
    }

    public record ResultadoCiclo(int ocorrencias, int alertasCriados, int alertasAtualizados, int eventosPublicados) {
    }
}
