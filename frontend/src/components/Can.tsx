import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Renderiza os filhos apenas quando o usuário autenticado possui a permissão.
 * Nunca substitui a validação do backend — é apenas controle de interface.
 */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
