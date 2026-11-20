package br.com.rotasegura.veiculos.domain;

import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Caminho habitual de um veículo: todos os pontos dos trajetos dos últimos dias letivos, numa grade para achar
 * o ponto mais perto sem percorrer tudo. Imutável depois de criado.
 */
public final class CorredorDaRota {

    /** Lado da célula da grade em graus (~220 m de latitude). */
    static final double CELULA_GRAUS = 0.002;
    private static final double METROS_POR_GRAU = 111_320;

    private final Map<Long, List<PontoRastro>> grade = new HashMap<>();
    private final int dias;

    public CorredorDaRota(List<DiaDeRota> trajetos) {
        int comPontos = 0;
        for (DiaDeRota dia : trajetos) {
            if (!dia.pontos().isEmpty()) {
                comPontos++;
            }
            for (PontoRastro p : dia.pontos()) {
                grade.computeIfAbsent(chave(linha(p.latitude()), coluna(p.longitude())), c -> new ArrayList<>()).add(p);
            }
        }
        this.dias = comPontos;
    }

    /** Dias com trajeto guardado que formam o corredor. */
    public int dias() {
        return dias;
    }

    /**
     * Distância em metros até o ponto do corredor mais perto, procurando só até {@code limiteM};
     * vazio quando não há ponto nesse raio.
     */
    public Optional<Double> distanciaAte(double latitude, double longitude, double limiteM) {
        int linha = linha(latitude);
        int coluna = coluna(longitude);
        double celulaLatM = CELULA_GRAUS * METROS_POR_GRAU;
        double celulaLonM = Math.max(1, celulaLatM * Math.cos(Math.toRadians(latitude)));
        int dl = (int) Math.ceil(limiteM / celulaLatM);
        int dc = (int) Math.ceil(limiteM / celulaLonM);
        double menor = Double.MAX_VALUE;
        for (int i = linha - dl; i <= linha + dl; i++) {
            for (int j = coluna - dc; j <= coluna + dc; j++) {
                List<PontoRastro> celula = grade.get(chave(i, j));
                if (celula == null) {
                    continue;
                }
                for (PontoRastro p : celula) {
                    double d = Geo.distanciaMetros(latitude, longitude, p.latitude(), p.longitude());
                    if (d < menor) {
                        menor = d;
                    }
                }
            }
        }
        return menor <= limiteM ? Optional.of(menor) : Optional.empty();
    }

    public boolean dentro(double latitude, double longitude, double limiteM) {
        return distanciaAte(latitude, longitude, limiteM).isPresent();
    }

    /**
     * Desde quando o ônibus está fora do corredor: a hora do ponto mais antigo da sequência final do rastro de
     * hoje que fica a mais de {@code limiteM} do caminho habitual. Vazio se a posição atual está dentro.
     */
    public Optional<LocalDateTime> foraDesde(List<PontoRastro> rastroDeHoje, PosicaoVeiculo atual, double limiteM) {
        if (dentro(atual.latitude(), atual.longitude(), limiteM)) {
            return Optional.empty();
        }
        LocalDateTime desde = atual.registradaEm();
        for (int i = rastroDeHoje.size() - 1; i >= 0; i--) {
            PontoRastro p = rastroDeHoje.get(i);
            if (dentro(p.latitude(), p.longitude(), limiteM)) {
                break;
            }
            if (p.em().isBefore(desde)) {
                desde = p.em();
            }
        }
        return Optional.of(desde);
    }

    private static int linha(double latitude) {
        return (int) Math.floor(latitude / CELULA_GRAUS);
    }

    private static int coluna(double longitude) {
        return (int) Math.floor(longitude / CELULA_GRAUS);
    }

    private static long chave(int linha, int coluna) {
        return ((long) linha << 32) | (coluna & 0xFFFFFFFFL);
    }

    /** Trajeto guardado de um veículo num dia, em ordem de hora. */
    public record DiaDeRota(LocalDate data, List<PontoRastro> pontos) {

        public DiaDeRota {
            pontos = List.copyOf(pontos);
        }
    }
}
