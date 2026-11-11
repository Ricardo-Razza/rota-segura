package br.com.rotasegura.shared.erro;

/** O registro pedido não existe. A mensagem carrega só o tipo do recurso e o id, nunca dado pessoal. */
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String recurso, long id) {
        super("Recurso " + recurso + " com id " + id + " não encontrado");
    }
}
