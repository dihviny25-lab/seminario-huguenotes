import { useState, type ComponentProps, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  LayoutGrid,
  Library,
  ListChecks,
  LogOut,
  MessageCircle,
  MessagesSquare,
  PackageOpen,
  Receipt,
  Replace,
  Share2,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getCurrentTeacherFn, logoutFn } from "@/functions/auth";
import { cn } from "@/lib/utils";

const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/minhas-materias", label: "Minhas Matérias", icon: BookOpen },
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  { to: "/painel/forum-interno", label: "Fórum interno", icon: MessagesSquare },
  { to: "/painel/biblioteca", label: "Biblioteca virtual", icon: Library },
  { to: "/painel/apostilas-compartilhadas", label: "Apostilas compartilhadas", icon: Share2 },
  { to: "/painel/relatorio", label: "Boletim do aluno", icon: FileText },
  { to: "/painel/relatorio-modulo", label: "Relatório por módulo", icon: Layers },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;

const adminOnlyNavItems = [
  { to: "/painel/atribuicoes", label: "Atribuição de professores", icon: Replace },
  { to: "/painel/financeiro", label: "Financeiro", icon: BarChart3 },
  { to: "/painel/materiais", label: "Materiais", icon: PackageOpen },
  { to: "/painel/despesas", label: "Despesas", icon: Receipt },
  { to: "/painel/auditoria", label: "Auditoria", icon: ShieldCheck },
] as const;

type NavItem = { to: string; label: string; icon: (typeof painelNavItems)[number]["icon"] };

function isNavItemActive(pathname: string, to: string): boolean {
  return to === "/painel" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function NavItems({ items, pathname }: { items: ReadonlyArray<NavItem>; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton asChild isActive={isNavItemActive(pathname, item.to)}>
            <NavLink to={item.to}>
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** Link de navegação da sidebar — fecha o menu mobile ao navegar (senão o Sheet fica aberto por cima da tela nova). */
function NavLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && isMobile) setOpenMobile(false);
      }}
    />
  );
}

interface PainelShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Usa a largura toda da tela — pra conteúdo que precisa de mais espaço, como o leitor de apostilas. */
  fullWidth?: boolean;
}

/** Estrutura comum das telas internas (protegidas por login): sidebar + conteúdo. */
export function PainelShell({ title, description, children, fullWidth }: PainelShellProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const isAdmin = me?.role === "admin";
  const mainNavItems = isAdmin
    ? painelNavItems.map((item) =>
        item.to === "/painel/minhas-materias" ? { ...item, label: "Materiais do seminário" } : item,
      )
    : painelNavItems;

  async function handleLogout() {
    setSigningOut(true);
    await logoutFn();
    await navigate({ to: "/login" });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <NavLink to="/painel" className="flex items-center gap-2.5 px-1">
            <img src="/logo.png" alt="" className="size-8 shrink-0" aria-hidden />
            <span className="min-w-0 font-display text-sm font-semibold text-sidebar-foreground">
              Seminário Huguenotes
            </span>
          </NavLink>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <NavItems items={mainNavItems} pathname={pathname} />
          </SidebarGroup>
          {isAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>Administração</SidebarGroupLabel>
              <NavItems items={adminOnlyNavItems} pathname={pathname} />
            </SidebarGroup>
          ) : null}
        </SidebarContent>
        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} disabled={signingOut}>
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border/80 bg-background/85 px-4 py-3 backdrop-blur-md md:hidden print:hidden">
          <SidebarTrigger />
          <span className="truncate font-display text-sm font-semibold text-foreground">
            {title}
          </span>
        </header>

        <main
          className={cn(
            "mx-auto w-full px-4 pb-24 pt-10 sm:px-6 sm:pt-10 print:p-0",
            fullWidth ? "max-w-7xl" : "max-w-6xl",
          )}
        >
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground print:hidden">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground print:hidden">
              {description}
            </p>
          ) : null}

          <div className="mt-8">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
