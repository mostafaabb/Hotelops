import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SALARY_VISIBLE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.ACCOUNTANT,
];

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private canSeeSalary(role: UserRole): boolean {
    return SALARY_VISIBLE_ROLES.includes(role);
  }

  stripSalary(data: any, role: UserRole): any {
    if (this.canSeeSalary(role)) {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => {
        const { salary, ...rest } = item;
        return rest;
      });
    }
    const { salary, ...rest } = data;
    return rest;
  }

  async generateEmployeeId(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const seqId = `employee-${organizationId}-${year}`;

    const sequence = await this.prisma.sequence.upsert({
      where: { id: seqId },
      update: { value: { increment: 1 } },
      create: { id: seqId, value: 1 },
    });

    return `EMP-${year}-${String(sequence.value).padStart(4, '0')}`;
  }
}
