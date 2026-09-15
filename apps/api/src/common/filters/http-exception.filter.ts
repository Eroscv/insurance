import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@insurance/database';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload = typeof body === 'string' ? { statusCode: status, error: exception.name, message: body } : body;
      return res.status(status).json(payload);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: 409,
          error: 'Conflict',
          message: 'Registro duplicado.',
          details: exception.meta,
        });
      }
      if (exception.code === 'P2025') {
        return res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, error: 'Not Found', message: 'Registro não encontrado.' });
      }
      if (exception.code === 'P2003') {
        return res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, error: 'Bad Request', message: 'Referência inválida.' });
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno.',
    });
  }
}
