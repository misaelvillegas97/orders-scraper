import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import { Browser, launch, Page } from 'puppeteer';

@Injectable()
export class CencosudB2bService {
  private readonly logger = new Logger(CencosudB2bService.name);
  private readonly username = process.env.CENCOSUD_B2B_USERNAME;
  private readonly password = process.env.CENCOSUD_B2B_PASSWORD;
  private readonly url = process.env.CENCOSUD_B2B_URL;
  private readonly cookiesPath = path.resolve(__dirname, '../../cookies/cencosud-b2b.json');

  constructor() {
    this.logger.log('CencosudB2bService initialized');
  }

  async run() {
    // Prepare puppeteer
    const browser: Browser = await launch();
    const page: Page = await browser.newPage();

    // Login or restore session
    await this.login(page);
  }

  async login(page: Page) {
    // move to main page
    await page.goto(this.url, { waitUntil: 'networkidle0' });
  }
}
