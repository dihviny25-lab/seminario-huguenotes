import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selfScheduleMyChargesFn } from "@/functions/payments";
import { computeDiscountedAmount } from "@/lib/payments";
import { PAYMENT_MODALITIES, PUNCTUALITY_DISCOUNT_PERCENT } from "@/lib/paymentModalities";

function formatAmount(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const schema = z.object({
  modalityId: z.string().min(1, "Escolha sua modalidade."),
  dueDay: z.coerce.number().int().min(1, "Escolha um dia.").max(31, "Máximo 31."),
});

export function SelfScheduleChargesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { modalityId: "", dueDay: 10 },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => selfScheduleMyChargesFn({ data: values }),
    onSuccess: async (result) => {
      const skippedNote =
        result.skippedPeriods.length > 0
          ? `, ${result.skippedPeriods.length} mês(es) já estavam cobrados`
          : "";
      toast.success(`${result.created} mensalidade(s) gerada(s) até o fim do curso${skippedNote}.`);
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["my-charges"] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Não foi possível gerar suas mensalidades.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar minhas mensalidades</DialogTitle>
          <DialogDescription>
            Escolha sua modalidade e o dia do mês que prefere pagar — o sistema gera automaticamente
            todas as mensalidades até o fim do curso.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="modalityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modalidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha sua modalidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_MODALITIES.map((modality) => (
                        <SelectItem key={modality.id} value={modality.id}>
                          {modality.name} — {formatAmount(modality.fullValue)} cheio /{" "}
                          {formatAmount(
                            computeDiscountedAmount(
                              modality.fullValue,
                              PUNCTUALITY_DISCOUNT_PERCENT,
                            ),
                          )}{" "}
                          pontual
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia do vencimento</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Gerando…" : "Gerar mensalidades"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
