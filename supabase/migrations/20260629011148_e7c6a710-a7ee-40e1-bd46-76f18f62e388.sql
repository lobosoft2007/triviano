-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- CATEGORIES (public read-only menu data)
-- =========================================================
CREATE TABLE public.categories (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (true);

-- =========================================================
-- PRODUCTS (public read-only menu data)
-- =========================================================
CREATE TABLE public.products (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (true);

CREATE INDEX idx_products_category ON public.products(category_id);

-- =========================================================
-- ORDERS (user-owned)
-- =========================================================
CREATE TABLE public.orders (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  delivery_address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_orders_user ON public.orders(user_id);

-- =========================================================
-- ORDER ITEMS (owned through parent order)
-- =========================================================
CREATE TABLE public.order_items (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items of their own orders"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));

CREATE POLICY "Users can add items to their own orders"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'address', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- SEED MENU DATA
-- =========================================================
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Pratos', 'pratos', 1),
  ('Lanches', 'lanches', 2),
  ('Sobremesas', 'sobremesas', 3),
  ('Bebidas', 'bebidas', 4);

INSERT INTO public.products (category_id, name, description, price, image_url, sort_order)
SELECT c.id, p.name, p.description, p.price, p.image_url, p.sort_order
FROM (VALUES
  ('pratos', 'Feijoada Completa', 'Feijoada tradicional com arroz, couve, farofa e laranja', 38.90, '/images/feijoada.jpg', 1),
  ('pratos', 'Moqueca de Peixe', 'Peixe fresco no leite de coco e dendê, com pirão e arroz', 49.90, '/images/moqueca.jpg', 2),
  ('pratos', 'Filé à Parmegiana', 'Filé empanado com molho de tomate e queijo, arroz e fritas', 44.90, '/images/parmegiana.jpg', 3),
  ('lanches', 'X-Burger Artesanal', 'Pão brioche, blend 180g, queijo cheddar, alface e tomate', 27.90, '/images/burger.jpg', 1),
  ('lanches', 'Hot Dog Especial', 'Salsicha artesanal, purê, milho, batata palha e molhos', 19.90, '/images/hotdog.jpg', 2),
  ('lanches', 'Club Sandwich', 'Frango, bacon, ovo, alface e tomate em três camadas', 24.90, '/images/club.jpg', 3),
  ('sobremesas', 'Pudim de Leite', 'Clássico pudim cremoso com calda de caramelo', 12.90, '/images/pudim.jpg', 1),
  ('sobremesas', 'Petit Gâteau', 'Bolo quente de chocolate com sorvete de creme', 18.90, '/images/gateau.jpg', 2),
  ('sobremesas', 'Açaí na Tigela', 'Açaí cremoso com banana, granola e leite condensado', 16.90, '/images/acai.jpg', 3),
  ('bebidas', 'Suco de Laranja', 'Suco natural de laranja, 500ml', 9.90, '/images/suco.jpg', 1),
  ('bebidas', 'Refrigerante Lata', 'Coca-Cola, Guaraná ou Fanta, 350ml', 6.90, '/images/refri.jpg', 2),
  ('bebidas', 'Água Mineral', 'Água mineral sem gás, 500ml', 4.90, '/images/agua.jpg', 3)
) AS p(cat_slug, name, description, price, image_url, sort_order)
JOIN public.categories c ON c.slug = p.cat_slug;