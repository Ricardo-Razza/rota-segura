package br.com.rotasegura;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class RotaSeguraApplication {

    public static void main(String[] args) {
        SpringApplication.run(RotaSeguraApplication.class, args);
    }
}
