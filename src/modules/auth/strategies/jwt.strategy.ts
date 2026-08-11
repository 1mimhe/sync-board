import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Passport JWT Strategy supporting RS256 with key files or HS256 fallback.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const publicPath = config.get<string>('JWT_PUBLIC_KEY_PATH');
    const hasKeyFile = publicPath && fs.existsSync(publicPath);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: hasKeyFile
        ? fs.readFileSync(publicPath, 'utf-8')
        : config.get<string>(
            'JWT_SECRET',
            'default-super-secret-key-change-in-prod',
          ),
      algorithms: [hasKeyFile ? 'RS256' : 'HS256'],
      issuer: 'syncboard',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
