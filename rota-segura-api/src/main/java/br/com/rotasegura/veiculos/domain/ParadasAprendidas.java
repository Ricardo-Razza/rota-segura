package br.com.rotasegura.veiculos.domain;

import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Paradas reais de um veículo, aprendidas dos locais de embarque (posição do ônibus na hora de cada embarque).
 * <p>
 * Agrupamento guloso em ordem de hora: cada embarque entra no grupo cujo centro está a até {@code raioM}
 * (o mais perto), senão abre um grupo novo; o centro é a média dos pontos. Grupo com menos de
 * {@code minimoEmbarques} embarques não vira parada (um embarque isolado não é ponto de parada).
 * <p>
 * LGPD: a parada sai sem nenhum id de aluno, só a contagem.
 */
public final class ParadasAprendidas {

    /** Embarques a mais de isso um do outro (no horário do dia) caem em horários típicos diferentes. */
    static final Duration INTERVALO_ENTRE_TURNOS = Duration.ofMinutes(90);

    private ParadasAprendidas() {
    }

    public static List<Parada> agrupar(List<EmbarqueLocalizado> embarques, double raioM, int minimoEmbarques) {
        List<Grupo> grupos = new ArrayList<>();
        embarques.stream().sorted(Comparator.comparing(EmbarqueLocalizado::em)).forEach(e -> {
            Grupo maisPerto = null;
            double menor = Double.MAX_VALUE;
            for (Grupo g : grupos) {
                double d = Geo.distanciaMetros(g.latitude(), g.longitude(), e.latitude(), e.longitude());
                if (d <= raioM && d < menor) {
                    menor = d;
                    maisPerto = g;
                }
            }
            if (maisPerto == null) {
                maisPerto = new Grupo();
                grupos.add(maisPerto);
            }
            maisPerto.adicionar(e);
        });
        return grupos.stream()
                .filter(g -> g.horarios.size() >= minimoEmbarques)
                .map(Grupo::paraParada)
                .sorted(Comparator.comparing((Parada p) -> p.horariosTipicos().getFirst())
                        .thenComparing(Parada::embarques, Comparator.reverseOrder()))
                .toList();
    }

    /**
     * Desde quando o ônibus está parado no local atual: o ponto mais antigo da sequência final do rastro que
     * fica a até {@code raioM} da posição atual. O rastro só ganha ponto quando o ônibus anda, então parado
     * ele não muda e a última posição conta como o início da parada.
     */
    public static LocalDateTime paradoDesde(List<PontoRastro> rastro, PosicaoVeiculo atual, double raioM) {
        LocalDateTime desde = atual.registradaEm();
        for (int i = rastro.size() - 1; i >= 0; i--) {
            PontoRastro p = rastro.get(i);
            if (atual.distanciaAte(p.latitude(), p.longitude()) > raioM) {
                break;
            }
            if (p.em().isBefore(desde)) {
                desde = p.em();
            }
        }
        return desde;
    }

    /** Parada conhecida mais perto do ponto, com a distância em metros. */
    public static Optional<ParadaProxima> maisProxima(List<Parada> paradas, double latitude, double longitude) {
        return paradas.stream()
                .map(p -> new ParadaProxima(p, Geo.distanciaMetros(p.latitude(), p.longitude(), latitude, longitude)))
                .min(Comparator.comparingDouble(ParadaProxima::distanciaM));
    }

    /** Horários típicos: os embarques do grupo separados por turno, com a mediana de cada um. */
    static List<LocalTime> horariosTipicos(List<LocalTime> horarios) {
        List<LocalTime> ordenados = horarios.stream().sorted().toList();
        List<LocalTime> tipicos = new ArrayList<>();
        List<LocalTime> turno = new ArrayList<>();
        for (LocalTime h : ordenados) {
            if (!turno.isEmpty() && Duration.between(turno.getLast(), h).compareTo(INTERVALO_ENTRE_TURNOS) > 0) {
                tipicos.add(mediana(turno));
                turno.clear();
            }
            turno.add(h);
        }
        if (!turno.isEmpty()) {
            tipicos.add(mediana(turno));
        }
        return List.copyOf(tipicos);
    }

    static LocalTime mediana(List<LocalTime> ordenados) {
        int meio = ordenados.size() / 2;
        if (ordenados.size() % 2 == 1) {
            return ordenados.get(meio);
        }
        long a = ordenados.get(meio - 1).toSecondOfDay();
        long b = ordenados.get(meio).toSecondOfDay();
        return LocalTime.ofSecondOfDay((a + b) / 2);
    }

    /** Embarque com o local do ônibus naquela hora (o id do aluno só serve para contar alunos distintos). */
    public record EmbarqueLocalizado(double latitude, double longitude, LocalDateTime em, long alunoId) {
    }

    /**
     * @param embarques       embarques no período analisado
     * @param alunos          alunos distintos que embarcaram ali
     * @param dias            dias diferentes com embarque ali
     * @param horariosTipicos mediana do horário de embarque em cada turno, em ordem
     */
    public record Parada(double latitude, double longitude, int embarques, int alunos, int dias,
                         List<LocalTime> horariosTipicos) {

        public Parada {
            horariosTipicos = List.copyOf(horariosTipicos);
        }
    }

    public record ParadaProxima(Parada parada, double distanciaM) {
    }

    private static final class Grupo {
        double somaLat;
        double somaLon;
        final List<LocalTime> horarios = new ArrayList<>();
        final Set<Long> alunos = new HashSet<>();
        final Set<java.time.LocalDate> dias = new HashSet<>();

        double latitude() {
            return somaLat / horarios.size();
        }

        double longitude() {
            return somaLon / horarios.size();
        }

        void adicionar(EmbarqueLocalizado e) {
            somaLat += e.latitude();
            somaLon += e.longitude();
            horarios.add(e.em().toLocalTime());
            alunos.add(e.alunoId());
            dias.add(e.em().toLocalDate());
        }

        Parada paraParada() {
            return new Parada(arredondar(latitude()), arredondar(longitude()), horarios.size(), alunos.size(),
                    dias.size(), horariosTipicos(horarios));
        }

        /** 5 casas (~1 m): o suficiente para o mapa. */
        private static double arredondar(double v) {
            return Math.round(v * 100_000) / 100_000.0;
        }
    }
}
