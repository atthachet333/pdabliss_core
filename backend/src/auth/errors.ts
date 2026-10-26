import { AppError } from '../lib/errors.js';

/*
 * Auth errors (EP23): stable codes with messages that are safe to show. They
 * never say whether an email exists, which check failed first, or anything
 * about hashes, tokens or configuration.
 */

export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

export const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');

export const emailNotVerified = () =>
  new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before signing in.');

export const accountUnavailable = () =>
  new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account cannot sign in. Contact PDA BLISS.');

export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');

export const ownerProtected = () =>
  new AppError(403, 'OWNER_PROTECTED', 'The Platform Owner account cannot be changed here.');

export const stepUpRequired = () =>
  new AppError(403, 'STEP_UP_REQUIRED', 'Confirm with a one-time code to continue.');

export const loginThrottled = () =>
  new AppError(
    429,
    'LOGIN_THROTTLED',
    'Too many sign-in attempts. Wait a few minutes and try again.',
  );

export const passwordPolicy = (problem: string) =>
  new AppError(400, 'PASSWORD_POLICY', 'The password does not meet the password rules.', {
    problem,
  });

export const otpIncorrect = (attemptsRemaining: number) =>
  new AppError(400, 'OTP_INCORRECT', 'The code is incorrect.', { attemptsRemaining });

export const otpExpired = () =>
  new AppError(410, 'OTP_EXPIRED', 'This code is no longer valid. Request a new one.');

export const otpLocked = () =>
  new AppError(429, 'OTP_LOCKED', 'Too many incorrect codes. Start again to get a new code.');

export const otpResendTooSoon = (resendAvailableAt: Date) =>
  new AppError(429, 'OTP_RESEND_TOO_SOON', 'Please wait before requesting another code.', {
    resendAvailableAt: resendAvailableAt.toISOString(),
  });

export const otpResendLimit = () =>
  new AppError(429, 'OTP_RESEND_LIMIT', 'No more codes can be sent for this attempt. Start again.');

export const otpChallengeLimit = () =>
  new AppError(429, 'OTP_CHALLENGE_LIMIT', 'Too many codes were requested. Try again later.');

export const tokenInvalid = () => new AppError(400, 'TOKEN_INVALID', 'This link is not valid.');

export const tokenExpired = () =>
  new AppError(410, 'TOKEN_EXPIRED', 'This link has expired. Request a new one.');

export const tokenUsed = () => new AppError(410, 'TOKEN_USED', 'This link has already been used.');

export const mailUnavailable = () =>
  new AppError(503, 'MAIL_UNAVAILABLE', 'Email could not be sent right now. Try again shortly.');

export const authUnavailable = () =>
  new AppError(503, 'AUTH_UNAVAILABLE', 'Accounts are not available on this server.');

export const csrfRejected = () =>
  new AppError(403, 'CSRF_REJECTED', 'This request was not accepted from this origin.');
