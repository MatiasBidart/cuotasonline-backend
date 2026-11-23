export interface User {
  id: string;
  created_at: string;
  admin_status: boolean;
  name: string;
  dni: number;
}

export interface Seller {
  id: number;
  created_at: string;
  is_active: boolean;
  user_id: string;
}

export interface Client {
  id: number;
  created_at: string;
  is_active: boolean;
  user_id: string;
}

export interface Cobrador {
  id: number;
  created_at: string;
  user_id: string;
}

export interface Contact {
  id: number;
  phone: string;
  street: string;
  map_link: string | null;
  user_id: string;
}

export interface Product {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  img: string;
  description: string;
}

export interface Ticket {
  id: number;
  created_at: string;
  client_id: number;
  seller_id: number;
  cobrador_id: number;
}

export interface TicketProduct {
  id: number;
  created_at: string;
  product_id: number;
  ticket_id: number;
  value: number;
  quotas: number;
}
