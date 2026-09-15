import { Module } from '@nestjs/common';
import { QuoteInsurersModule } from '../quote-insurers/quote-insurers.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({ imports: [QuotesModule, QuoteInsurersModule], controllers: [ProposalsController], providers: [ProposalsService], exports: [ProposalsService] })
export class ProposalsModule {}
