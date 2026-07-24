## Diagnóstico

Confirmei no banco: o valor **está sendo salvo corretamente** (`empresas.tempo_entrega_padrao_min = 10` no seu tenant). Ou seja, o `UPDATE` funciona — o problema é **exibição** ao reabrir a aba.

Olhando `src/components/admin/TemposPreparoTab.tsx`:

```ts
const [value, setValue] = useState<string>("");
useEffect(() => {
  if (data !== undefined) setValue(String(data));
}, [data]);
```

Dois pontos frágeis:

1. **Estado local desacoplado do cache do React Query.** Quando a aba é remontada, `value` reinicia como `""`. O `useEffect` só sobrescreve *depois* que o effect roda; se `data` já vem do cache (mesma referência), o effect pode até rodar, mas se o `refetch` disparado por outro invalidate resetar `data` para `undefined` momentaneamente, o input fica em branco e não repopula (a condição `data !== undefined` protege contra isso, mas o `useState("")` inicial é o real culpado quando o cache está frio).

2. **`useQuery` sem `staleTime`.** Cada montagem refaz a query; enquanto isLoading está true mostramos o Loader (ok), mas se der erro silencioso de RLS/network, `data` fica `undefined` para sempre e o input renderiza vazio sem feedback.

## Correção

Arquivo único: `src/components/admin/TemposPreparoTab.tsx`.

1. Inicializar `value` a partir do cache do React Query usando `initialData`/`select` ou, mais simples, derivar o valor exibido diretamente de `data` quando o usuário ainda não digitou nada (padrão "controlado com fallback"):
   - Manter `value: string | null`, iniciar em `null`.
   - No input, usar `value={value ?? (data !== undefined ? String(data) : "")}`.
   - `onChange` passa a setar string normal.
   - Isso elimina a corrida entre `useState` e `useEffect` — o input sempre reflete o cache até o operador digitar.
2. Adicionar `staleTime: 30_000` na query para evitar refetches desnecessários entre trocas de aba.
3. Após `setTempoEntregaPadrao`, além do `refetch`, resetar `value` para `null` para que o próximo render leia do cache já atualizado (evita "grudar" no valor digitado se o backend normalizar/arredondar).
4. Tratar estado de erro: se `error` estiver presente, mostrar um aviso curto ("Não foi possível carregar o tempo atual") no lugar do input em branco silencioso, para expor futuras falhas de RLS/rede.

Nenhuma mudança de schema, RLS ou lógica de negócio. Só a camada de apresentação da aba.

## Verificação

- Salvar 15 → sair da aba → voltar: input mostra "15".
- Salvar 0 → voltar: mostra "0" (não "").
- Simular erro (dev tools offline): aparece aviso em vez de campo vazio silencioso.
