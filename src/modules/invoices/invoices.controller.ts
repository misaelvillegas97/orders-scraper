import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { InvoicesService }                          from '@modules/invoices/invoices.service';
import { InvoiceMapper }                            from '@modules/orders/domain/mappers/invoice.mapper';
import { InvoiceQueryDto }                          from '@modules/invoices/domain/dtos/query.dto';
import { StatusUpdateDto }                          from '@modules/invoices/domain/dtos/status-update.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(@Query() query: InvoiceQueryDto) {
    const invoices = await this.invoicesService.findAll(query);

    return InvoiceMapper.mapAll(invoices);
  }

  @Get('overview')
  async getInvoicesOverview() {
    return this.invoicesService.invoicesOverview();
  }

  @Put(':invoiceId/status')
  async updateStatus(@Param('invoiceId') invoiceId: string, @Body() body: StatusUpdateDto) {
    const invoice = await this.invoicesService.updateStatus(invoiceId, body);


    return InvoiceMapper.map(invoice);
  }
}
