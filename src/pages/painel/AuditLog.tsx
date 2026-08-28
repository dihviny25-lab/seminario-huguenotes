import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, LogIn, Users } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { StatisticCard } from "@/components/StatisticCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAuditActionsFn, listAuditSessionsFn } from "@/functions/auditLog";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatDuration(minutes: number) {
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
}

/** Log de auditoria — quem entrou, quanto tempo ficou e o que fez. Só admin acessa. */
export function AuditLog() {
  const [actorName, setActorName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = {
    actorName: actorName.trim() || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["audit-sessions", filters],
    queryFn: () => listAuditSessionsFn({ data: filters }),
  });
  const { data: actions, isLoading: loadingActions } = useQuery({
    queryKey: ["audit-actions", filters],
    queryFn: () => listAuditActionsFn({ data: filters }),
  });

  const summary = useMemo(() => {
    if (!sessions) return null;
    const teacherLogins = sessions.filter((s) => s.actorType === "teacher").length;
    const studentLogins = sessions.filter((s) => s.actorType === "student").length;
    const openNow = sessions.filter((s) => s.stillOpen).length;
    const avgMinutes =
      sessions.length === 0
        ? 0
        : Math.round(sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length);
    return { teacherLogins, studentLogins, openNow, avgMinutes };
  }, [sessions]);

  return (
    <PainelShell
      title="Auditoria"
      description="Quem entrou no sistema, quanto tempo ficou e o que fez — professores e alunos."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-search">Buscar por nome</Label>
          <Input
            id="audit-search"
            placeholder="Nome do professor ou aluno…"
            value={actorName}
            onChange={(event) => setActorName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">De</Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">Até</Label>
          <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {summary ? (
        <div className="mb-6 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200 lg:grid-cols-4">
          <StatisticCard label="Logins de professores" value={summary.teacherLogins} icon={LogIn} />
          <StatisticCard label="Logins de alunos" value={summary.studentLogins} icon={Users} />
          <StatisticCard label="Sessões abertas agora" value={summary.openNow} icon={Activity} />
          <StatisticCard
            label="Permanência média"
            value={formatDuration(summary.avgMinutes)}
            icon={Clock}
          />
        </div>
      ) : null}

      <Tabs defaultValue="sessoes">
        <TabsList>
          <TabsTrigger value="sessoes">Sessões (login/logout)</TabsTrigger>
          <TabsTrigger value="acoes">Ações no sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="sessoes">
          <div className="overflow-hidden rounded-md border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quem</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Permanência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSessions || !sessions ? (
                  <TableSkeletonRows columns={4} />
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhuma sessão encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session, index) => (
                    <TableRow
                      key={`${session.actorName}-${session.loginAt}-${index}`}
                      className="animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {session.actorName}
                          <Badge variant="outline" className="text-xs">
                            {session.actorType === "teacher" ? "Professor" : "Aluno"}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell>{formatDateTime(session.loginAt)}</TableCell>
                      <TableCell>
                        {session.logoutAt ? (
                          formatDateTime(session.logoutAt)
                        ) : session.stillOpen ? (
                          <Badge>Ainda ativo</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            Sem saída — última atividade {formatDateTime(session.lastSeenAt)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(session.durationMinutes)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="acoes">
          <div className="overflow-hidden rounded-md border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>O que fez</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingActions || !actions ? (
                  <TableSkeletonRows columns={3} />
                ) : actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      Nenhuma ação encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {entry.actorName}
                          <Badge variant="outline" className="text-xs">
                            {entry.actorType === "teacher" ? "Professor" : "Aluno"}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {actions && actions.length === 500 ? (
              <p className="border-t border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                Mostrando as 500 ações mais recentes — use os filtros de data pra refinar.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </PainelShell>
  );
}
