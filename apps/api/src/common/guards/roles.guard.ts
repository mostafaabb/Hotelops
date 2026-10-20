import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  GENERAL_MANAGER: 80,
  HOTEL_MANAGER: 70,
  ACCOUNTANT: 60,
  FRONT_DESK: 55,
  RESERVATION_AGENT: 50,
  HOUSEKEEPING_MANAGER: 45,
  MAINTENANCE_MANAGER: 40,
  STAFF: 20,
  HOUSEKEEPER: 15,
  MAINTENANCE_STAFF: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userLevel = ROLE_HIERARCHY[user.role as UserRole];
    const hasAccess = requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role];
      return userLevel >= requiredLevel;
    });

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions for this operation');
    }

    return true;
  }
}

export { ROLE_HIERARCHY };