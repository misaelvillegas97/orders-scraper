import { OrderTypeEnum } from '@modules/orders/domain/enums/order-type.enum';

export class OrderType {
  public static parseFromCencoB2B(type: string): OrderTypeEnum {
    switch (type) {
      case 'OC Tienda':
        return OrderTypeEnum.PURCHASE_ORDER;
      case 'Devoluciones Centralizadas':
        return OrderTypeEnum.RETURN_ORDER;
      default:
        return OrderTypeEnum.PURCHASE_ORDER;
    }
  }
}
