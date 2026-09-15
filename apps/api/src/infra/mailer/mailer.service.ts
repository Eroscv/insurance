import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Stub determinístico: no MVP não há SMTP. Mensagens são logadas.
 * Trocar por implementação SMTP/provider sem alterar os chamadores.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 50) this.sent.shift();
    this.logger.log(`[mail stub] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
