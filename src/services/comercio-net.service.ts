import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser, ElementHandle, Page } from 'puppeteer';
import * as fs from 'fs-extra';
import * as path from 'path';

interface Order {
  id: string;
  size: string;
  receptionDate: string;
  deliveryLocation: string;
  issuer: string;
  status: string;
}

interface Product {
  line: string;
  upcCode: string;
  item: string;
  providerCode: string;
  size: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitsPerPackage: string;
  packages: string;
  totalPrice: string;
}

interface OrderDetail {
  issuer: string;
  receptor: string;
  purchaseOrder: string;
  generationDate: string;
  shipmentDate: string;
  cancellationDate: string;
  paymentConditions: string;
  deliveryLocation: string;
  salesDepartment: string;
  orderType: string;
  promotion: string;
  providerNumber: string;
  issuerInfo: string;
  vendorInfo: string;
  observations: string;
  products: Product[];
}

@Injectable()
export class ComercioNetService {
  private readonly username = process.env.USERNAME;
  private readonly password = process.env.PASSWORD;
  private readonly cookiesPath = path.resolve(__dirname, '../../cookies.json');

  constructor() {
    console.log('Scraping service initialized.', this.username, this.password);
    // this.run();
  }

  async run(): Promise<void> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await this.login(page);

    await this.extractOrders(browser, page);

    // await this.downloadAllDocuments(browser, page);

    await browser.close();
  }

  // Main function to log in and maintain the session
  async login(page: Page): Promise<void> {
    // Attempt to load previously saved cookies
    const cookiesLoaded = await this.loadCookies(page);

    if (cookiesLoaded) {
      console.log('Continuing with loaded cookies.');
    }

    // Navigate to the main page after loading cookies
    await page.goto('https://www.comercionet.cl/principal.php', {
      waitUntil: 'networkidle0',
    });

    // Check if already authenticated
    if (await this.isAuthenticated(page)) {
      console.log('Session already initiated with loaded cookies.');
    } else {
      // If not authenticated, perform the login process
      await this.performLogin(page);
      // Save cookies after logging in
      await this.saveCookies(page);
    }
  }

  async extractOrders(browser: Browser, page: Page): Promise<Order[]> {
    const queryParams = {
      tido_id: '9',
      tipo: 'recibidos',
      fecha_inicio: '2024-12-20',
      fecha_termino: '2024-12-28',
      estado: '0',
      offset: '0',
    };

    const url = 'https://www.comercionet.cl/listadoDocumentos.php?' + new URLSearchParams(queryParams);
    console.log(`Navigating to URL: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      console.log('Page loaded successfully.');

      // Capture a screenshot after page load
      await page.screenshot({ path: 'screenshots/page_loaded.png', fullPage: true });
      console.log('Screenshot after page load taken.');

      // Wait for the table to be present in the DOM
      await page.waitForSelector('table.tabla', { timeout: 5000 });
      console.log('Table found on the page.');

      // Capture a screenshot after the table is found
      await page.screenshot({ path: 'screenshots/table_found.png', fullPage: true });
      console.log('Screenshot after table found taken.');

      // Extract rows from the table
      const orders: Order[] = [];
      const rows = await page.$$('table.tabla tr');

      for (const row of rows.slice(1)) {
        const columns: ElementHandle<HTMLTableCellElement>[] = await row.$$('td');
        const radius: ElementHandle<HTMLInputElement> = await columns[0]?.$('input[type="radio"]');

        if (radius) {
          await radius.click();
        }

        // Haz clic en el botón "Visualizar"
        await page.click('a[onClick="visualizar()"]');

        // Espera a que se abra la nueva ventana
        const newPagePromise = new Promise((resolve) => browser.once('targetcreated', (target) => resolve(target.page())));
        const newPage: Page = (await newPagePromise) as Page;

        console.log('New page opened.');

        // Espera a que la nueva página cargue completamente
        await newPage.waitForSelector('body');

        const orderDetail = await this.extractOrderDetails(newPage);

        orders.push({
          id: await page.evaluate((el) => el.textContent?.trim(), columns[1]),
          size: await page.evaluate((el) => el.textContent?.trim(), columns[2]),
          receptionDate: await page.evaluate((el) => el.textContent?.trim(), columns[3]),
          deliveryLocation: await page.evaluate((el) => el.textContent?.trim(), columns[4]),
          issuer: await page.evaluate((el) => el.textContent?.trim(), columns[5]),
          status: await page.evaluate((el) => el.textContent?.trim(), columns[6]),
          detail: orderDetail,
        } as Order);

        // Cierra la ventana actual
        await newPage.close();
      }

      // Capture a screenshot after orders extraction
      await page.screenshot({ path: 'screenshots/orders_extracted.png', fullPage: true });
      console.log('Screenshot after orders extraction taken.');

      // save orders as json
      await fs.writeFile(__dirname + '../../../' + 'orders.json', JSON.stringify(orders, null, 2));

      return orders;
    } catch (error) {
      console.error('An error occurred while extracting orders:', error);

      // Capture a screenshot if an error occurs
      await page.screenshot({ path: 'screenshots/error_occurred.png', fullPage: true });
      console.log('Screenshot after error taken.');

      return [];
    }
  }

  async downloadAllDocuments(browser: Browser, page: Page): Promise<void> {
    // Selecciona todos los checkboxes de los documentos
    const documentCheckboxes = await page.$$('input[name="documento"]');
    console.log(`Found ${documentCheckboxes.length} document checkboxes.`);

    for (let i = 0; i < documentCheckboxes.length; i++) {
      // Selecciona el checkbox correspondiente
      await documentCheckboxes[i].click();

      // Haz clic en el botón "Visualizar"
      await page.click('a[onClick="visualizar()"]');

      console.log(`Downloading document ${i + 1}...`);

      // Espera a que se abra la nueva ventana
      const newPagePromise = new Promise((resolve) => browser.once('targetcreated', (target) => resolve(target.page())));
      const newPage: Page = (await newPagePromise) as Page;

      console.log('New page opened.');

      // Espera a que la nueva página cargue completamente
      await newPage.waitForSelector('body');

      // Cierra la ventana actual
      await newPage.close();

      // Deselecciona el checkbox para el siguiente documento
      await documentCheckboxes[i].click();
    }
  }

  async extractOrderDetails(page: puppeteer.Page): Promise<any> {
    console.log('Extracting order details...');
    return await page
      .evaluate(() => {
        const logs: string[] = [];

        const log = (message: string, ...args) => {
          logs.push(message);
          logs.push(...args);
        };

        log('Declaring extractText function...');
        const extractText = (label: string): string => {
          const thElements = Array.from(document.querySelectorAll('table th'));
          const targetTh = thElements.find((th) => th.textContent?.trim().includes(label));
          const targetTd = targetTh?.nextElementSibling;
          return targetTd ? targetTd.textContent?.trim() || '' : '';
        };

        log('Declaring extractProducts function...');
        const extractProducts = (): Product[] => {
          log('Extracting products...');

          const rows = Array.from(document.querySelectorAll('table.tabla-ord_wm')[3].querySelectorAll('tbody tr'));

          log('rows', rows);

          // Products have this distribution, tr for headers, tr for data, tr for description, br, tr for data, tr for description, etc

          return rows
            .filter((row) => row.querySelectorAll('td').length > 0 && !row.querySelector('th')) // Exclude header rows
            .filter((row, index) => index % 2 === 0) // Only get the rows with data
            .map((row) => {
              const columns = row.querySelectorAll('td');

              const descriptionSibling = row.nextElementSibling;
              const text = descriptionSibling?.querySelector('td')?.textContent?.trim() || '';

              return {
                line: columns[0]?.textContent?.trim() || '',
                upcCode: columns[1]?.textContent?.trim() || '',
                item: columns[2]?.textContent?.trim() || '',
                providerCode: columns[3]?.textContent?.trim() || '',
                size: columns[4]?.textContent?.trim() || '',
                description: columns[5]?.textContent?.trim() || '',
                quantity: columns[6]?.textContent?.trim() || '',
                unitPrice: columns[7]?.textContent?.trim() || '',
                unitsPerPackage: columns[8]?.textContent?.trim() || '',
                packages: columns[9]?.textContent?.trim() || '',
                totalPrice: columns[10]?.textContent?.trim() || '',
                observation: text,
              };
            });
        };

        log('Declaring extractObservations function...');
        const extractObservations = (): string => {
          const observationTable = document.querySelectorAll('table.tabla-ord_wm')[2]; // Observations table
          const observationRow: HTMLTableRowElement = observationTable?.querySelector('tbody tr');
          return observationRow ? observationRow.cells[1]?.textContent?.trim() || '' : '';
        };

        log('Declaring extractAdditionalInfo function...');
        const extractAdditionalInfo = (): any => {
          const additionalInfoTable: HTMLTableElement = document.querySelectorAll('table.tabla-ord_wm')[4] as HTMLTableElement; // Additional info table
          const rows: HTMLTableRowElement[] = Array.from(additionalInfoTable.querySelectorAll('tbody tr'));
          const additionalInfo: { [key: string]: string } = {};

          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
              additionalInfo[cells[0].textContent?.trim() || ''] = cells[1].textContent?.trim() || '';
            }
          });

          return additionalInfo;
        };

        const products = extractProducts();

        log('extracting products', products);

        return {
          issuer: extractText('Emisor:'),
          receptor: extractText('Receptor:'),
          purchaseOrder: extractText('Número de Orden de Compra:'),
          generationDate: extractText('Fecha generación Mensaje:'),
          shipmentDate: extractText('Fecha de Embarque:'),
          cancellationDate: extractText('Fecha de Cancelacion:'),
          paymentConditions: extractText('Condiciones de Pago:'),
          deliveryLocation: extractText('Lugar de Entrega:'),
          salesDepartment: extractText('Departamento de Ventas:'),
          orderType: extractText('Tipo de Orden de Compra:'),
          promotion: extractText('Promocion:'),
          providerNumber: extractText('Numero de Proveedor'),
          issuerInfo: extractText('Información Emisor'),
          vendorInfo: extractText('Información Vendedor'),
          observations: extractObservations(),
          products: products,
          additionalInfo: extractAdditionalInfo(), // New field for additional info
          logs,
        };
      })
      .then((result) => {
        const { logs, ...orderDetail } = result;
        logs.forEach((log: string) => console.log(log));
        return orderDetail as OrderDetail;
      });
  }

  // Load cookies from a file if it exists
  private async loadCookies(page: puppeteer.Page): Promise<boolean> {
    try {
      const cookiesString = await fs.readFile(this.cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);
      console.log('Cookies loaded successfully.');

      return true;
    } catch (error) {
      console.log('No cookies found to load.');
      return false;
    }
  }

  // Save the current cookies to a file
  private async saveCookies(page: puppeteer.Page): Promise<void> {
    const cookies = await page.cookies();
    await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
    console.log('Cookies saved successfully.');
  }

  // Check if the session is authenticated by looking for a specific element
  private async isAuthenticated(page: puppeteer.Page): Promise<boolean> {
    // Wait for the frames to load
    await page.waitForSelector('frame[name="top"]', { timeout: 5000 }).catch(() => null);
    await page.waitForSelector('frame[name="menu"]', { timeout: 5000 }).catch(() => null);
    await page.waitForSelector('frame[name="contenido"]', { timeout: 5000 }).catch(() => null);

    // Get all frames in the page
    const frames = page.frames();

    // Check for the presence of the 'top' frame
    const topFrame = frames.find((frame) => frame.name() === 'top');
    if (!topFrame) {
      console.log('Top frame not found.');
      return false;
    }

    // Check for the presence of the 'menu' frame
    const menuFrame = frames.find((frame) => frame.name() === 'menu');
    if (!menuFrame) {
      console.log('Menu frame not found.');
      return false;
    }

    // Check for the presence of the 'contenido' frame
    const contenidoFrame = frames.find((frame) => frame.name() === 'contenido');
    if (!contenidoFrame) {
      console.log('Contenido frame not found.');
      return false;
    }

    // Optionally, you can further verify by checking specific content within these frames
    // For example, checking if the 'top' frame contains a specific element or text
    const topFrameContent = await topFrame.content();
    if (topFrameContent.includes('Expected Text or Element')) {
      console.log('Authenticated: Specific content found in top frame.');
      return true;
    }

    console.log('Authenticated frames found.');
    return true;
  }

  // Perform the login process
  private async performLogin(page: puppeteer.Page): Promise<void> {
    // Navigate to the login page
    await page.goto('https://www.comercionet.cl/comercionet/index.php', {
      waitUntil: 'networkidle0',
    });

    // Fill in the login form
    await page.type('input[name="login"]', this.username);
    await page.type('input[name="_password"]', this.password);

    // Submit the form
    await Promise.all([page.click('input[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle0' })]);

    // Verify that the login was successful
    if (await this.isAuthenticated(page)) {
      console.log('Login successful.');
    } else {
      throw new Error('Login failed.');
    }
  }

  logger(message: string): void {
    console.log(message);
  }
}