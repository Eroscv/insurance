import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module';
import { QuoteInsurersController } from './quote-insurers.controller';
import { QuoteInsurersService } from './quote-insurers.service';

@Module({ imports: [QuotesModule], controllers: [QuoteInsurersController], providers: [QuoteInsurersService], exports: [QuoteInsurersService] })
export class QuoteInsurersModule {}
