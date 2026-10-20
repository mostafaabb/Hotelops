import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, StockMovementType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateMovementInput {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  reference?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService
  ) {}

  async createMovement(user: AuthenticatedUser, dto: CreateMovementInput) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: dto.productId, organizationId: user.organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');

    let newQuantity: number;
    switch (dto.type) {
      case StockMovementType.IN:
        newQuantity = product.quantity + dto.quantity;
        break;
      case StockMovementType.OUT:
        newQuantity = product.quantity - dto.quantity;
        break;
      case StockMovementType.TRANSFER:
        newQuantity = product.quantity - dto.quantity;
        break;
      case StockMovementType.ADJUSTMENT:
        newQuantity = dto.quantity;
        break;
    }

    if (newQuantity < 0) {
      throw new BadRequestException('Insufficient stock for this movement');
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          productId: product.id,
          organizationId: user.organizationId,
          hotelId: product.hotelId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          reference: dto.reference,
          performedBy: user.id,
        },
      });
      await tx.inventoryProduct.update({
        where: { id: product.id },
        data: { quantity: newQuantity },
      });
      return created;
    });

    await this.auditService.record(user.id, user.organizationId, 'CHANGE', 'StockMovement', movement.id, {
      newValue: {
        type: dto.type,
        movementQuantity: dto.quantity,
        productId: product.id,
        newProductQuantity: newQuantity,
      },
    });

    if (newQuantity <= product.minimumStock) {
      await this.notificationsService.notifyRole({
        roles: [UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER],
        organizationId: user.organizationId,
        hotelId: product.hotelId,
        type: NotificationType.INVENTORY,
        title: 'Low stock alert',
        body: `${product.name} (${product.sku}) is at or below minimum stock: ${newQuantity} / ${product.minimumStock}`,
        link: `/inventory/products/${product.id}`,
        relatedId: product.id,
        relatedType: 'InventoryProduct',
      });
    }

    return movement;
  }
}