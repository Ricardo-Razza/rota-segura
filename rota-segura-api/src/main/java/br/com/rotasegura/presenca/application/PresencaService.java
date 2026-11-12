package br.com.rotasegura.presenca.application;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.VisaoDoDiaService;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.VisaoDoDia;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.shared.application.Pagina;
import br.com.rotasegura.shared.application.Periodo;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Presença do dia e do período. Presente = passou no leitor da escola ({@code NA_ESCOLA}).
 * Frequência = presentes / esperados (alunos com matrícula no ano letivo, dentro dos filtros e do escopo).
 */
@Service
public class PresencaService {

    /** Período máximo da tendência de frequência. */
    public static final int MAXIMO_DIAS_PERIODO = 92;

    private final JornadaService jornadas;
    private final VisaoDoDiaService visao;
    private final CalendarioLetivo calendario;
    private final EscopoService escopo;

    public PresencaService(JornadaService jornadas, VisaoDoDiaService visao, CalendarioLetivo calendario,
                           EscopoService escopo) {
        this.jornadas = jornadas;
        this.visao = visao;
        this.calendario = calendario;
        this.escopo = escopo;
    }

    /** Presença de hoje com a lista de quem ainda não chegou (aguardando ou ausente), paginada. */
    public PresencaHoje hoje(FiltroAlunos filtro, Integer pagina, Integer tamanho) {
        Escopo atual = exigirFiltros(filtro);
        LocalDate hoje = jornadas.hoje();
        VisaoDoDia doDia = visao.montar(hoje, filtro, atual, jornadas.carregarBase());
        List<Linha> esperados = doDia.linhas().stream().filter(Linha::esperado).toList();

        List<Linha> semPresenca = esperados.stream()
                .filter(l -> l.jornada().estado() == EstadoJornada.AGUARDANDO
                        || l.jornada().estado() == EstadoJornada.AUSENTE)
                .toList();
        return new PresencaHoje(hoje, doDia.resumo().avaliadoEm(), calendario.ehLetivo(hoje),
                contar(esperados), Pagina.de(semPresenca, pagina, tamanho),
                doDia.resumo().desatualizado(), doDia.resumo().incompleto());
    }

    /** Frequência por dia letivo no período (dias futuros ficam de fora). */
    public PresencaPeriodo periodo(LocalDate inicio, LocalDate fim, FiltroAlunos filtro) {
        Escopo atual = exigirFiltros(filtro);
        LocalDate hoje = jornadas.hoje();
        Periodo periodo = Periodo.validar(inicio != null ? inicio : hoje.minusDays(6), fim != null ? fim : hoje,
                MAXIMO_DIAS_PERIODO);
        Base base = jornadas.carregarBase();

        List<FrequenciaDoDia> dias = periodo.dias().stream()
                .filter(calendario::ehLetivo)
                .filter(d -> !d.isAfter(hoje))
                .map(d -> {
                    List<Linha> esperados = visao.montar(d, filtro, atual, base).linhas().stream()
                            .filter(Linha::esperado).toList();
                    Contagem c = contar(esperados);
                    return new FrequenciaDoDia(d, c.esperados(), c.naEscola(), c.frequencia());
                })
                .toList();
        long esperados = dias.stream().mapToLong(FrequenciaDoDia::esperados).sum();
        long presentes = dias.stream().mapToLong(FrequenciaDoDia::presentes).sum();
        return new PresencaPeriodo(periodo.inicio(), periodo.fim(), dias, percentual(presentes, esperados),
                base.desatualizado(), base.incompleto());
    }

    private Escopo exigirFiltros(FiltroAlunos filtro) {
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        return escopo.atual();
    }

    static Contagem contar(List<Linha> esperados) {
        long naEscola = 0;
        long embarcados = 0;
        long aguardando = 0;
        long ausentes = 0;
        long divergentes = 0;
        for (Linha linha : esperados) {
            switch (linha.jornada().estado()) {
                case NA_ESCOLA -> naEscola++;
                case EMBARCADO -> embarcados++;
                case AGUARDANDO -> aguardando++;
                case AUSENTE -> ausentes++;
                case DIVERGENTE -> divergentes++;
            }
        }
        return new Contagem(esperados.size(), naEscola, embarcados, aguardando, ausentes, divergentes,
                percentual(naEscola, esperados.size()));
    }

    /** Percentual com uma casa; nulo quando não há esperados (o card mostra "vazio", não 0%). */
    static BigDecimal percentual(long parte, long total) {
        if (total == 0) {
            return null;
        }
        return BigDecimal.valueOf(parte * 100L).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    public record Contagem(long esperados, long naEscola, long embarcados, long aguardando, long ausentes,
                           long divergentes, BigDecimal frequencia) {
    }

    /**
     * @param diaLetivo   falso em fim de semana ou dia sem aula configurado
     * @param semPresenca esperados que ainda não passaram no leitor da escola
     */
    public record PresencaHoje(LocalDate data, LocalDateTime avaliadoEm, boolean diaLetivo, Contagem contagem,
                               Pagina<Linha> semPresenca, boolean desatualizado, boolean incompleto) {
    }

    public record FrequenciaDoDia(LocalDate data, long esperados, long presentes, BigDecimal frequencia) {
    }

    /** @param frequenciaMedia presentes somados / esperados somados no período */
    public record PresencaPeriodo(LocalDate inicio, LocalDate fim, List<FrequenciaDoDia> dias,
                                  BigDecimal frequenciaMedia, boolean desatualizado, boolean incompleto) {

        public PresencaPeriodo {
            dias = List.copyOf(dias);
        }
    }
}
