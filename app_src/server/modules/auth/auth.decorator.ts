import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@shared/api.interface';

export const NEED_GEO_LOGIN_KEY = 'needGeoLogin';
export const NeedGeoLogin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NEED_GEO_LOGIN_KEY, true);

export const GEO_ROLES_KEY = 'geoRoles';
export const GeoRoles = (roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(GEO_ROLES_KEY, roles);

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (permission: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

export const PublicGeo = (): MethodDecorator =>
  SetMetadata(NEED_GEO_LOGIN_KEY, false);
