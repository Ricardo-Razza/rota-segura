package br.com.rotasegura.shared.integration;

import java.net.http.HttpClient;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Configuration
public class ApiExternaConfig {

    @Bean
    Clock clock() {
        return Clock.systemDefaultZone();
    }

    @Bean
    RestClient apiExternaRestClient(RestClient.Builder builder, ApiExternaProperties props) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(props.connectTimeout())
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(props.readTimeout());

        builder.baseUrl(props.baseUrl())
                .requestFactory(factory)
                .requestInterceptor(new SomenteGetInterceptor())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        if (StringUtils.hasText(props.authorization())) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, props.authorization());
        }
        return builder.build();
    }
}
