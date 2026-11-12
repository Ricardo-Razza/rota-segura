package br.com.rotasegura.relatorios.domain;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * CSV em UTF-8 com BOM (abre direto no Excel em pt-BR), separador ";".
 * Células que começam com =, +, - ou @ ganham um apóstrofo para não virar fórmula (CSV injection).
 */
public final class EscritorCsv {

    private static final char SEPARADOR = ';';

    private EscritorCsv() {
    }

    public static void escrever(Tabela tabela, OutputStream saida) throws IOException {
        Writer escritor = new OutputStreamWriter(saida, StandardCharsets.UTF_8);
        escritor.write('﻿');
        linha(escritor, tabela.colunas());
        for (List<String> linha : tabela.linhas()) {
            linha(escritor, linha);
        }
        escritor.flush();
    }

    private static void linha(Writer escritor, List<String> celulas) throws IOException {
        for (int i = 0; i < celulas.size(); i++) {
            if (i > 0) {
                escritor.write(SEPARADOR);
            }
            escritor.write(celula(celulas.get(i)));
        }
        escritor.write("\r\n");
    }

    static String celula(String valor) {
        if (valor == null) {
            return "";
        }
        String texto = valor;
        if (!texto.isEmpty() && "=+-@".indexOf(texto.charAt(0)) >= 0 && !ehNumero(texto)) {
            texto = "'" + texto;
        }
        boolean aspas = texto.indexOf(SEPARADOR) >= 0 || texto.indexOf('"') >= 0 || texto.indexOf('\n') >= 0
                || texto.indexOf('\r') >= 0;
        return aspas ? "\"" + texto.replace("\"", "\"\"") + "\"" : texto;
    }

    private static boolean ehNumero(String texto) {
        return texto.matches("-?\\d+([.,]\\d+)?");
    }
}
