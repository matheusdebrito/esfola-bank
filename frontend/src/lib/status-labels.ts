/**
 * Rótulos em português para os enums da API.
 *
 * A API trafega os valores técnicos (ex.: `PARTIALLY_PAID`); a tradução
 * fica centralizada aqui para que nenhuma tela exiba o valor em inglês.
 */

export const LOAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  LIQUIDATED: "Liquidado",
  CANCELED: "Cancelado",
  RENEGOTIATED: "Renegociado",
};

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIALLY_PAID: "Parcialmente paga",
  PAID: "Paga",
  OVERDUE: "Atrasada",
  CANCELED: "Cancelada",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registrado",
  REVERSED: "Estornado",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  TRANSFER: "Transferência",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const PERIODICITY_LABELS: Record<string, string> = {
  MONTHLY: "Mensal",
  DAILY: "Diário",
};

export const BILLING_MODEL_LABELS: Record<string, string> = {
  FIXED_INSTALLMENTS: "Parcelas fixas",
  SINGLE_PAYMENT: "Pagamento único",
  VARIABLE: "Variável",
};

export const ROUNDING_MODE_LABELS: Record<string, string> = {
  HALF_UP: "Arredondar para cima",
  HALF_EVEN: "Arredondar para o par",
  DOWN: "Arredondar para baixo",
  UP: "Arredondar para cima",
};

export const CLIENT_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  RG: "RG",
  PROOF_OF_ADDRESS: "Comprovante de endereço",
};

export const CLIENT_DOCUMENT_STATE_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  OPERATOR: "Operador",
  AUDITOR: "Auditor",
};

function labelOf(labels: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "-";
  return labels[value] ?? value;
}

export const loanStatusLabel = (value: string | null | undefined) => labelOf(LOAN_STATUS_LABELS, value);
export const installmentStatusLabel = (value: string | null | undefined) =>
  labelOf(INSTALLMENT_STATUS_LABELS, value);
export const paymentStatusLabel = (value: string | null | undefined) => labelOf(PAYMENT_STATUS_LABELS, value);
export const paymentMethodLabel = (value: string | null | undefined) => labelOf(PAYMENT_METHOD_LABELS, value);
export const periodicityLabel = (value: string | null | undefined) => labelOf(PERIODICITY_LABELS, value);
export const billingModelLabel = (value: string | null | undefined) => labelOf(BILLING_MODEL_LABELS, value);
export const roundingModeLabel = (value: string | null | undefined) => labelOf(ROUNDING_MODE_LABELS, value);
export const clientDocumentTypeLabel = (value: string | null | undefined) =>
  labelOf(CLIENT_DOCUMENT_TYPE_LABELS, value);
export const clientDocumentStateLabel = (value: string | null | undefined) =>
  labelOf(CLIENT_DOCUMENT_STATE_LABELS, value);
export const userRoleLabel = (value: string | null | undefined) => labelOf(USER_ROLE_LABELS, value);
