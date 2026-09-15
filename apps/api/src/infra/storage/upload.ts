import { BadRequestException } from '@nestjs/common';

export const ALLOWED_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Verificação determinística por magic bytes (sem bibliotecas de detecção). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Valida arquivo enviado: presença, tamanho, MIME declarado e MIME real (magic bytes). */
export function validateUpload(file: UploadedFile | undefined, maxMb: number, allowed: string[] = Object.keys(ALLOWED_MIME)): string {
  if (!file) throw new BadRequestException('Arquivo obrigatório.');
  if (file.size > maxMb * 1024 * 1024) throw new BadRequestException(`Arquivo excede ${maxMb} MB.`);
  const real = sniffMime(file.buffer);
  if (!real || !allowed.includes(real)) {
    throw new BadRequestException('Tipo de arquivo não permitido. Envie PDF, JPG, PNG ou WEBP.');
  }
  return real;
}
