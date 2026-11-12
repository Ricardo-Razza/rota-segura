package br.com.rotasegura.relatorios.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class EscritorCsvTest {

    @Test
    void escreveComBomSeparadorPontoEVirgulaECrlf() throws Exception {
        Tabela tabela = new Tabela("T", "P", List.of("ID", "Nome"), List.of(List.of("1", "Aluno Fictício")));
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        EscritorCsv.escrever(tabela, saida);
        byte[] bytes = saida.toByteArray();

        assertThat(bytes[0]).isEqualTo((byte) 0xEF);
        assertThat(bytes[1]).isEqualTo((byte) 0xBB);
        assertThat(bytes[2]).isEqualTo((byte) 0xBF);
        assertThat(new String(bytes, StandardCharsets.UTF_8)).isEqualTo("﻿ID;Nome\r\n1;Aluno Fictício\r\n");
    }

    @Test
    void neutralizaFormulasMasPreservaNumerosNegativos() {
        assertThat(EscritorCsv.celula("=HYPERLINK(\"x\")")).isEqualTo("\"'=HYPERLINK(\"\"x\"\")\"");
        assertThat(EscritorCsv.celula("+1+2")).isEqualTo("'+1+2");
        assertThat(EscritorCsv.celula("@SOMA")).isEqualTo("'@SOMA");
        assertThat(EscritorCsv.celula("-12.5")).isEqualTo("-12.5");
    }

    @Test
    void colocaAspasQuandoHaSeparadorOuQuebra() {
        assertThat(EscritorCsv.celula("a;b")).isEqualTo("\"a;b\"");
        assertThat(EscritorCsv.celula("linha\nnova")).isEqualTo("\"linha\nnova\"");
        assertThat(EscritorCsv.celula(null)).isEmpty();
    }
}
