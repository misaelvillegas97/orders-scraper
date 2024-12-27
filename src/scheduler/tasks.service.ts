import { Injectable } from '@nestjs/common';
import { ComercioNetService } from '../services/comercio-net.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  constructor(private comercioNetService: ComercioNetService) {}

  @Cron(CronExpression.EVERY_MINUTE, { disabled: true })
  async checkComercioNet() {
    await this.comercioNetService.run();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkCencoB2B() {}
}
