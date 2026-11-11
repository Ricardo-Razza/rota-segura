package br.com.rotasegura.shared.erro;

/** A API externa falhou (5xx, timeout ou circuito aberto) e não havia valor em cache para devolver. */
public class ApiExternaIndisponivelException extends RuntimeException {

    private final String recurso;

    public ApiExternaIndisponivelException(String recurso, Throwable causa) {
        super("API externa indisponível para o recurso " + recurso, causa);
        this.recurso = recurso;
    }

    public String getRecurso() {
        return recurso;
    }
}
