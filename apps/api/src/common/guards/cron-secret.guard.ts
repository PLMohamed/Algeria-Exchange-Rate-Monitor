import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SECRET_HEADER = 'x-cron-secret';
const BEARER_PREFIX = 'Bearer ';

/**
 * Protects endpoints that are meant to be triggered by a scheduler.
 *
 * The caller must send the shared secret either as the `x-cron-secret` header
 * or as a `Bearer` token in the `Authorization` header. The endpoint is denied
 * when `CRON_SECRET` is not configured (fail closed).
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('CRON_SECRET');

    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = getProvidedSecret(request);

    if (!provided || !secretsMatch(provided, expected)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}

function getProvidedSecret(request: Request): string | undefined {
  const header = request.headers[SECRET_HEADER];

  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  const authorization = request.headers.authorization;

  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length);
  }

  return undefined;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}
