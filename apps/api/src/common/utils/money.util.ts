import { Decimal } from '@prisma/client/runtime/library';

export const toDecimal = (value: number | string | Decimal): Decimal =>
  new Decimal(value.toString());

export const ceilAmount = (value: number | string | Decimal): number =>
  Math.ceil(new Decimal(value.toString()).toNumber() * 100) / 100;

export const roundAmount = (value: number | string | Decimal): number =>
  Math.round(new Decimal(value.toString()).toNumber() * 100) / 100;

export interface MoneyBreakdown {
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
}

export const sumMoney = (values: Array<number | string | Decimal>): number => {
  let total = 0;
  for (const v of values) {
    total += Number(new Decimal(v.toString()));
  }
  return roundAmount(total);
};

export const formatMoney = (value: number | string | Decimal, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));