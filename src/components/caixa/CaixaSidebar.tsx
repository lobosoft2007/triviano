import type { ReactNode } from "react";
import {
  Bike,
  UtensilsCrossed,
  ScanBarcode,
  Users,
  Wallet,
  ReceiptText,
  FileBarChart,
  TrendingUp,
  TrendingDown,
  HandCoins,
  DoorClosed,
  PackagePlus,
  Settings,
  CreditCard,
  ChevronDown,
  LifeBuoy,
  Lock,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
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
import type { CaixaTab, MyPermissions } from "@/lib/permissions";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface CaixaSidebarProps {
  perms: MyPermissions;
  activeTab: CaixaTab;
  deliveryCount: number;
  mesaCount: number;
  onSelectTab: (tab: CaixaTab) => void;
  onSuprimento: () => void;
  onSangria: () => void;
  onRecebimento: () => void;
  onParcial: () => void;
  onAjuste: () => void;
  onFecharCaixa: () => void;
  onLock: () => void;
}

/** A single leaf entry inside an accordion group. */
interface LeafEntry {
  key: string;
  label: string;
  icon: ReactNode;
  show: boolean;
  active?: boolean;
  onClick: () => void;
  badge?: ReactNode;
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
  defaultOpen,
}: {
  group: GroupModel;
  defaultOpen: boolean;
}) {
  const visible = group.children.filter((c) => c.show);
  if (visible.length === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
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
                  isActive={c.active}
                  onClick={c.onClick}
                  className="cursor-pointer"
                >
                  {c.icon}
                  <span>{c.label}</span>
                  {c.badge != null && (
                    <SidebarMenuBadge>{c.badge}</SidebarMenuBadge>
                  )}
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
/* Caixa Sidebar                                                       */
/* ------------------------------------------------------------------ */

export function CaixaSidebar({
  perms,
  activeTab,
  deliveryCount,
  mesaCount,
  onSelectTab,
  onSuprimento,
  onSangria,
  onRecebimento,
  onParcial,
  onAjuste,
  onFecharCaixa,
  onLock,
}: CaixaSidebarProps) {
  // Effective per-resource access derived from the permission matrix.
  const isMaster = perms.is_admin;
  const canMesas = isMaster || perms.acesso_mesas;
  const canDelivery = isMaster || perms.acesso_delivery;
  const canBalcao = isMaster || perms.acesso_atendimento_balcao;
  const canFinanceiro = isMaster || perms.acesso_financeiro;
  const canSangria = isMaster || perms.acesso_sangria_suprimento;
  const canEstoque = isMaster || perms.acesso_entrada_estoque;

  const iconCls = "h-4 w-4 shrink-0";

  const operacional: GroupModel = {
    id: "operacional",
    label: "Operacional",
    icon: <LayoutGrid className={iconCls} />,
    children: [
      {
        key: "mesas",
        label: "Mesas",
        icon: <UtensilsCrossed className={iconCls} />,
        show: canMesas,
        active: activeTab === "mesas",
        onClick: () => onSelectTab("mesas"),
        badge: mesaCount > 0 ? mesaCount : undefined,
      },
      {
        key: "delivery",
        label: "Delivery",
        icon: <Bike className={iconCls} />,
        show: canDelivery,
        active: activeTab === "delivery",
        onClick: () => onSelectTab("delivery"),
        badge: deliveryCount > 0 ? deliveryCount : undefined,
      },
      {
        key: "balcao",
        label: "Balcão",
        icon: <ScanBarcode className={iconCls} />,
        show: canBalcao,
        active: activeTab === "balcao",
        onClick: () => onSelectTab("balcao"),
      },
    ],
  };

  const clientes: GroupModel = {
    id: "clientes",
    label: "Clientes",
    icon: <Users className={iconCls} />,
    children: [
      {
        key: "fiado",
        label: "Conta Corrente",
        icon: <Wallet className={iconCls} />,
        show: canFinanceiro,
        active: activeTab === "fiado",
        onClick: () => onSelectTab("fiado"),
      },
      {
        key: "clientes",
        label: "Cadastro de Clientes",
        icon: <Users className={iconCls} />,
        show: isMaster,
        active: activeTab === "clientes",
        onClick: () => onSelectTab("clientes"),
      },
    ],
  };

  const caixaGroup: GroupModel = {
    id: "caixa",
    label: "Caixa",
    icon: <FileBarChart className={iconCls} />,
    children: [
      {
        key: "parcial",
        label: "Consultar Caixa",
        icon: <FileBarChart className={iconCls} />,
        show: canFinanceiro,
        onClick: onParcial,
      },
      {
        key: "suprimento",
        label: "Suprimento",
        icon: <TrendingUp className={`${iconCls} text-success`} />,
        show: canSangria,
        onClick: onSuprimento,
      },
      {
        key: "sangria",
        label: "Sangria",
        icon: <TrendingDown className={`${iconCls} text-destructive`} />,
        show: canSangria,
        onClick: onSangria,
      },
      {
        key: "recebimento",
        label: "Recebimento",
        icon: <HandCoins className={iconCls} />,
        show: canFinanceiro,
        onClick: onRecebimento,
      },
      {
        key: "fechar",
        label: "Fechar Caixa",
        icon: <DoorClosed className={`${iconCls} text-destructive`} />,
        show: isMaster,
        onClick: onFecharCaixa,
      },
    ],
  };

  const estoque: GroupModel = {
    id: "estoque",
    label: "Estoque",
    icon: <PackagePlus className={iconCls} />,
    children: [
      {
        key: "ajuste",
        label: "Ajuste Rápido",
        icon: <PackagePlus className={iconCls} />,
        show: canEstoque,
        onClick: onAjuste,
      },
    ],
  };

  const config: GroupModel = {
    id: "config",
    label: "Configurações",
    icon: <ShieldCheck className={iconCls} />,
    children: [
      {
        key: "config",
        label: "Impressão",
        icon: <Settings className={iconCls} />,
        show: isMaster,
        active: activeTab === "config",
        onClick: () => onSelectTab("config"),
      },
      {
        key: "pagamento",
        label: "Pagamento",
        icon: <CreditCard className={iconCls} />,
        show: isMaster,
        active: activeTab === "pagamento",
        onClick: () => onSelectTab("pagamento"),
      },
    ],
  };

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
          <SidebarGroupLabel>Painel operacional</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarAccordionGroup group={operacional} defaultOpen />
            <SidebarAccordionGroup group={clientes} defaultOpen={false} />

            {/* Fiscal — acesso direto (master) */}
            {isMaster && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "fiscal"}
                  onClick={() => onSelectTab("fiscal")}
                  className="font-semibold"
                >
                  <ReceiptText className={iconCls} />
                  <span>Fiscal</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarAccordionGroup group={caixaGroup} defaultOpen={false} />
            <SidebarAccordionGroup group={estoque} defaultOpen={false} />
            <SidebarAccordionGroup group={config} defaultOpen={false} />
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
              <span>Bloquear Caixa</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-center gap-1.5 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <img
            src="/logo-triviano.svg"
            alt="Triviano"
            className="h-4 w-auto opacity-70"
          />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            by Triviano
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
