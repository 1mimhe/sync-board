import type { Request } from 'express';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/** Express request carrying the authenticated JWT payload. */
export interface RequestWithUser extends Request {
  user?: JwtPayload;
}
