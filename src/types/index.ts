export type Gender = 'men' | 'women';
export type MemberStatus = 'active' | 'expired' | 'frozen';
export type SubscriptionStatus = 'active' | 'expired' | 'frozen';

export interface Member {
  id: string;
  name: string;
  gender: Gender;
  phone: string;
  goal?: string;
  notes?: string;
  first_registration_date: string;
  status: MemberStatus;
  updated_at?: number;
}

export interface Subscription {
  id: string;
  member_id: string;
  type_id: string;
  start_date: string;
  end_date: string;
  base_price: number;
  actual_price: number;
  duration_days: number;
  status: SubscriptionStatus;
  updated_at?: number;
}

export interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  date: string;
  supervisor_name: string;
  updated_at?: number;
}

export interface Freeze {
  id: string;
  subscription_id: string;
  start_date: string;
  duration_days: number | null;
  end_date: string | null;
  actual_unfreeze_date: string | null;
  supervisor_name: string;
  updated_at?: number;
}

export type ActivityActionType =
  | 'member_add'
  | 'member_update'
  | 'member_delete'
  | 'register'
  | 'renew'
  | 'subscription_add'
  | 'subscription_update'
  | 'subscription_delete'
  | 'payment_add'
  | 'freeze'
  | 'unfreeze'
  | 'freeze_add'
  | 'freeze_update'
  | 'price_update'
  | 'type_delete'
  | 'sync'
  | 'seed'
  | 'other';

export interface ActivityLog {
  id: string;
  action_type: ActivityActionType;
  description: string;
  supervisor_name: string;
  timestamp: number;
  entity_id?: string;
  updated_at?: number;
}

export interface SubscriptionType {
  id: string;
  name: string;
  price_men: number;
  price_women: number;
  updated_at?: number;
}

export type EntityName =
  | 'members'
  | 'subscriptions'
  | 'payments'
  | 'freezes'
  | 'activityLog'
  | 'subscriptionTypes';

export type SyncOperation = 'add' | 'update' | 'delete';


