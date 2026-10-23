import * as React from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erro não tratado na interface:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <h1 className="text-xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado na interface. Você pode recarregar a página para continuar.
            </p>
            <pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
