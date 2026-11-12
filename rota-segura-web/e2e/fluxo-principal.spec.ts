import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { simularApi } from './api-simulada';

/**
 * Fluxo principal do painel com backend simulado e dados fictícios:
 * login → dashboard → jornada → abrir aluno → resolver alerta → exportar CSV.
 */
test('login, jornada, perfil do aluno, alerta resolvido e CSV exportado', async ({ page }) => {
  const api = await simularApi(page);
  const menu = page.getByRole('navigation');

  // Login
  await page.goto('/login');
  await page.getByLabel('Login').fill('gestora.ficticia');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.getByRole('button', { name: /entrar/i }).click();

  // Dashboard
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '3º ano' })).toBeVisible();

  // Jornada: o aluno embarcado aparece no card e abre o painel lateral
  await menu.getByRole('link', { name: 'Jornada' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Jornada do aluno' })).toBeVisible();
  await page.locator('button.cartao[data-aluno="101"]').click();
  const painel = page.getByRole('dialog', { name: 'Ana Exemplo' });
  await expect(painel).toBeVisible();
  await expect(painel.getByText('leitor #501')).toBeVisible();

  // Perfil do aluno
  await painel.getByRole('link', { name: 'Abrir perfil do aluno' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ana Exemplo' })).toBeVisible();
  expect(page.url()).not.toContain('Ana');

  // Alertas: resolver exige comentário
  await menu.getByRole('link', { name: /Alertas/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Alertas' })).toBeVisible();
  await page.getByRole('button', { name: 'Resolver' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Resolver alerta' });
  await expect(dialogo).toBeVisible();
  await dialogo
    .getByRole('textbox')
    .fill('Responsável confirmou que o aluno desceu antes da escola.');
  await dialogo.getByRole('button', { name: 'Resolver' }).click();
  await expect(page.getByText('Alerta resolvido.')).toBeVisible();
  expect(api.chamadas).toContain('PATCH /alertas/900');

  // Relatórios: "7 dias" já vem selecionado, a exportação não fica bloqueada
  await menu.getByRole('link', { name: 'Relatórios' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeVisible();
  await expect(page.getByText('Ana Exemplo')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(
    /^frequencia_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const conteudo = await readFile((await arquivo.path())!, 'utf8');
  expect(conteudo.charCodeAt(0)).toBe(0xfeff);
  expect(conteudo).toContain('ID;Aluno');
});
