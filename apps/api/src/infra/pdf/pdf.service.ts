import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import type { Env } from '../../config/env';

/** Renderiza HTML/CSS (Handlebars) em PDF via Chromium. Execução serial (uma renderização por vez) no MVP. */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private readonly templatesDir: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    // dist/infra/pdf → ../../../templates (dist) ou src/infra/pdf → ../../../templates (dev)
    const candidates = [join(__dirname, '../../../templates'), join(__dirname, '../../templates'), join(process.cwd(), 'templates')];
    this.templatesDir = candidates.find((c) => existsSync(c)) ?? candidates[0]!;
    Handlebars.registerHelper('brl', (v: unknown) => {
      if (v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
    });
    Handlebars.registerHelper('date', (v: unknown) => {
      if (!v) return '—';
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    });
    Handlebars.registerHelper('yesno', (v: unknown) => (v ? 'Sim' : 'Não'));
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  }

  async render(template: string, data: Record<string, unknown>): Promise<string> {
    let tpl = this.templates.get(template);
    if (!tpl) {
      const [html, css] = await Promise.all([
        readFile(join(this.templatesDir, template, `${template}.hbs`), 'utf8'),
        readFile(join(this.templatesDir, template, `${template}.css`), 'utf8').catch(() => ''),
      ]);
      tpl = Handlebars.compile(html.replace('/* {{css}} */', css));
      if (process.env.NODE_ENV === 'production') this.templates.set(template, tpl);
    }
    return tpl(data);
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const run = async () => {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: this.config.get('PUPPETEER_EXECUTABLE_PATH', { infer: true }),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    this.logger.log('Chromium iniciado para geração de PDF');
    return this.browser;
  }

  async onModuleDestroy() {
    await this.browser?.close().catch(() => undefined);
  }
}
