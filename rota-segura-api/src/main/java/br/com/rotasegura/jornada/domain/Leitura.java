package br.com.rotasegura.jornada.domain;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Reconhecimento facial de um aluno num leitor, já convertido do registro de {@code presenca_escolar}.
 * Não guarda imagem nem dado pessoal: só ids e horário.
 *
 * @param id        id da leitura na API externa (pode faltar)
 * @param dataHora  horário local da escola
 * @param veiculoId veículo informado na própria leitura (pode faltar)
 */
public record Leitura(Long id, long alunoId, LocalDateTime dataHora, long leitorId, Long veiculoId) {

    public Leitura {
        Objects.requireNonNull(dataHora, "dataHora");
    }
}
