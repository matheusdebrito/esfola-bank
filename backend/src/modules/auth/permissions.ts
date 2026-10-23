export const PERMISSIONS = {
  // Clientes
  CLIENT_READ: "clients:read",
  CLIENT_CREATE: "clients:create",
  CLIENT_UPDATE: "clients:update",
  CLIENT_DEACTIVATE: "clients:deactivate",
  CLIENT_DELETE: "clients:delete",
  // Documentos
  DOCUMENT_READ: "documents:read",
  DOCUMENT_UPLOAD: "documents:upload",
  DOCUMENT_DOWNLOAD: "documents:download",
  DOCUMENT_REMOVE: "documents:remove",
  // Empréstimos
  LOAN_READ: "loans:read",
  LOAN_CREATE: "loans:create",
  LOAN_UPDATE: "loans:update",
  LOAN_STATUS_CHANGE: "loans:status_change",
  LOAN_DELETE: "loans:delete",
  // Parcelas
  INSTALLMENT_READ: "installments:read",
  // Pagamentos
  PAYMENT_READ: "payments:read",
  PAYMENT_REGISTER: "payments:register",
  PAYMENT_REVERSE: "payments:reverse",
  // Usuários
  USER_READ: "users:read",
  USER_CREATE: "users:create",
  USER_UPDATE: "users:update",
  USER_STATUS_CHANGE: "users:status_change",
  PERMISSION_MANAGE: "permissions:manage",
  // Auditoria
  AUDIT_READ: "audit:read",
  // Dashboards/relatórios
  DASHBOARD_READ: "dashboards:read",
  REPORT_EXPORT: "reports:export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const rolePermissions: Record<string, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.CLIENT_DEACTIVATE,
    PERMISSIONS.CLIENT_DELETE,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_DOWNLOAD,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.INSTALLMENT_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_REGISTER,
    PERMISSIONS.USER_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  OPERATOR: [
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_DOWNLOAD,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.INSTALLMENT_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_REGISTER,
    PERMISSIONS.DASHBOARD_READ,
  ],
  AUDITOR: [
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_DOWNLOAD,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.INSTALLMENT_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
