
ALTER TABLE public.categories ALTER COLUMN empresa_id SET DEFAULT current_empresa_id();
ALTER TABLE public.orders ALTER COLUMN empresa_id SET DEFAULT current_empresa_id();
ALTER TABLE public.products ALTER COLUMN empresa_id SET DEFAULT current_empresa_id();
