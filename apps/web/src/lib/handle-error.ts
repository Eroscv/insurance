import { toast } from 'sonner';
import { ApiError } from './api-client';

/** Exibe erro de API em toast; retorna a mensagem. */
export function handleApiError(e: unknown, fallback = 'Ocorreu um erro.'): string {
  const msg = e instanceof ApiError ? (e.details?.length ? `${e.message} ${e.details.map((d) => d.message).join(' ')}` : e.message) : fallback;
  toast.error(msg);
  return msg;
}
