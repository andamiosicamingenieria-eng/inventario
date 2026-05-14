-- =====================================================================
-- FIX: Triggers HS/HE que afectan inv_master sin violar constraints
--
-- Problema detectado:
-- - fn_process_he_logic insertaba inv_master con cantidad_rentada NEGATIVA
-- - fn_process_hs_logic insertaba inv_master con cantidad_disponible NEGATIVA
--
-- Solución:
-- - Nunca insertar valores negativos en inv_master (respeta CHECK >= 0)
-- - En HE tipo='subarr' SOLO suma disponible (no resta rentada)
-- - En HE normal resta rentada pero con clamp: greatest(0, ...)
-- - En HS resta disponible con clamp: greatest(0, ...) (o valida en app)
-- =====================================================================

create or replace function public.fn_process_hs_logic()
returns trigger
language plpgsql
as $$
declare
  item record;
  p_id integer;
  qty numeric;
begin
  for item in
    select * from jsonb_to_recordset(new.items) as x(codigo text, cantidad_hs numeric)
  loop
    qty := coalesce(item.cantidad_hs, 0);
    if qty <= 0 then
      continue;
    end if;

    -- tabla relacional (si existe)
    begin
      insert into public.ops_hs_items (hs_id, producto_id, cantidad_hs)
      values (new.id, item.codigo, qty);
    exception when undefined_table then
      -- ignore if phase3 not installed
      null;
    end;

    select id into p_id from public.cat_productos where codigo = item.codigo;
    if p_id is null then
      continue;
    end if;

    update public.inv_master
      set cantidad_disponible = greatest(0, cantidad_disponible - qty),
          cantidad_rentada    = cantidad_rentada + qty,
          ultima_salida       = current_date,
          updated_at          = current_timestamp
    where producto_id = p_id;

    if not found then
      insert into public.inv_master (producto_id, almacen, cantidad_disponible, cantidad_rentada, ultima_salida)
      values (p_id, 'Principal', 0, qty, current_date);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_process_hs on public.ops_hs;
create trigger trg_process_hs
after insert on public.ops_hs
for each row execute function public.fn_process_hs_logic();


create or replace function public.fn_process_he_logic()
returns trigger
language plpgsql
as $$
declare
  item record;
  p_id integer;
  qty numeric;
  is_subarr boolean;
begin
  is_subarr := (coalesce(new.tipo, 'normal') = 'subarr');

  for item in
    select * from jsonb_to_recordset(new.items) as x(codigo text, cantidad_recolectada numeric, estado text)
  loop
    qty := coalesce(item.cantidad_recolectada, 0);
    if qty <= 0 then
      continue;
    end if;

    -- tabla relacional (si existe)
    begin
      insert into public.ops_he_items (he_id, producto_id, cantidad_recolectada, cantidad_buena)
      values (new.id, item.codigo, qty, qty);
    exception when undefined_table then
      null;
    end;

    select id into p_id from public.cat_productos where codigo = item.codigo;
    if p_id is null then
      continue;
    end if;

    if is_subarr then
      -- Sub-arrendamiento: entra a disponible, NO afecta rentada
      update public.inv_master
        set cantidad_disponible = cantidad_disponible + qty,
            ultima_entrada      = current_date,
            updated_at          = current_timestamp
      where producto_id = p_id;

      if not found then
        insert into public.inv_master (producto_id, almacen, cantidad_disponible, cantidad_rentada, ultima_entrada)
        values (p_id, 'Principal', qty, 0, current_date);
      end if;
    else
      -- HE normal: vuelve a disponible y sale de rentada (clamp rentada >= 0)
      update public.inv_master
        set cantidad_disponible = cantidad_disponible + qty,
            cantidad_rentada    = greatest(0, cantidad_rentada - qty),
            ultima_entrada      = current_date,
            updated_at          = current_timestamp
      where producto_id = p_id;

      if not found then
        insert into public.inv_master (producto_id, almacen, cantidad_disponible, cantidad_rentada, ultima_entrada)
        values (p_id, 'Principal', qty, 0, current_date);
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_process_he on public.ops_he;
create trigger trg_process_he
after insert on public.ops_he
for each row execute function public.fn_process_he_logic();

