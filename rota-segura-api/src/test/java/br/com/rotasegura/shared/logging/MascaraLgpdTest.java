package br.com.rotasegura.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Todos os valores abaixo são fictícios. */
class MascaraLgpdTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "cpf 000.000.000-00 informado | cpf [CPF] informado",
            "cpf=00000000000 | cpf=[CPF]",
            "contato ficticio@exemplo.com.br ok | contato [EMAIL] ok",
            "tel (00) 90000-0000 | tel [TELEFONE]",
            "tel 00 0000-0000 | tel [TELEFONE]",
            "tel +55 00 90000 0000 | tel [TELEFONE]",
            "tel 00900000000x | tel [CPF]x",
    })
    void removeDadosPessoais(String entrada, String esperado) {
        assertThat(MascaraLgpd.mascarar(entrada)).isEqualTo(esperado);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "alunoId=42 veiculoId=7",
            "obtido em 2026-11-11T10:20:30.123-03:00",
            "recurso=presenca pagina=3 total=1500",
            "epoch 1794400000000",
    })
    void preservaIdsDatasEContadores(String entrada) {
        assertThat(MascaraLgpd.mascarar(entrada)).isEqualTo(entrada);
    }

    @Test
    void aceitaNuloEVazio() {
        assertThat(MascaraLgpd.mascarar(null)).isNull();
        assertThat(MascaraLgpd.mascarar("")).isEmpty();
    }

    @Test
    void conversorDoLogbackMascaraAMensagemJaFormatada() {
        Logger logger = new LoggerContext().getLogger("teste");
        var evento = new LoggingEvent("fqcn", logger, Level.INFO,
                "contato {} cpf {}", null, new Object[] {"ficticio@exemplo.com", "000.000.000-00"});

        assertThat(new MensagemMascaradaConverter().convert(evento)).isEqualTo("contato [EMAIL] cpf [CPF]");
    }
}
