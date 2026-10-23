import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { QUERY_KEYS } from "@/lib/query-keys";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

/**
 * Usuário autenticado e suas permissões efetivas.
 *
 * As permissões servem apenas para esconder/desabilitar ações na interface.
 * A autorização real é sempre validada pelo backend.
 */
export function useAuth() {
  const query = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: async () => {
      const res = await api.get("/api/v1/auth/me");
      return res.data.data.user as AuthUser;
    },
    staleTime: 5 * 60 * 1000,
  });

  const permissions = query.data?.permissions ?? [];

  return {
    user: query.data ?? null,
    permissions,
    isLoading: query.isLoading,
    can: (permission: string) => permissions.includes(permission),
  };
}
