import { Injectable, Logger }   from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ClientService }      from '@modules/clients/client.service';
import { ComercioNetService } from '../services/comercio-net.service';
import { CencosudB2bService } from '../services/cencosud-b2b.service';
import { OrderRequestDto }    from '../domain/dto/order-request.dto';
import { EventEmitter2 }      from '@nestjs/event-emitter';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(
    private readonly comercioNetService: ComercioNetService,
    private readonly cencosudB2bService: CencosudB2bService,
    private readonly eventEmitter: EventEmitter2,
    private readonly clientService: ClientService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {disabled: true})
  async checkComercioNet() {
    this.logger.log(`Initializing WallmartB2B task at ${ new Date().toISOString() }`);

    const clientEntity = await this.clientService.findByCode('WallmartB2B');

    const beginningTimestamp = new Date().getTime();
    const orders = await this.comercioNetService.run();
    const endingTimestamp = new Date().getTime();

    this.logger.log(`WallmartB2B task finished at ${ new Date().toISOString() } in ${ endingTimestamp - beginningTimestamp }ms`);

    if (!orders) {
      this.logger.log('No orders found');
      return;
    }

    const mappedOrders: OrderRequestDto[] = orders?.map((order: any) => ({
      ...OrderRequestDto.mapFromComercioNet(order),
      clientId: clientEntity.id
    } as OrderRequestDto));

    console.log(mappedOrders);

    this.eventEmitter.emit('order-providers.createAll', mappedOrders);
  }

  @Cron(CronExpression.EVERY_3_HOURS, {disabled: true})
  async checkCencoB2B() {
    this.logger.log(`Initializing CencosudB2B task at ${ new Date().toISOString() }`);

    const clientEntity = await this.clientService.findByCode('CencosudB2B');

    const beginningTimestamp = new Date().getTime();
    const orders = await this.cencosudB2bService.run();
    const endingTimestamp = new Date().getTime();

    this.logger.log(`CencosudB2B task finished at ${ new Date().toISOString() } in ${ endingTimestamp - beginningTimestamp }ms`);

    if (!orders) {
      this.logger.log('No orders found');
      return;
    }

    const mappedOrders: OrderRequestDto[] = orders?.map((order: any) => ({
      ...OrderRequestDto.mapFromCencoB2B(order),
      clientId: clientEntity.id
    } as OrderRequestDto));

    this.eventEmitter.emit('order-providers.createAll', mappedOrders);
  }
}
