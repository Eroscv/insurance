import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { type PrismaService } from '../../infra/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.system.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
  }
}
