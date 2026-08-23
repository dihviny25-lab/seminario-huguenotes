import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Library,
  ListChecks,
  LogOut,
  MessageCircle,
  Video,
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
import { getCurrentStudentFn, studentLogoutFn } from "@/functions/studentAuth";
import { toDisplayFirstName } from "@/lib/formatName";
import { cn } from "@/lib/utils";

interface PortalShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Usa a largura toda da tela — pra conteúdo que precisa de mais espaço, como o leitor de livros. */
  fullWidth?: boolean;
}

const portalNavItems = [
  { to: "/portal/disciplinas", label: "Minhas disciplinas", icon: GraduationCap },
  { to: "/portal", label: "Minhas notas", icon: ClipboardList },
  { to: "/portal/provas", label: "Provas", icon: FileCheck2 },
  { to: "/portal/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/portal/videos", label: "Vídeo-aulas", icon: Video },
  { to: "/portal/apostilas", label: "Apostilas", icon: BookOpen },
  { to: "/portal/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/portal/forum", label: "Fórum", icon: MessageCircle },
  { to: "/portal/discipulado", label: "Discipulado", icon: HeartHandshake },
  { to: "/portal/mensalidades", label: "Mensalidades", icon: Wallet },
] as const;

/** Cabeçalho do portal do aluno — login protegido: sidebar + conteúdo. */
export function PortalShell({ title, description, children, fullWidth }: PortalShellProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const { data: student } = useQuery({
    queryKey: ["current-student"],
    queryFn: () => getCurrentStudentFn(),
  });

  async function handleLogout() {
    setSigningOut(true);
    await studentLogoutFn();
    await navigate({ to: "/login-aluno" });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center gap-2.5 px-1">
            <img src="/logo.png" alt="" className="size-8 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
                {student ? `Olá, ${toDisplayFirstName(student.name)}` : "Portal do aluno"}
              </span>
              <span className="block text-xs text-sidebar-foreground/70">Portal do aluno</span>
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {portalNavItems.map((item) => {
                const isActive =
                  item.to === "/portal"
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
            Portal do aluno
          </span>
        </header>

        <main
          className={cn(
            "mx-auto w-full px-4 pb-24 pt-10 sm:px-6 sm:pt-10 print:p-0",
            fullWidth ? "max-w-7xl" : "max-w-4xl",
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
