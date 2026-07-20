CREATE OR REPLACE FUNCTION public.get_public_menu()
 RETURNS TABLE(id uuid, category_id uuid, name text, description text, price numeric, image_url text, available boolean, sort_order integer, free_addon_limit integer, eixo_variacao text, empresa_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
         p.available, p.sort_order, p.free_addon_limit, p.eixo_variacao, p.empresa_id
  FROM public.products p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.available = true
    AND e.ativo = true
  ORDER BY p.sort_order;
$function$;