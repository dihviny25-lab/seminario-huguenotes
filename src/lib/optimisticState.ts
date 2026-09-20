/**
 * Substitui uma edição otimista somente quando a requisição concluída ainda
 * representa a revisão mais recente daquela chave.
 */
export function replaceValueIfLatestRevision(
  values: Record<string, string>,
  key: string,
  settledRevision: number,
  latestRevision: number,
  replacement?: string,
): Record<string, string> {
  if (settledRevision !== latestRevision) return values;

  const next = { ...values };
  if (replacement === undefined) delete next[key];
  else next[key] = replacement;
  return next;
}

/**
 * Serializa mutações da mesma chave, sem impedir que chaves independentes
 * sejam salvas em paralelo. Uma falha não bloqueia a próxima mutação da fila.
 */
export function createKeyedSerialExecutor() {
  const queues = new Map<string, Promise<void>>();

  return function runSerially<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key);
    const result = previous ? previous.then(task) : Promise.resolve().then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    queues.set(key, tail);

    return result.finally(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
  };
}
