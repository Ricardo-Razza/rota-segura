package br.com.rotasegura.alertas.application.regras;

import br.com.rotasegura.alertas.application.AlertasProperties.Janela;
import br.com.rotasegura.alertas.application.ContextoAvaliacao;
import br.com.rotasegura.alertas.application.RegraAlerta;
import br.com.rotasegura.alertas.domain.EntidadeAlerta;
import br.com.rotasegura.alertas.domain.Ocorrencia;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.dispositivos.application.SaudeLeitoresService.SaudeLeitor;
import br.com.rotasegura.dispositivos.application.SaudeLeitoresService.TipoUso;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusVeiculo;
import br.com.rotasegura.veiculos.domain.FaixaOcupacao;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** Regras sobre veículos e leitores. */
public final class RegrasDeOperacao {

    private RegrasDeOperacao() {
    }

    /**
     * Lotação: usa a mesma {@link FaixaOcupacao} do card do veículo, então veículo em atenção ou crítico
     * sempre tem alerta (e vice-versa).
     */
    @Component
    public static class Lotacao implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            List<Ocorrencia> resultado = new ArrayList<>();
            for (StatusVeiculo v : ctx.veiculos()) {
                if (v.faixaOcupacao() == null || v.faixaOcupacao() == FaixaOcupacao.OK) {
                    continue;
                }
                Severidade severidade = v.faixaOcupacao() == FaixaOcupacao.CRITICO ? Severidade.CRITICO
                        : Severidade.ATENCAO;
                String rotulo = ctx.rotuloVeiculo(v.id());
                String mensagem = "Veículo " + rotulo + " com " + v.embarcados() + " embarcados para "
                        + v.capacidade() + " lugares (" + v.ocupacao().stripTrailingZeros().toPlainString() + "%).";
                resultado.add(new Ocorrencia(TipoAlerta.LOTACAO, severidade, EntidadeAlerta.VEICULO,
                        String.valueOf(v.id()), rotulo, ctx.janelaDoDia(), mensagem, v.escolaId(), v.id()));
            }
            return resultado;
        }
    }

    /**
     * Leitor sem leitura em horário de rota, em dia letivo. O tempo conta a partir da última leitura ou do
     * início da janela de rota (o que for mais recente), para não alertar no primeiro minuto da rota.
     */
    @Component
    public static class LeitorSemLeitura implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            if (!ctx.diaLetivo() || ctx.janelaDeRota().isEmpty()) {
                return List.of();
            }
            Janela janela = ctx.janelaDeRota().get();
            LocalDateTime inicio = ctx.hoje().atTime(janela.inicio());
            List<Ocorrencia> resultado = new ArrayList<>();
            for (SaudeLeitor leitor : ctx.leitores()) {
                if (leitor.tipoUso() == TipoUso.DESCONHECIDO) {
                    continue;
                }
                LocalDateTime referencia = leitor.ultimaLeitura() != null && leitor.ultimaLeitura().isAfter(inicio)
                        ? leitor.ultimaLeitura() : inicio;
                Duration semLeitura = Duration.between(referencia, ctx.agora());
                if (semLeitura.compareTo(ctx.limiteOffline()) <= 0) {
                    continue;
                }
                String rotulo = "#" + leitor.id();
                String onde = leitor.veiculoId() != null ? " do veículo " + ctx.rotuloVeiculo(leitor.veiculoId())
                        : leitor.escolaId() != null ? " da escola #" + leitor.escolaId() : "";
                String mensagem = "Leitor " + rotulo + onde + " sem leitura há " + semLeitura.toMinutes()
                        + " min em horário de rota (" + janela.inicio() + "–" + janela.fim() + ").";
                resultado.add(new Ocorrencia(TipoAlerta.LEITOR_SEM_LEITURA, Severidade.ATENCAO, EntidadeAlerta.LEITOR,
                        String.valueOf(leitor.id()), rotulo, ctx.janelaDoDia(), mensagem, leitor.escolaId(),
                        leitor.veiculoId()));
            }
            return resultado;
        }
    }

    /** Leitor cujo tipo de uso não está mapeado em application.yml: as leituras dele são ignoradas. */
    @Component
    public static class LeitorTipoDesconhecido implements RegraAlerta {

        @Override
        public List<Ocorrencia> avaliar(ContextoAvaliacao ctx) {
            List<Ocorrencia> resultado = new ArrayList<>();
            for (DispositivoFacialDto d : ctx.dispositivos()) {
                Long id = Conversoes.paraLong(d.id());
                if (id == null || !ctx.leitoresComTipoDesconhecido().contains(id)) {
                    continue;
                }
                String tipo = d.tipoDeUsoDispositivoId() == null || d.tipoDeUsoDispositivoId().isBlank()
                        ? "vazio" : "\"" + d.tipoDeUsoDispositivoId().trim() + "\"";
                String rotulo = "#" + id;
                String mensagem = "Leitor " + rotulo + " tem tipo de uso " + tipo
                        + " sem mapeamento em rota-segura.jornada.tipos-leitor; as leituras dele estão sendo ignoradas.";
                resultado.add(new Ocorrencia(TipoAlerta.LEITOR_TIPO_DESCONHECIDO, Severidade.ATENCAO,
                        EntidadeAlerta.LEITOR, String.valueOf(id), rotulo, ctx.janelaDoDia(), mensagem,
                        Conversoes.paraLong(d.escolaId()), Conversoes.paraLong(d.veiculoId())));
            }
            return resultado;
        }
    }
}
