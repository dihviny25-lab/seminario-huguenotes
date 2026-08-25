import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TAB_HELP = [
  {
    title: "Aulas",
    text: "Vídeo-aulas da disciplina. Assista até o fim para marcar automaticamente como concluída.",
  },
  {
    title: "Apostila",
    text: "Materiais de leitura enviados pelo professor. Ficam disponíveis a partir da data de início da disciplina.",
  },
  {
    title: "Tarefas",
    text: "Veja o prazo de cada tarefa, envie sua entrega (texto ou arquivo) e acompanhe quando o professor corrigir.",
  },
  {
    title: "Provas",
    text: 'Provas agendadas pelo professor. O cronômetro só começa a contar quando você clica em "Iniciar" — não é um horário fixo igual pra todo mundo.',
  },
  {
    title: "Notas",
    text: "Sua média e frequência nessa disciplina, avaliação por avaliação.",
  },
  {
    title: "Anotações",
    text: 'Anotações pessoais só suas — nem o professor vê. Marque uma como "Dúvida" se quiser publicá-la depois no fórum da turma.',
  },
  {
    title: "Fórum",
    text: "Tire dúvidas e converse com o professor e os colegas dessa disciplina — todo mundo vê e pode responder.",
  },
];

/** Botão de ajuda explicando o que cada aba da página da disciplina faz. */
export function DisciplineHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        title="O que é cada aba?"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-5" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que é cada aba</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {TAB_HELP.map((item) => (
              <div key={item.title}>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
