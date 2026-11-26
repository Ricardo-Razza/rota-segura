import { expect, Locator, Page, test } from '@playwright/test';
import { simularApi } from './api-simulada';

/**
 * Sobreposição: o menu da conta e a barra do topo ficam sempre acima dos painéis de vidro do
 * mapa (que têm z-index alto para ficar acima do Leaflet). Backend simulado e dados fictícios.
 */

async function entrar(page: Page): Promise<void> {
  await simularApi(page);
  await page.goto('/login');
  await page.getByLabel('Login').fill('gestora.ficticia');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Resumo da rede' })).toBeVisible();
}

/** O elemento visível no centro do alvo é o próprio alvo (ou algo dentro dele). */
async function estaPorCima(alvo: Locator): Promise<boolean> {
  return alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    return topo !== null && el.contains(topo);
  });
}

test('menu da conta abre por cima dos painéis do mapa do Resumo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);

  await page.getByRole('button', { name: /^Menu de / }).click();
  const menu = page.locator('#menu-usuario');
  await expect(menu).toBeVisible();
  for (const item of await menu.getByRole('menuitem').all()) {
    expect(await estaPorCima(item)).toBe(true);
  }
});

test('ao rolar, os painéis do mapa passam por baixo da barra do topo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await entrar(page);

  // Rola até o painel "rede" (canto esquerdo do mapa) ficar atrás da marca, no topo.
  const painel = page.locator('.painel--rede');
  await expect(painel).toBeVisible();
  const deslocamento = await painel.evaluate((el) => el.getBoundingClientRect().top + 30);
  await page.evaluate((y) => window.scrollTo(0, y), deslocamento);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(deslocamento - 5);

  const marca = page.getByRole('link', { name: 'Início' });
  const sobreposto = await page.evaluate(() => {
    const m = document.querySelector('.marca')!.getBoundingClientRect();
    const p = document.querySelector('.painel--rede')!.getBoundingClientRect();
    return p.left < m.right && p.right > m.left && p.top < m.bottom && p.bottom > m.top;
  });
  expect(sobreposto, 'o painel precisa estar atrás da marca para o teste valer').toBe(true);
  expect(await estaPorCima(marca)).toBe(true);
});

test('o mapa do Resumo desconta a linha de filtros ativos (sem rolagem extra)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);

  const hero = page.locator('.hero');
  const altura = async () => (await hero.boundingBox())!.height;
  const reservado = () =>
    page.locator('rs-shell').evaluate((el) => getComputedStyle(el).getPropertyValue('--rs-reservado'));
  await expect.poll(reservado).toMatch(/^\d+px$/);
  const antes = await altura();
  const reservadoAntes = await reservado();

  // A subnavegação de "Agora" já ocupa a linha de contexto; o espaço medido acompanha o layout.
  const main = await page.locator('main').evaluate((el) => {
    const s = getComputedStyle(el);
    return el.offsetTop + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
  });
  expect(parseInt(reservadoAntes, 10)).toBe(Math.round(main));
  expect(antes).toBeLessThanOrEqual(900 - Math.round(main) + 1);
});
