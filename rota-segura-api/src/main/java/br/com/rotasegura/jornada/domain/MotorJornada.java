package br.com.rotasegura.jornada.domain;

import br.com.rotasegura.jornada.domain.JornadaDoDia.LeiturasIgnoradas;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Monta a jornada de um aluno num dia a partir das leituras, sem acessar nada externo.
 * O tempo entra como parâmetro ({@code agora}), o que deixa o motor determinístico e testável.
 */
public final class MotorJornada {

    private static final Comparator<Leitura> ORDEM_CRONOLOGICA = Comparator
            .comparing(Leitura::dataHora)
            .thenComparing(l -> l.id() == null ? Long.MAX_VALUE : l.id());

    private final RegrasJornada regras;

    public MotorJornada(RegrasJornada regras) {
        this.regras = Objects.requireNonNull(regras, "regras");
    }

    /**
     * @param leituras       leituras do aluno no dia; todas precisam ter o leitor em {@code leitores}
     * @param leitores       leitores classificados, por id
     * @param agora          momento da avaliação (horário local da escola)
     * @param limiteAusencia sem nenhuma leitura até este horário, o aluno fica {@code AUSENTE}
     */
    public JornadaDoDia montar(long alunoId, LocalDate data, List<Leitura> leituras, Map<Long, Leitor> leitores,
                               LocalDateTime agora, LocalDateTime limiteAusencia) {
        Avaliacao avaliacao = new Avaliacao(alunoId, data, limiteAusencia);
        leituras.stream().sorted(ORDEM_CRONOLOGICA).forEach(leitura -> {
            Leitor leitor = leitores.get(leitura.leitorId());
            if (leitor == null) {
                throw new IllegalArgumentException("leitura com leitor não classificado: " + leitura.leitorId());
            }
            avaliacao.processar(leitura, leitor);
        });
        LocalDateTime fimDoDia = data.plusDays(1).atStartOfDay();
        avaliacao.avancarRelogio(agora.isBefore(fimDoDia) ? agora : fimDoDia);
        return avaliacao.resultado();
    }

    /** Estado mutável de uma única montagem. */
    private final class Avaliacao {

        private final long alunoId;
        private final LocalDate data;
        private final LocalDateTime limiteAusencia;
        private final Map<Long, LocalDateTime> ultimaLeituraPorLeitor = new HashMap<>();
        private final List<Divergencia> divergencias = new ArrayList<>();
        private final List<Passo> passos = new ArrayList<>();

        private EstadoJornada estado = EstadoJornada.AGUARDANDO;
        private LocalDateTime embarqueEm;
        private Long veiculoId;
        private LocalDateTime chegadaEm;
        private Long escolaId;
        private int duplicadas;
        private int foraDeOrdem;

        Avaliacao(long alunoId, LocalDate data, LocalDateTime limiteAusencia) {
            this.alunoId = alunoId;
            this.data = data;
            this.limiteAusencia = limiteAusencia;
        }

        void processar(Leitura leitura, Leitor leitor) {
            if (ehDuplicada(leitura)) {
                duplicadas++;
                return;
            }
            avancarRelogio(leitura.dataHora());
            switch (leitor.tipo()) {
                case EMBARQUE -> embarcar(leitura, leitor);
                case CHEGADA -> chegar(leitura, leitor);
            }
        }

        /** Mesmo aluno no mesmo leitor a menos do intervalo configurado da leitura anterior nele. */
        private boolean ehDuplicada(Leitura leitura) {
            LocalDateTime anterior = ultimaLeituraPorLeitor.put(leitura.leitorId(), leitura.dataHora());
            return anterior != null
                    && Duration.between(anterior, leitura.dataHora()).compareTo(regras.intervaloDuplicidade()) < 0;
        }

        /** Aplica as transições que dependem só da passagem do tempo. */
        void avancarRelogio(LocalDateTime momento) {
            if (estado == EstadoJornada.EMBARCADO) {
                LocalDateTime prazo = embarqueEm.plus(regras.janelaSemChegada());
                if (momento.isAfter(prazo)) {
                    ir(EstadoJornada.DIVERGENTE);
                    divergencias.add(new Divergencia(TipoDivergencia.EMBARCOU_SEM_CHEGADA, prazo));
                }
            } else if (estado == EstadoJornada.AGUARDANDO && momento.isAfter(limiteAusencia)) {
                ir(EstadoJornada.AUSENTE);
            }
        }

        private void embarcar(Leitura leitura, Leitor leitor) {
            switch (estado) {
                case AGUARDANDO, AUSENTE -> {
                    ir(EstadoJornada.EMBARCADO);
                    embarqueEm = leitura.dataHora();
                    veiculoId = leitura.veiculoId() != null ? leitura.veiculoId() : leitor.veiculoId();
                    // Até a chegada, a escola é a ligada ao leitor do ônibus (escola_id vindo da API).
                    escolaId = leitor.escolaId();
                    registrarPasso(leitura, leitor);
                }
                case EMBARCADO, DIVERGENTE -> {
                    ir(estado);
                    if (divergencias.stream().noneMatch(d -> d.tipo() == TipoDivergencia.EMBARQUE_DUPLICADO)) {
                        divergencias.add(new Divergencia(TipoDivergencia.EMBARQUE_DUPLICADO, leitura.dataHora()));
                    }
                    registrarPasso(leitura, leitor);
                }
                case NA_ESCOLA -> foraDeOrdem++;
            }
        }

        private void chegar(Leitura leitura, Leitor leitor) {
            switch (estado) {
                case AGUARDANDO, AUSENTE -> {
                    divergencias.add(new Divergencia(TipoDivergencia.CHEGOU_SEM_EMBARQUE, leitura.dataHora()));
                    confirmarChegada(leitura, leitor);
                }
                case EMBARCADO, DIVERGENTE -> confirmarChegada(leitura, leitor);
                case NA_ESCOLA -> foraDeOrdem++;
            }
        }

        private void confirmarChegada(Leitura leitura, Leitor leitor) {
            ir(EstadoJornada.NA_ESCOLA);
            chegadaEm = leitura.dataHora();
            if (leitor.escolaId() != null) {
                escolaId = leitor.escolaId();
            }
            registrarPasso(leitura, leitor);
        }

        private void ir(EstadoJornada destino) {
            if (!estado.podeIrPara(destino)) {
                throw new IllegalStateException("transição inválida: " + estado + " → " + destino);
            }
            estado = destino;
        }

        private void registrarPasso(Leitura leitura, Leitor leitor) {
            Long veiculoDoPasso = leitura.veiculoId() != null ? leitura.veiculoId() : leitor.veiculoId();
            passos.add(new Passo(leitura.dataHora(), leitor.tipo(), leitor.id(), veiculoDoPasso, leitor.escolaId(), estado));
        }

        JornadaDoDia resultado() {
            Long trajeto = embarqueEm != null && chegadaEm != null
                    ? Duration.between(embarqueEm, chegadaEm).toMinutes()
                    : null;
            return new JornadaDoDia(alunoId, data, estado, embarqueEm, veiculoId, chegadaEm, escolaId, trajeto,
                    divergencias, passos, new LeiturasIgnoradas(duplicadas, foraDeOrdem));
        }
    }
}
