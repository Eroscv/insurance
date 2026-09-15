import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ imports: [DocumentsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
