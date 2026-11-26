import { ArrowLeftRight, Banknote, CreditCard, WalletCards, type LucideIcon } from 'lucide-react';
import type { PaymentMethod } from '../../types';

export const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  debit: WalletCards,
  credit: CreditCard,
  transfer: ArrowLeftRight,
};
