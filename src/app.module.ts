import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './domain/entities/order.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { ComercioNetService } from './services/comercio-net.service';
import { TasksService } from './scheduler/tasks.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'comercio.db',
      entities: [OrderEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([OrderEntity]),
  ],
  controllers: [AppController],
  providers: [AppService, ComercioNetService, TasksService],
})
export class AppModule {}
