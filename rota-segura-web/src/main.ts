import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { aplicarModoLeve } from './app/core/desempenho/modo-leve';

// Antes do primeiro desenho, para a tela já nascer sem o desfoque em máquina modesta.
aplicarModoLeve();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
