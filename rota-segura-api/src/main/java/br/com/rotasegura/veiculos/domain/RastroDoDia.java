package br.com.rotasegura.veiculos.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

/**
 * Posição atual, rastro do dia e cerca virtual de um veículo. Não é thread-safe: quem usa sincroniza.
 *
 * <p>Regras:
 * <ul>
 *   <li>O rastro só guarda pontos do próprio dia e só quando o veículo andou pelo menos
 *       {@code distanciaMinimaM} desde o último ponto (parado no semáforo não enche a memória).</li>
 *   <li>Na virada do dia o rastro e a cerca recomeçam.</li>
 *   <li>"Na cerca desde" é a hora do GPS do primeiro ponto dentro do raio da escola; sair do raio zera.</li>
 *   <li>Posição de outro dia (rastreador parado ou sem sinal) aparece como posição atual, mas não entra no
 *       rastro nem na cerca.</li>
 * </ul>
 */
public final class RastroDoDia {

    private final int maxPontos;
    private final double distanciaMinimaM;
    private final Deque<PontoRastro> pontos = new ArrayDeque<>();
    private LocalDate dia;
    private PosicaoVeiculo atual;
    private LocalDateTime naCercaDesde;

    public RastroDoDia(int maxPontos, double distanciaMinimaM) {
        if (maxPontos < 2) {
            throw new IllegalArgumentException("maxPontos deve ser ao menos 2");
        }
        this.maxPontos = maxPontos;
        this.distanciaMinimaM = distanciaMinimaM;
    }

    /**
     * Registra uma posição lida do rastreador.
     *
     * @param cerca escola de destino do veículo; nula quando desconhecida
     */
    public Mudanca registrar(PosicaoVeiculo posicao, LocalDate hoje, Cerca cerca) {
        if (!hoje.equals(dia)) {
            dia = hoje;
            pontos.clear();
            naCercaDesde = null;
        }
        if (posicao.mesmaLeituraQue(atual)) {
            return Mudanca.NENHUMA;
        }
        atual = posicao;
        boolean doDia = posicao.registradaEm().toLocalDate().equals(hoje);
        boolean novoPonto = false;
        if (doDia) {
            PontoRastro ultimo = pontos.peekLast();
            if (ultimo == null || posicao.distanciaAte(ultimo.latitude(), ultimo.longitude()) >= distanciaMinimaM) {
                pontos.addLast(new PontoRastro(posicao.latitude(), posicao.longitude(), posicao.registradaEm()));
                novoPonto = true;
                while (pontos.size() > maxPontos) {
                    pontos.removeFirst();
                }
            }
        }
        if (!doDia || cerca == null) {
            naCercaDesde = null;
        } else if (cerca.contem(posicao)) {
            if (naCercaDesde == null) {
                naCercaDesde = posicao.registradaEm();
            }
        } else {
            naCercaDesde = null;
        }
        return novoPonto ? Mudanca.NOVO_PONTO : Mudanca.POSICAO;
    }

    /**
     * Recupera o trajeto do dia guardado no banco (ex.: depois de reiniciar o backend). Só vale para um
     * rastro ainda vazio; a posição atual e a cerca voltam com a próxima leitura do rastreador.
     */
    public void restaurar(List<PontoRastro> salvos, LocalDate hoje) {
        if (dia != null || !pontos.isEmpty()) {
            return;
        }
        dia = hoje;
        List<PontoRastro> deHoje = salvos.stream().filter(p -> p.em().toLocalDate().equals(hoje)).toList();
        deHoje.stream().skip(Math.max(0, deHoje.size() - maxPontos)).forEach(pontos::addLast);
    }

    public PosicaoVeiculo atual() {
        return atual;
    }

    public LocalDateTime naCercaDesde() {
        return naCercaDesde;
    }

    public List<PontoRastro> pontos() {
        return List.copyOf(pontos);
    }

    /** O que mudou com a posição registrada. */
    public enum Mudanca {
        /** Mesma leitura de antes. */
        NENHUMA,
        /** Posição nova, mas perto demais do último ponto (ou de outro dia) para entrar no rastro. */
        POSICAO,
        /** Posição nova que também entrou no rastro. */
        NOVO_PONTO
    }

    /** Ponto do rastro. */
    public record PontoRastro(double latitude, double longitude, LocalDateTime em) {
    }

    /** Raio em volta da escola de destino do veículo. */
    public record Cerca(long escolaId, double latitude, double longitude, double raioM) {

        public boolean contem(PosicaoVeiculo posicao) {
            return distanciaAte(posicao) <= raioM;
        }

        public double distanciaAte(PosicaoVeiculo posicao) {
            return posicao.distanciaAte(latitude, longitude);
        }
    }
}
