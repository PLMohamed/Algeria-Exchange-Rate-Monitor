import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CronSecretGuard } from './cron-secret.guard.js';

function createConfigService(secret?: string): ConfigService {
  return {
    get: vi.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
}

function createContext(headers: Record<string, string | undefined>) {
  const request = { headers };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  it('accepts the secret from the x-cron-secret header', () => {
    const guard = new CronSecretGuard(createConfigService('s3cret'));

    expect(
      guard.canActivate(createContext({ 'x-cron-secret': 's3cret' })),
    ).toBe(true);
  });

  it('accepts the secret as a Bearer token', () => {
    const guard = new CronSecretGuard(createConfigService('s3cret'));

    expect(
      guard.canActivate(createContext({ authorization: 'Bearer s3cret' })),
    ).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const guard = new CronSecretGuard(createConfigService('s3cret'));

    expect(() =>
      guard.canActivate(createContext({ 'x-cron-secret': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing secret', () => {
    const guard = new CronSecretGuard(createConfigService('s3cret'));

    expect(() => guard.canActivate(createContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when CRON_SECRET is not configured', () => {
    const guard = new CronSecretGuard(createConfigService());

    expect(() =>
      guard.canActivate(createContext({ 'x-cron-secret': 'anything' })),
    ).toThrow(UnauthorizedException);
  });
});
