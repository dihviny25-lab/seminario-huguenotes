import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
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
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentTeacherFn, logoutFn } from "@/functions/auth";

const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  { to: "/painel/forum-interno", label: "Fórum interno", icon: MessagesSquare },
  { to: "/painel/biblioteca", label: "Biblioteca virtual", icon: Library },
  { to: "/painel/relatorio", label: "Boletim do aluno", icon: FileText },
  { to: "/painel/relatorio-modulo", label: "Relatório por módulo", icon: Layers },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;

const adminOnlyNavItems = [
  { to: "/painel/financeiro", label: "Financeiro", icon: BarChart3 },
  { to: "/painel/materiais", label: "Materiais", icon: PackageOpen },
  { to: "/painel/despesas", label: "Despesas", icon: Receipt },
  { to: "/painel/auditoria", label: "Auditoria", icon: ShieldCheck },
] as const;

interface PainelShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Estrutura comum das telas internas (protegidas por login): sidebar + conteúdo. */
export function PainelShell({ title, description, children }: PainelShellProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const navItems =
    me?.role === "admin" ? [...painelNavItems, ...adminOnlyNavItems] : painelNavItems;

  async function handleLogout() {
    setSigningOut(true);
    await logoutFn();
    await navigate({ to: "/login" });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <Link to="/painel" className="flex items-center gap-2.5 px-1">
            <img src="/logo.png" alt="" className="size-8 shrink-0" aria-hidden />
            <span className="min-w-0 font-display text-sm font-semibold text-sidebar-foreground">
              Painel do professor
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.to === "/painel"
                    ? pathname === item.to
                    : pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
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
          <span className="font-display text-sm font-semibold text-foreground">
            Painel do professor
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-10 print:p-0">
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
