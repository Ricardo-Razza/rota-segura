package br.com.rotasegura.shared.erro;

/** O usuário autenticado não tem permissão ou o recurso está fora do seu escopo. */
public class AcessoNegadoException extends RuntimeException {

    public AcessoNegadoException(String mensagem) {
        super(mensagem);
    }
}
