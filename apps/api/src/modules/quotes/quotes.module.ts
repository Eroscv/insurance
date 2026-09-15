import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({ imports: [DocumentsModule], controllers: [QuotesController], providers: [QuotesService], exports: [QuotesService] })
export class QuotesModule {}
