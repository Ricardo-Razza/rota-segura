package br.com.rotasegura.alertas.application;

import br.com.rotasegura.alertas.application.AlertasProperties.Janela;
import br.com.rotasegura.dispositivos.application.SaudeLeitoresService.SaudeLeitor;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.application.VisaoDoDiaService.Linha;
import br.com.rotasegura.veiculos.application.StatusVeiculosService.StatusVeiculo;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Tudo que as regras precisam numa avaliação, já calculado uma vez e sem escopo.
 *
 * @param janelaDeRota janela de rota em que {@code agora} está, se houver
 */
public record ContextoAvaliacao(LocalDateTime agora, LocalDate hoje, boolean diaLetivo, Optional<Janela> janelaDeRota,
                                List<Linha> linhasHoje, List<StatusVeiculo> veiculos, List<SaudeLeitor> leitores,
                                Duration limiteOffline, Duration janelaSemChegada,
                                Set<Long> leitoresComTipoDesconhecido, List<DispositivoFacialDto> dispositivos) {

    static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    public ContextoAvaliacao {
        linhasHoje = List.copyOf(linhasHoje);
        veiculos = List.copyOf(veiculos);
        leitores = List.copyOf(leitores);
        leitoresComTipoDesconhecido = Set.copyOf(leitoresComTipoDesconhecido);
        dispositivos = List.copyOf(dispositivos);
    }

    public Map<Long, StatusVeiculo> veiculoPorId() {
        Map<Long, StatusVeiculo> mapa = new HashMap<>();
        veiculos.forEach(v -> mapa.put(v.id(), v));
        return mapa;
    }

    /** Janela de deduplicação diária. */
    public String janelaDoDia() {
        return hoje.toString();
    }

    /** Como o veículo aparece na etiqueta e no texto do alerta: placa, senão prefixo, senão "#id". */
    public String rotuloVeiculo(Long veiculoId) {
        if (veiculoId == null) {
            return "não identificado";
        }
        StatusVeiculo v = veiculoPorId().get(veiculoId);
        if (v != null && v.placa() != null && !v.placa().isBlank()) {
            return v.placa();
        }
        if (v != null && v.prefixo() != null && !v.prefixo().isBlank()) {
            return v.prefixo();
        }
        return "#" + veiculoId;
    }

    /** Aluno no alerta: só iniciais e id (nunca o nome). */
    public static String rotuloAluno(String iniciais, long alunoId) {
        return (iniciais == null || iniciais.isBlank() ? "?" : iniciais) + " #" + alunoId;
    }

    public static String hora(LocalDateTime dataHora) {
        return dataHora == null ? "--:--" : HORA.format(dataHora);
    }
}
