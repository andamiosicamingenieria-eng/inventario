-- =====================================================================
-- ICAM 360 — Triggers HE: UPDATE/DELETE ajustan inventario correctamente
--
-- Qué resuelve:
-- - Si editas una HE (cambias cantidades/items), el inventario se ajusta por delta
-- - Si borras una HE, revierte su efecto en inventario
--
-- Reglas:
-- - HE tipo='subarr': SOLO afecta cantidad_disponible (suma en insert, delta en update, revierte en delete)
-- - HE normal: suma disponible y resta rentada (con clamp >= 0)
--
-- Nota:
-- - Este script NO cambia el trigger AFTER INSERT (fn_process_he_logic),
--   solo agrega lógica para UPDATE/DELETE.
-- =====================================================================

create or replace function public.fn_process_he_update_logic()
returns trigger
language plpgsql
as $$
declare
  r record;
  p_id integer;
  is_subarr boolean;
begin
  is_subarr := (coalesce(new.tipo, 'normal') = 'subarr');

  -- (Opcional) Mantener ops_he_items sincronizada al editar HE:
  -- borramos y reinsertamos desde NEW.items
  begin
    delete from public.ops_he_items where he_id = new.id;
    insert into public.ops_he_items (he_id, producto_id, cantidad_recolectada, cantidad_buena)
    select
      new.id,
      x.codigo,
      x.cantidad_recolectada,
      x.cantidad_recolectada
    from jsonb_to_recordset(coalesce(new.items, '[]'::jsonb))
      as x(codigo text, cantidad_recolectada numeric, estado text)
    where coalesce(x.codigo, '') <> ''
      and coalesce(x.cantidad_recolectada, 0) > 0;
  exception when undefined_table then
    null;
  end;

  -- Ajuste inventario por DELTA = new_qty - old_qty por código
  for r in
    with old_items as (
      select x.codigo, sum(coalesce(x.cantidad_recolectada,0)) as qty
      from jsonb_to_recordset(coalesce(old.items, '[]'::jsonb))
        as x(codigo text, cantidad_recolectada numeric, estado text)
      where coalesce(x.codigo,'') <> ''
      group by x.codigo
    ),
    new_items as (
      select x.codigo, sum(coalesce(x.cantidad_recolectada,0)) as qty
      from jsonb_to_recordset(coalesce(new.items, '[]'::jsonb))
        as x(codigo text, cantidad_recolectada numeric, estado text)
      where coalesce(x.codigo,'') <> ''
      group by x.codigo
    )
    select
      coalesce(n.codigo, o.codigo) as codigo,
      coalesce(n.qty,0) - coalesce(o.qty,0) as delta
    from new_items n
    full join old_items o on o.codigo = n.codigo
    where (coalesce(n.qty,0) - coalesce(o.qty,0)) <> 0
  loop
    select id into p_id from public.cat_productos where codigo = r.codigo;
    if p_id is null then
      continue;
    end if;

    if is_subarr then
      update public.inv_master
        set cantidad_disponible = greatest(0, cantidad_disponible + r.delta),
            ultima_entrada      = current_date,
            updated_at          = current_timestamp
      where producto_id = p_id;
    else
      update public.inv_master
        set cantidad_disponible = greatest(0, cantidad_disponible + r.delta),
            cantidad_rentada    = greatest(0, cantidad_rentada - r.delta),
            ultima_entrada      = current_date,
            updated_at          = current_timestamp
      where producto_id = p_id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_process_he_au on public.ops_he;
create trigger trg_process_he_au
after update of items, tipo on public.ops_he
for each row
execute function public.fn_process_he_update_logic();


create or replace function public.fn_process_he_delete_logic()
returns trigger
language plpgsql
as $$
declare
  r record;
  p_id integer;
  is_subarr boolean;
begin
  is_subarr := (coalesce(old.tipo, 'normal') = 'subarr');

  for r in
    select x.codigo, sum(coalesce(x.cantidad_recolectada,0)) as qty
    from jsonb_to_recordset(coalesce(old.items, '[]'::jsonb))
      as x(codigo text, cantidad_recolectada numeric, estado text)
    where coalesce(x.codigo,'') <> ''
    group by x.codigo
    having sum(coalesce(x.cantidad_recolectada,0)) <> 0
  loop
    select id into p_id from public.cat_productos where codigo = r.codigo;
    if p_id is null then
      continue;
    end if;

    if is_subarr then
      update public.inv_master
        set cantidad_disponible = greatest(0, cantidad_disponible - r.qty),
            updated_at          = current_timestamp
      where producto_id = p_id;
    else
      update public.inv_master
        set cantidad_disponible = greatest(0, cantidad_disponible - r.qty),
            cantidad_rentada    = cantidad_rentada + r.qty,
            updated_at          = current_timestamp
      where producto_id = p_id;
    end if;
  end loop;

  return old;
end;
$$;

drop trigger if exists trg_process_he_ad on public.ops_he;
create trigger trg_process_he_ad
after delete on public.ops_he
for each row
execute function public.fn_process_he_delete_logic();

