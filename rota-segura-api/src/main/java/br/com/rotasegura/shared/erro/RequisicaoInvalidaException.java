package br.com.rotasegura.shared.erro;

/** Parâmetros da requisição fora do permitido (ex.: período longo demais). Vira 400. */
public class RequisicaoInvalidaException extends RuntimeException {

    public RequisicaoInvalidaException(String mensagem) {
        super(mensagem);
    }
}
