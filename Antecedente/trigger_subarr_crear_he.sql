-- =====================================================================
-- ICAM 360 — Trigger: Sub-Arrendamiento → Genera HE + Items (relacional)
-- Guarda:
--  - ops_he (cabecera) con tipo='subarr' y referencia_sa = folio SARR
--  - ops_he_items: NO se inserta aquí si ya existe trigger en ops_he
--    (ej. fn_process_he_logic) que lo llena desde ops_he.items. Si ambos
--    corren, se duplica cada item.
--
-- Requisitos:
--  - Tabla ops_subarriendos con columna items JSONB
--  - Tabla ops_he
--  - (Opcional) Tabla ops_he_items (schema_phase3_items.sql)
--
-- Nota RLS:
--  - Si tienes RLS habilitado, asegúrate de tener políticas que permitan
--    INSERT/SELECT en ops_he y ops_he_items para el rol que ejecuta.
-- =====================================================================

create or replace function public.trg_subarr_crear_he()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio_he text;
  v_he_id int;
begin
  -- Evitar duplicar si ya existe HE para este SARR
  if exists(
    select 1
    from public.ops_he h
    where h.referencia_sa = new.folio
      and h.tipo = 'subarr'
  ) then
    return new;
  end if;

  v_folio_he := coalesce(nullif(new.folio_he, ''), 'HE-' || new.folio);

  -- Insert HE (cabecera)
  insert into public.ops_he (
    folio,
    contrato_folio,
    razon_social,
    fecha,
    total_piezas,
    estatus,
    vaciado_fabricacion,
    tipo,
    referencia_sa,
    notas,
    items
  ) values (
    v_folio_he,
    coalesce(new.contrato_destino_folio, 'SARR-STOCK-INTERNO'),
    '[SUB-ARR] ' || coalesce(new.proveedor, 'Proveedor'),
    coalesce(new.fecha_inicio, current_date),
    coalesce(
      (
        select sum((it->>'cantidad')::int)
        from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it
      ),
      0
    ),
    'recibido',
    true,
    'subarr',
    new.folio,
    new.notas,
    -- También dejamos un JSON compatible con el frontend actual de HE
    (
      select jsonb_agg(
        jsonb_build_object(
          'codigo', it->>'codigo',
          'nombre', it->>'nombre',
          'cantidad_recolectada', (it->>'cantidad')::int,
          'estado', 'limpio_funcional'
        )
      )
      from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it
    )
  )
  returning id into v_he_id;

  -- NOTA: ops_he_items se llena por trigger de ops_he (si existe).
  -- Si tu instancia NO tiene trigger de ops_he, puedes re-habilitar
  -- el insert relacional aquí, pero NO uses ambos a la vez.

  -- Guardar folio_he en el SARR si venía vacío
  if new.folio_he is null or new.folio_he = '' then
    update public.ops_subarriendos
      set folio_he = v_folio_he
      where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ops_subarriendos_ai_crear_he on public.ops_subarriendos;

create trigger trg_ops_subarriendos_ai_crear_he
after insert on public.ops_subarriendos
for each row
execute function public.trg_subarr_crear_he();

