package br.com.rotasegura.shared.application;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Tarefas em segundo plano (índice de responsáveis; na Fase 3, avaliação de alertas). */
@Configuration
@EnableScheduling
public class AgendamentoConfig {
}
