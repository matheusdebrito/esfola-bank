import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "@/pages/LoginPage";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import ReportsPage from "@/pages/ReportsPage";
import FinancePage from "@/pages/FinancePage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import LoansPage from "@/pages/LoansPage";
import LoanDetailPage from "@/pages/LoanDetailPage";
import PaymentsPage from "@/pages/PaymentsPage";
import InstallmentsPage from "@/pages/InstallmentsPage";
import DefaultsPage from "@/pages/DefaultsPage";
import AuditPage from "@/pages/AuditPage";
import UsersPage from "@/pages/UsersPage";
import FinancialPoliciesPage from "@/pages/FinancialPoliciesPage";
import NotFoundPage from "@/pages/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/:clientId" element={<ClientDetailPage />} />
              <Route path="loans" element={<LoansPage />} />
              <Route path="loans/:loanId" element={<LoanDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="installments" element={<InstallmentsPage />} />
              <Route path="defaults" element={<DefaultsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="financial-policies" element={<FinancialPoliciesPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster />
        </QueryClientProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
