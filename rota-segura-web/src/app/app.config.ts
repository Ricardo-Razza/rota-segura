import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { erroInterceptor } from './core/auth/erro.interceptor';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // O de erro fica por fora: só vê a falha depois que o de autenticação tentou renovar a sessão.
    provideHttpClient(withInterceptors([erroInterceptor, authInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    // ECharts carregado sob demanda: não pesa no login nem nas telas sem gráfico.
    provideEchartsCore({ echarts: () => import('echarts') }),
  ],
};
