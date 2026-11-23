create table if not exists public.account_invitation (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  role text not null check (role in ('admin', 'seller', 'client')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'used', 'expired', 'revoked')),
  claim_id uuid unique,
  claimed_at timestamptz
);

create index if not exists account_invitation_pending_email_idx
  on public.account_invitation (email, created_at desc)
  where status = 'pending';

alter table public.account_invitation enable row level security;
revoke all on public.account_invitation from anon, authenticated;
grant all on public.account_invitation to service_role;

create or replace function public.create_ticket_with_products(
  p_client_id bigint,
  p_seller_id bigint,
  p_cobrador_id bigint,
  p_ticket_products jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_ticket public.ticket%rowtype;
  item record;
begin
  if jsonb_typeof(p_ticket_products) <> 'array' or jsonb_array_length(p_ticket_products) = 0 then
    raise exception 'La venta debe incluir al menos un producto';
  end if;

  insert into public.ticket (client_id, seller_id, cobrador_id)
  values (p_client_id, p_seller_id, p_cobrador_id)
  returning * into created_ticket;

  for item in
    select * from jsonb_to_recordset(p_ticket_products)
      as product_line(product_id bigint, value integer, quotas integer)
  loop
    if item.product_id is null or item.value is null or item.value <= 0
      or item.quotas is null or item.quotas <= 0 then
      raise exception 'Cada producto debe tener un valor y una cantidad de cuotas válidos';
    end if;

    insert into public.ticket_product (ticket_id, product_id, value, quotas)
    values (created_ticket.id, item.product_id, item.value, item.quotas);
  end loop;

  return to_jsonb(created_ticket);
end;
$$;

revoke all on function public.create_ticket_with_products(bigint, bigint, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.create_ticket_with_products(bigint, bigint, bigint, jsonb) to service_role;
