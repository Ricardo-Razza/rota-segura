package br.com.rotasegura;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.responsaveis.integration.ResponsavelDto;
import br.com.rotasegura.shared.integration.Meta;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/** Desserialização dos DTOs com dados fictícios e proteção contra vazamento em log. */
class DtosTest {

    private final ObjectMapper json = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Test
    void presencaDaListaNaoTemCamposDoDetalhe() throws Exception {
        PresencaDto leitura = json.readValue("""
                {"id":"10","aluno_id":"42","data_hora":"2026-11-10 06:45:12","veiculo_id":"1",
                 "dispositivo_facial_id":"1","caminho_imagem":""}""", PresencaDto.class);

        assertThat(leitura.alunoId()).isEqualTo("42");
        assertThat(leitura.dispositivoFacialId()).isEqualTo("1");
        assertThat(leitura.dataHora()).isEqualTo("2026-11-10 06:45:12");
        assertThat(leitura.latitude()).isNull();
        assertThat(leitura.statusNotificacaoDescricao()).isNull();
    }

    @Test
    void metaAceitaNumeroComoTexto() throws Exception {
        Meta meta = json.readValue("""
                {"total":2,"per_page":100,"current_page":"2","last_page":1}""", Meta.class);

        assertThat(meta.currentPage()).isEqualTo(2);
        assertThat(meta.perPage()).isEqualTo(100);
        assertThat(meta.lastPage()).isEqualTo(1);
    }

    @Test
    void toStringDeAlunoEResponsavelMostraSoOId() throws Exception {
        AlunoDto aluno = json.readValue("""
                {"id":"42","nome":"Aluno Ficticio","cpf":"000.000.000-00","data_nascimento":"2015-03-10"}""",
                AlunoDto.class);
        ResponsavelDto responsavel = json.readValue("""
                {"id":"7","nome":"Responsavel Ficticio","details":[{"id":"42","nome":"Aluno Ficticio"}]}""",
                ResponsavelDto.class);

        assertThat(aluno.matriculas()).isEmpty();
        assertThat(aluno.toString()).isEqualTo("AlunoDto[id=42]");
        assertThat(responsavel.toString()).isEqualTo("ResponsavelDto[id=7]");
        assertThat(responsavel.details().get(0).toString()).isEqualTo("ResponsavelAlunoDto[id=42]");
    }
}
