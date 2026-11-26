package br.com.rotasegura.veiculos.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Capacidade lida de {@code /api/veiculos/{id}/dados}, em qualquer formato que o ERP mande (valores fictícios). */
class DadosVeiculoDtoTest {

    private final ObjectMapper json = new ObjectMapper();

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource(delimiter = '|', value = {
            "{\"veiculo\":{\"capacidade\":44},\"kpi\":{\"capacidadeMaxima\":40}}   | 44",
            "{\"veiculo\":{\"capacidade\":\"44\"}}                                 | 44",
            "{\"veiculo\":{\"capacidade\":null},\"kpi\":{\"capacidadeMaxima\":40}} | 40",
            "{\"veiculo\":{\"capacidade\":0},\"kpi\":{\"capacidadeMaxima\":\"30\"}} | 30",
            "{\"veiculo\":{\"capacidade\":\"\"},\"kpi\":{\"capacidadeMaxima\":null}} | 0",
            "{\"kpi\":{\"capacidadeMaxima\":-5}}                                   | 0",
            "{\"veiculo\":{\"capacidade\":\"abc\"}}                                | 0",
            "{\"localizacao\":{\"latitude\":-10.0}}                                | 0"})
    void capacidadeVemDoCadastroDepoisDoKpiSenaoZero(String corpo, int esperada) throws Exception {
        DadosVeiculoDto dados = json.readValue(corpo.trim(), DadosVeiculoDto.class);
        assertThat(dados.capacidadeInformada()).isEqualTo(esperada);
    }
}
