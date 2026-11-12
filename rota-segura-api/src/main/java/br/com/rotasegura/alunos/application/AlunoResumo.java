package br.com.rotasegura.alunos.application;

/**
 * Aluno como o painel usa: matrícula do ano letivo, escola e veículo pelas leituras, situação da biometria.
 * Não carrega CPF, data de nascimento, endereço nem imagem.
 *
 * @param turma        descrição da turma na matrícula ({@code escola_turma_descricao_turma})
 * @param anoEscolar   série da turma ({@code escola_turma_turma_descricao})
 * @param escolaNome   nome da escola como vem na matrícula
 * @param escolaId     escola do último leitor por onde o aluno passou (a matrícula não traz o id)
 * @param veiculoId    veículo do último embarque registrado
 * @param biometria    cadastro facial no dispositivo; nulo quando o valor da API não é reconhecido
 */
public record AlunoResumo(
        long id,
        String nome,
        String iniciais,
        Long turmaId,
        String turma,
        String anoEscolar,
        String turno,
        Integer anoLetivo,
        String escolaNome,
        Long escolaId,
        Long veiculoId,
        Boolean biometria) {

    @Override
    public String toString() {
        return "AlunoResumo[id=" + id + "]";
    }
}
