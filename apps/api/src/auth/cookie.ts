import { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseOptions(isProd: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
  };
}

export function setRefreshCookie(res: Response, token: string, isProd: boolean): void {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions(isProd), maxAge: REFRESH_MAX_AGE_MS });
}

export function clearRefreshCookie(res: Response, isProd: boolean): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions(isProd));
}
