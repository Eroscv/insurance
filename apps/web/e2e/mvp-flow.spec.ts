import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * Fluxo completo do MVP (critérios de aceite):
 * conta → cliente → veículo → documentos → cotação → seguradoras → propostas → comparativo → PDF → fechar → histórico.
 * Executa contra API + web reais (npm run dev) com banco de desenvolvimento.
 */
const stamp = Date.now();
const email = `e2e-${stamp}@teste.local`;
const password = 'Senha12345';
const cpf = '529.982.247-25';

/** Em dev, aguarda a hidratação (evita submit nativo do form antes do React assumir). */
async function goto(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

async function login(page: Page) {
  await goto(page, '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.serial('fluxo do MVP', () => {
  test('cria conta e organização', async ({ page }) => {
    await goto(page, '/register');
    await page.getByLabel('Nome da corretora').fill(`Corretora E2E ${stamp}`);
    await page.getByLabel('Seu nome').fill('Usuária E2E');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
  });

  test('cadastra seguradoras e usuário', async ({ page }) => {
    await login(page);
    await goto(page, '/insurers');
    for (const name of ['Porto E2E', 'Azul E2E']) {
      await page.getByRole('button', { name: 'Nova seguradora' }).first().click();
      await page.getByLabel(/^Nome/).fill(name);
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText(name)).toBeVisible();
    }
    await goto(page, '/settings/users');
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await page.getByLabel(/^Nome/).fill('Corretor E2E');
    await page.getByLabel(/^E-mail/).fill(`broker-${stamp}@teste.local`);
    await page.getByLabel(/^Senha inicial/).fill(password);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText('Corretor E2E')).toBeVisible();
  });

  test('cliente, veículo, documentos, cotação, propostas, comparativo, PDF, fechamento e histórico', async ({ page }) => {
    await login(page);
    // cliente
    await goto(page, '/clients');
    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await page.getByLabel(/^Nome completo/).fill('Cliente E2E Silva');
    await page.getByLabel(/^CPF/).fill(cpf);
    await page.getByLabel(/^Telefone/).fill('11987654321');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Cliente E2E Silva' })).toBeVisible();

    // veículo
    await page.getByRole('tab', { name: /Veículos/ }).click();
    await page.getByRole('button', { name: 'Adicionar veículo' }).first().click();
    await page.getByLabel(/^Marca/).fill('Fiat');
    await page.getByLabel(/^Modelo/).fill('Argo');
    await page.getByLabel(/^Ano fabricação/).fill('2022');
    await page.getByLabel(/^Ano modelo/).fill('2023');
    await page.getByLabel(/^Placa/).fill('ABC1D23');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Fiat Argo')).toBeVisible();

    // documentos (CNH + CRLV) e validação
    await page.getByRole('tab', { name: /Documentos/ }).click();
    for (const type of ['CNH', 'CRLV']) {
      await page.getByRole('button', { name: 'Enviar documento' }).first().click();
      await page.getByLabel(/^Tipo/).selectOption(type);
      await page.getByLabel(/^Arquivo/).setInputFiles(resolve(__dirname, `fixtures/${type.toLowerCase()}.png`));
      await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await expect(page.getByText(`${type.toLowerCase()}.png`)).toBeVisible();
    }
    const validar = page.getByRole('button', { name: 'Validar' });
    await expect(validar).toHaveCount(2);
    await validar.first().click();
    await expect(page.getByText('Documento validado.')).toBeVisible();
    await page.getByRole('button', { name: 'Validar' }).first().click();
    await expect(page.getByRole('button', { name: 'Validar' })).toHaveCount(0);

    // cotação (wizard)
    await page.getByRole('link', { name: 'Nova cotação' }).first().click();
    await expect(page.getByRole('heading', { name: 'Nova cotação' })).toBeVisible();
    await expect(page.getByText('Selecionado')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click(); // tipo
    await page.getByRole('button', { name: 'Continuar' }).click(); // dados (veículo único auto-selecionado)
    await page.getByRole('button', { name: 'Continuar' }).click(); // documentos
    await page.getByText('Porto E2E').click();
    await page.getByText('Azul E2E').click();
    await page.getByRole('button', { name: 'Criar cotação' }).click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: /Cotação #\d{6}/ })).toBeVisible();

    // status: NEW → DATA_COMPLETE (docs validados + veículo) via diálogo
    await page.getByRole('button', { name: 'Alterar status' }).click();
    await page.getByRole('combobox', { name: /^Novo status/ }).selectOption('DATA_COMPLETE');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Status alterado para Dados completos.')).toBeVisible();

    // propostas
    await page.getByRole('tab', { name: /Propostas/ }).click();
    const proposals = [
      { insurer: 'Porto E2E', total: '3200', deductible: '4000' },
      { insurer: 'Azul E2E', total: '2900', deductible: '5000' },
    ];
    for (const p of proposals) {
      await page.getByRole('button', { name: 'Registrar proposta' }).first().click();
      await page.getByRole('combobox', { name: /^Seguradora/ }).selectOption({ label: p.insurer });
      await page.getByLabel(/^Prêmio total/).fill(p.total);
      await page.getByLabel(/^Franquia/).fill(p.deductible);
      await page.getByRole('button', { name: 'Registrar', exact: true }).click();
      await expect(page.getByText('Proposta registrada.')).toBeVisible();
    }
    await expect(page.getByText('R$ 2.900,00').first()).toBeVisible();

    // comparativo + seleção + PDF
    await page.getByRole('tab', { name: 'Comparativo' }).click();
    await expect(page.getByRole('cell', { name: 'R$ 2.900,00' })).toBeVisible();
    await page.getByRole('columnheader', { name: /Azul E2E/ }).getByRole('button', { name: 'Selecionar' }).click();
    await expect(page.getByText('Azul E2E selecionada.')).toBeVisible();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Gerar proposta PDF' }).click();
    await expect(page.getByText(/Proposta comercial gerada/)).toBeVisible({ timeout: 60_000 });
    await (await popup).close();

    // fechar: PROPOSALS_RECEIVED → PROPOSAL_SENT → WON
    for (const [status, label] of [['PROPOSAL_SENT', 'Proposta enviada'], ['WON', 'Fechada']]) {
      await page.getByRole('button', { name: 'Alterar status' }).click();
      await page.getByRole('combobox', { name: /^Novo status/ }).selectOption(status!);
      await page.getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByText(`Status alterado para ${label}.`)).toBeVisible();
    }

    // histórico
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.getByText('Mudanças de status')).toBeVisible();
    await expect(page.getByText('Proposta enviada → Fechada')).toBeVisible();
    await expect(page.getByText('Seleção de proposta')).toBeVisible();
  });

  test('follow-up: tarefa aparece no dashboard', async ({ page }) => {
    await login(page);
    await goto(page, '/tasks');
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
    await page.getByLabel(/^Título/).fill('Ligar para o cliente E2E');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText('Ligar para o cliente E2E')).toBeVisible();
    await goto(page, '/dashboard');
    await expect(page.getByText('1 tarefa(s) sua(s) em aberto')).toBeVisible();
  });
});
