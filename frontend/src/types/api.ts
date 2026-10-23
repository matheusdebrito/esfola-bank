export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  name: string;
  cpf: string;
  cpfMasked: string;
  phone: string | null;
  birthDate: string;
  cep: string;
  address: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientDocument = {
  id: string;
  clientId: string;
  type: "RG" | "PROOF_OF_ADDRESS";
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  state: string;
  uploadedBy: string | null;
  uploadedAt: string;
  downloadUrl: string;
};

export type Loan = {
  id: string;
  code: string;
  clientId: string;
  clientName: string | null;
  clientCpfMasked: string | null;
  userId: string;
  userName: string | null;
  policyId: string | null;
  policyName: string | null;
  grantedAt: string | null;
  principalAmount: number;
  interestRatePercent: number;
  periodicity: "MONTHLY" | "DAILY";
  billingModel: string;
  installmentCount: number | null;
  startDate: string | null;
  dueDate: string | null;
  contractTerms: string | null;
  status: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: Payment[];
};

export type Installment = {
  id: string;
  loanId: string;
  loanCode: string | null;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  number: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  chargesDue: number;
  totalDue: number;
  paidAmount: number;
  remainingBalance: number;
  status: string;
  effectiveStatus: string;
  isOverdue: boolean;
  daysOverdue: number;
  lateCharges: {
    lateFee: number;
    lateInterest: number;
    totalLateCharges: number;
  } | null;
};

export type Payment = {
  id: string;
  clientId: string;
  loanId: string;
  loanCode?: string | null;
  userId: string;
  userName: string | null;
  receivedAmount: number;
  receivedAt: string;
  registeredAt: string;
  method: string;
  reference: string | null;
  observations: string | null;
  idempotencyKey: string | null;
  status: string;
  allocations?: {
    id: string;
    installmentId: string;
    installmentNumber: number;
    allocatedAmount: number;
  }[];
  installments?: number[];
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  userId: string | null;
  user: { id: string; name: string; email: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: any;
  newValues: any;
  metadata: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type FinancialPolicy = {
  id: string;
  name: string;
  description: string | null;
  interestRatePercent: number;
  lateFeeAmount: number;
  dailyLateInterestPercent: number;
  roundingMode: string;
  toleranceDays: number;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMonthly = {
  totalGranted: number;
  activeClients: number;
  receivableThisMonth: number;
  dueInstallmentsThisMonth: number;
  overdueInstallmentsThisMonth: number;
  overdueAmountThisMonth: number;
  currentInstallmentsThisMonth: number;
  monthStart: string;
  monthEnd: string;
};

export type DashboardOverview = {
  totalGranted: number;
  openPortfolio: number;
  receivedTotal: number;
  interestReceived: number;
  overdueAmount: number;
  activeLoans: number;
  activeClients: number;
  dueToday: number;
  dueNext7Days: number;
  overdueInstallments: number;
  delinquencyRate: number;
  receivableInPeriod: number;
  receiptsSeries: { day: string; received: number }[];
  financialFlow: { month: string; granted: number; received: number; predicted: number }[];
  portfolioComposition: { name: string; value: number }[];
  installmentStatus: { paid: number; pending: number; partiallyPaid: number; overdue: number; canceled: number };
  aging: { bucket: string; amount: number; count: number }[];
  topClients: { clientId: string; clientName: string; outstandingBalance: number; overdueAmount: number }[];
  upcomingDue: {
    clientId: string;
    clientName: string;
    loanCode: string;
    installmentNumber: number;
    dueDate: string;
    remainingBalance: number;
    status: string;
  }[];
  overdueList: {
    clientId: string;
    clientName: string;
    loanCode: string;
    installmentNumber: number;
    dueDate: string;
    remainingBalance: number;
    daysOverdue: number;
  }[];
};
export type Paged<T> = {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type ApiError = {
  error: boolean;
  message: string;
  code?: string;
  statusCode: number;
  details?: unknown;
};
