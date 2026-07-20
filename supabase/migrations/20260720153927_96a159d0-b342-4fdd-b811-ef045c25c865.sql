REVOKE ALL ON FUNCTION public.admin_get_product_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_product_detail(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_product_category_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_product_category_counts() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_quick_adjust_product(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_quick_adjust_product(uuid, numeric, numeric) TO authenticated;