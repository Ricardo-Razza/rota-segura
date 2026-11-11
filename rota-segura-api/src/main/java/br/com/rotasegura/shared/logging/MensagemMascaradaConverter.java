package br.com.rotasegura.shared.logging;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

/** Conversor do Logback ({@code %msgLgpd}) que aplica a máscara LGPD à mensagem formatada. */
public class MensagemMascaradaConverter extends MessageConverter {

    @Override
    public String convert(ILoggingEvent event) {
        return MascaraLgpd.mascarar(super.convert(event));
    }
}
