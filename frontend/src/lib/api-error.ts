/** Extrai a mensagem de erro amigável de uma resposta da API. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação",
): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const apiMessage = response?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
