-- =====================================================================
-- ICAM 360 — Sub-Arrendamientos: agregar dias_renta y autogenerar fecha_devolucion
-- Ejecutar en Supabase → SQL Editor
-- =====================================================================

alter table public.ops_subarriendos
add column if not exists dias_renta integer;

-- Validación simple
alter table public.ops_subarriendos
drop constraint if exists ops_subarriendos_dias_renta_check;

alter table public.ops_subarriendos
add constraint ops_subarriendos_dias_renta_check
check (dias_renta is null or dias_renta > 0);

create or replace function public.fn_set_subarr_fecha_devolucion()
returns trigger
language plpgsql
as $$
begin
  if new.fecha_inicio is not null and new.dias_renta is not null and new.dias_renta > 0 then
    -- Si quieres permitir override manual, cambia la condición a:
    -- if new.fecha_devolucion is null then ...
    new.fecha_devolucion := (new.fecha_inicio + new.dias_renta);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_subarr_fecha_devolucion on public.ops_subarriendos;

create trigger trg_set_subarr_fecha_devolucion
before insert or update of fecha_inicio, dias_renta
on public.ops_subarriendos
for each row
execute function public.fn_set_subarr_fecha_devolucion();

