export type CreditPackage = {
  id: string;
  name: string;
  price_cents: number;
  credits: number;
  active: boolean;
  sort_order: number;
};

export type Drink = {
  id: string;
  name: string;
  price_credits: number;
  category: string | null;
  active: boolean;
  sort_order: number;
};
