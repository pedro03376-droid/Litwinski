import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    // super_admin can access everything
    if (user.role === 'super_admin') return true;
    // For routes with :teamId param, enforce match
    const paramTeamId = req.params?.teamId;
    if (paramTeamId && paramTeamId !== user.teamId) {
      throw new ForbiddenException('Access denied to this team\'s data');
    }
    return true;
  }
}
