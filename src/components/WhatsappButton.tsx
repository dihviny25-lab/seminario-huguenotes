import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toWhatsappLink } from "@/lib/whatsapp";
import { messageFor, type WhatsappContext } from "@/lib/whatsappTemplates";

type WhatsappButtonProps = {
  phone: string | null | undefined;
  studentName: string;
  context?: WhatsappContext;
  size?: "sm" | "icon" | "default";
  variant?: "outline" | "ghost" | "default";
  /** Mostra o texto "WhatsApp" ao lado do ícone. Padrão: só o ícone. */
  withLabel?: boolean;
};

/**
 * Botão que abre a conversa do aluno no WhatsApp, opcionalmente com uma mensagem
 * pronta conforme a situação (`context`). Fica desabilitado quando o aluno não
 * tem número cadastrado. Não dispara nada no servidor — só abre o link.
 */
export function WhatsappButton({
  phone,
  studentName,
  context = { kind: "generic" },
  size = "icon",
  variant = "ghost",
  withLabel = false,
}: WhatsappButtonProps) {
  const href = toWhatsappLink(phone, messageFor(context, studentName));
  const label = "Mandar mensagem no WhatsApp";

  if (!href) {
    return (
      <Button
        variant={variant}
        size={withLabel ? size : "icon"}
        disabled
        title="Sem WhatsApp cadastrado"
        aria-label="Sem WhatsApp cadastrado"
      >
        <MessageCircle className="size-4" aria-hidden />
        {withLabel ? "WhatsApp" : null}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={withLabel ? size : "icon"} asChild title={label}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <MessageCircle className="size-4" aria-hidden />
        {withLabel ? "WhatsApp" : null}
      </a>
    </Button>
  );
}
