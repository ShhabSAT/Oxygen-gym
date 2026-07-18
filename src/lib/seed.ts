import type { SubscriptionType } from '../types';

export const DEFAULT_SUBSCRIPTION_TYPES: Omit<
  SubscriptionType,
  'updated_at'
>[] = [
  { id: 'visit', name: 'زيارة', price_men: 10000, price_women: 10000 },
  {
    id: 'intermittent',
    name: 'متقطع (3 أيام/أسبوع)',
    price_men: 50000,
    price_women: 75000,
  },
  { id: 'monthly', name: 'شهري', price_men: 75000, price_women: 100000 },
  {
    id: 'private',
    name: 'خاص (شهري)',
    price_men: 100000,
    price_women: 150000,
  },
];
