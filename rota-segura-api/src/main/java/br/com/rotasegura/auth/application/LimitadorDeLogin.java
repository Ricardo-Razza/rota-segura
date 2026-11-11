package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.application.AuthExceptions.MuitasTentativasException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Rate limit do login: conta falhas por chave (IP + login) numa janela de tempo.
 * Ao atingir o máximo, bloqueia novas tentativas até a janela vencer.
 */
@Component
public class LimitadorDeLogin {

    private final int maxTentativas;
    private final Cache<String, AtomicInteger> falhas;

    public LimitadorDeLogin(AuthProperties props) {
        this.maxTentativas = props.loginMaxTentativas();
        this.falhas = Caffeine.newBuilder()
                .expireAfterWrite(props.loginJanela())
                .maximumSize(100_000)
                .build();
    }

    /** @throws MuitasTentativasException se a chave está bloqueada */
    public void verificar(String chave) {
        AtomicInteger contador = falhas.getIfPresent(chave);
        if (contador != null && contador.get() >= maxTentativas) {
            throw new MuitasTentativasException();
        }
    }

    public void registrarFalha(String chave) {
        falhas.get(chave, k -> new AtomicInteger()).incrementAndGet();
    }

    public void registrarSucesso(String chave) {
        falhas.invalidate(chave);
    }

    public void limparTudo() {
        falhas.invalidateAll();
    }
}
