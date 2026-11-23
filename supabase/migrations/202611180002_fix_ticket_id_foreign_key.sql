alter table public.ticket
  drop constraint if exists ticket_id_fkey;

do $$
declare
  ticket_sequence text;
  highest_ticket_id bigint;
begin
  ticket_sequence := pg_get_serial_sequence('public.ticket', 'id');

  if ticket_sequence is null then
    create sequence if not exists public.ticket_sales_id_seq;
    alter sequence public.ticket_sales_id_seq owned by public.ticket.id;
    alter table public.ticket
      alter column id set default nextval('public.ticket_sales_id_seq'::regclass);
    ticket_sequence := 'public.ticket_sales_id_seq';
  end if;

  select max(id) into highest_ticket_id
  from public.ticket;

  if highest_ticket_id is null then
    perform setval(ticket_sequence::regclass, 1, false);
  else
    perform setval(ticket_sequence::regclass, highest_ticket_id, true);
  end if;
end;
$$;
