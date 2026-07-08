
ALTER TABLE public.config_pagamentos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.meios_pagamento ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
