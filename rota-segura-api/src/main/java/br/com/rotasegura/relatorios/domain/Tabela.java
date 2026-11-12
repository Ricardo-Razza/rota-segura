package br.com.rotasegura.relatorios.domain;

import java.util.List;

/** Relatório em forma de tabela, pronto para prévia, CSV ou PDF. */
public record Tabela(String titulo, String periodo, List<String> colunas, List<List<String>> linhas) {

    public Tabela {
        colunas = List.copyOf(colunas);
        linhas = linhas.stream().map(List::copyOf).toList();
    }

    public Tabela primeiras(int quantidade) {
        return new Tabela(titulo, periodo, colunas, linhas.subList(0, Math.min(quantidade, linhas.size())));
    }
}
