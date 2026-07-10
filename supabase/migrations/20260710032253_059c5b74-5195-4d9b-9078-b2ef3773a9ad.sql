
DO $$
DECLARE
  src uuid := '00000000-0000-0000-0000-000000000023';
  dst uuid := '00000000-0000-0000-0000-000000000099';
BEGIN
  DELETE FROM ingredientes_produto WHERE product_id IN (SELECT id FROM products WHERE empresa_id = dst);
  DELETE FROM produtos_price_options WHERE produto_id IN (SELECT id FROM products WHERE empresa_id = dst);
  DELETE FROM produtos_addons WHERE produto_id IN (SELECT id FROM products WHERE empresa_id = dst);
  DELETE FROM produtos_free_addons WHERE produto_id IN (SELECT id FROM products WHERE empresa_id = dst);
  DELETE FROM products WHERE empresa_id = dst;
  DELETE FROM categories WHERE empresa_id = dst;

  CREATE TEMP TABLE cat_map ON COMMIT DROP AS
  SELECT id AS old_id, gen_random_uuid() AS new_id FROM categories WHERE empresa_id = src;

  INSERT INTO categories (id, name, slug, sort_order, min_items, allows_half, combo_role, cor_fonte, tamanho_fonte, empresa_id)
  SELECT m.new_id, c.name, c.slug || '-t99', c.sort_order, c.min_items, c.allows_half, c.combo_role, c.cor_fonte, c.tamanho_fonte, dst
  FROM categories c JOIN cat_map m ON m.old_id = c.id WHERE c.empresa_id = src;

  CREATE TEMP TABLE prod_map ON COMMIT DROP AS
  SELECT id AS old_id, gen_random_uuid() AS new_id FROM products WHERE empresa_id = src;

  INSERT INTO products (id, category_id, name, description, price, image_url, available, sort_order, free_addon_limit, manipulado, eixo_variacao, empresa_id)
  SELECT pm.new_id, cm.new_id, p.name, p.description, p.price, p.image_url, p.available, p.sort_order, p.free_addon_limit, p.manipulado, p.eixo_variacao, dst
  FROM products p
  JOIN prod_map pm ON pm.old_id = p.id
  JOIN cat_map cm ON cm.old_id = p.category_id
  WHERE p.empresa_id = src;

  INSERT INTO produtos_price_options (id, produto_id, preco, tamanho, sort_order)
  SELECT gen_random_uuid(), pm.new_id, po.preco, po.tamanho, po.sort_order
  FROM produtos_price_options po JOIN prod_map pm ON pm.old_id = po.produto_id;

  INSERT INTO produtos_addons (id, produto_id, nome, preco, sort_order)
  SELECT gen_random_uuid(), pm.new_id, a.nome, a.preco, a.sort_order
  FROM produtos_addons a JOIN prod_map pm ON pm.old_id = a.produto_id;

  INSERT INTO produtos_free_addons (id, produto_id, nome, preco, sort_order)
  SELECT gen_random_uuid(), pm.new_id, f.nome, f.preco, f.sort_order
  FROM produtos_free_addons f JOIN prod_map pm ON pm.old_id = f.produto_id;

  INSERT INTO ingredientes_produto (id, product_id, nome, quantidade, permitir_exclusao, sort_order)
  SELECT gen_random_uuid(), pm.new_id, i.nome, i.quantidade, i.permitir_exclusao, i.sort_order
  FROM ingredientes_produto i JOIN prod_map pm ON pm.old_id = i.product_id;
END $$;
