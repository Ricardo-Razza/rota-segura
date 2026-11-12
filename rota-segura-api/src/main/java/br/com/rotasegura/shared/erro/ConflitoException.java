package br.com.rotasegura.shared.erro;

/** A operação conflita com o estado atual (ex.: sincronização já em andamento). Vira 409. */
public class ConflitoException extends RuntimeException {

    public ConflitoException(String mensagem) {
        super(mensagem);
    }
}
