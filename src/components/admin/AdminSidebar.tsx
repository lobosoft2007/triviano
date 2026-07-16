import type { ReactNode } from "react";
import {
  UtensilsCrossed,
  Tags,
  Package,
  Boxes,
  Layers,
  Truck,
  Users,
  UserCog,
  ShieldCheck,
  Wallet,
  TrendingUp,
  PackagePlus,
  ClipboardCheck,
  ShoppingCart,
  Megaphone,
  Building2,
  Palette,
  CreditCard,
  ChevronDown,
  ClipboardList,
  Banknote,
  Warehouse,
  Store,
  LifeBuoy,
  Lock,
  Crown,
  Armchair,
  Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BrandLogo } from "@/components/BrandLogo";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

/** Admin tabs governed by the sidebar navigation. */
export type AdminTab =
  | "cardapio"
  | "categorias"
  | "horarios"
  | "combos"
  | "empresa"
  | "identidade"
  | "pagamentos"
  | "clientes"
  | "conta"
  | "financeiro"
  | "estoque"
  | "ajustes"
  | "compras"
  | "insumos"
  | "subprodutos"
  | "setores"
  | "fornecedores"
  | "funcionarios"
  | "permissoes"
  | "mesas";

interface AdminSidebarProps {
  activeTab: AdminTab;
  isSuperAdmin: boolean;
  /** True when the given tab is allowed for the current user. */
  tabAllowed: (tab: AdminTab) => boolean;
  onSelectTab: (tab: AdminTab) => void;
  onLock: () => void;
}

/** A single leaf entry inside an accordion group. */
interface LeafEntry {
  key: AdminTab;
  label: string;
  icon: ReactNode;
}

interface GroupModel {
  id: string;
  label: string;
  icon: ReactNode;
  children: LeafEntry[];
}

/* ------------------------------------------------------------------ */
/* Accordion group — renders only if it has at least one visible child */
/* ------------------------------------------------------------------ */

function SidebarAccordionGroup({
  group,
  activeTab,
  tabAllowed,
  onSelectTab,
}: {
  group: GroupModel;
  activeTab: AdminTab;
  tabAllowed: (tab: AdminTab) => boolean;
  onSelectTab: (tab: AdminTab) => void;
}) {
  const visible = group.children.filter((c) => tabAllowed(c.key));
  if (visible.length === 0) return null;

  const hasActive = visible.some((c) => c.key === activeTab);

  return (
    <Collapsible defaultOpen={hasActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="font-semibold">
            {group.icon}
            <span>{group.label}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visible.map((c) => (
              <SidebarMenuSubItem key={c.key}>
                <SidebarMenuSubButton
                  isActive={c.key === activeTab}
                  onClick={() => onSelectTab(c.key)}
                  className="cursor-pointer"
                >
                  {c.icon}
                  <span>{c.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/* Admin Sidebar                                                       */
/* ------------------------------------------------------------------ */

export function AdminSidebar({
  activeTab,
  isSuperAdmin,
  tabAllowed,
  onSelectTab,
  onLock,
}: AdminSidebarProps) {
  const iconCls = "h-4 w-4 shrink-0";

  const groups: GroupModel[] = [
    {
      id: "cadastros",
      label: "Cadastros",
      icon: <ClipboardList className={iconCls} />,
      children: [
        { key: "cardapio", label: "Cardápio", icon: <UtensilsCrossed className={iconCls} /> },
        { key: "categorias", label: "Categorias", icon: <Tags className={iconCls} /> },
        { key: "insumos", label: "Insumos", icon: <Package className={iconCls} /> },
        { key: "subprodutos", label: "SubProdutos", icon: <Boxes className={iconCls} /> },
        { key: "setores", label: "Setores", icon: <Layers className={iconCls} /> },
        { key: "fornecedores", label: "Fornecedores", icon: <Truck className={iconCls} /> },
        { key: "clientes", label: "Clientes", icon: <Users className={iconCls} /> },
        { key: "funcionarios", label: "Funcionários", icon: <UserCog className={iconCls} /> },
        { key: "permissoes", label: "Permissões", icon: <ShieldCheck className={iconCls} /> },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      icon: <Banknote className={iconCls} />,
      children: [
        { key: "conta", label: "Conta Corrente", icon: <Wallet className={iconCls} /> },
        { key: "financeiro", label: "Financeiro", icon: <TrendingUp className={iconCls} /> },
      ],
    },
    {
      id: "estoque",
      label: "Estoque",
      icon: <Warehouse className={iconCls} />,
      children: [
        { key: "estoque", label: "Entrada de Estoque", icon: <PackagePlus className={iconCls} /> },
        { key: "ajustes", label: "Ajuste Rápido", icon: <ClipboardCheck className={iconCls} /> },
        { key: "compras", label: "Sugestão de Compras", icon: <ShoppingCart className={iconCls} /> },
      ],
    },
    {
      id: "marketing",
      label: "Marketing",
      icon: <Megaphone className={iconCls} />,
      children: [
        { key: "combos", label: "Campanhas", icon: <Megaphone className={iconCls} /> },
      ],
    },
    {
      id: "empresa",
      label: "Empresa",
      icon: <Store className={iconCls} />,
      children: [
        { key: "empresa", label: "Configurações", icon: <Building2 className={iconCls} /> },
        { key: "identidade", label: "Identidade Visual", icon: <Palette className={iconCls} /> },
        { key: "pagamentos", label: "Pagamentos", icon: <CreditCard className={iconCls} /> },
        { key: "mesas", label: "Mesas (QR-Codes)", icon: <Armchair className={iconCls} /> },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5 group-data-[collapsible=icon]:justify-center">
          <BrandLogo
            showName
            imgClassName="h-8 w-8 shrink-0 rounded-lg object-contain"
            nameClassName="truncate font-display text-base font-bold leading-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Retaguarda</SidebarGroupLabel>
          <SidebarMenu>
            {groups.map((g) => (
              <SidebarAccordionGroup
                key={g.id}
                group={g}
                activeTab={activeTab}
                tabAllowed={tabAllowed}
                onSelectTab={onSelectTab}
              />
            ))}

            {isSuperAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="font-semibold">
                  <Link to="/superadmin">
                    <Crown className={`${iconCls} text-primary`} />
                    <span>Painel Master</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href="https://wa.me/5521993383918"
                target="_blank"
                rel="noreferrer"
              >
                <LifeBuoy className={iconCls} />
                <span>Suporte</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLock}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Lock className={iconCls} />
              <span>Bloquear / Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-center gap-4 px-4 py-4 group-data-[collapsible=icon]:hidden">
          <img
            src="/Logomarca da Triviano.webp"
            alt="Triviano"
            className="h-16 w-auto rounded-md opacity-100"
          />
          <span className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
            por Triviano
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
