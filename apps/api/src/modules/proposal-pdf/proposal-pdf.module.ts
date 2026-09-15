import { Module } from '@nestjs/common';
import { ProposalsModule } from '../proposals/proposals.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ProposalPdfController } from './proposal-pdf.controller';
import { ProposalPdfService } from './proposal-pdf.service';

@Module({ imports: [QuotesModule, ProposalsModule], controllers: [ProposalPdfController], providers: [ProposalPdfService] })
export class ProposalPdfModule {}
