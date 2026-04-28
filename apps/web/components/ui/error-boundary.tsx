import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveringChunk: boolean;
}

const CHUNK_RECOVERY_KEY = "corevia.chunk-recovery-attempted";

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name || ""} ${error.message || ""}`.toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror")
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, recoveringChunk: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);

    if (isChunkLoadError(error)) {
      const alreadyRecovered = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "true";
      if (!alreadyRecovered) {
        window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, "true");
        this.setState({ recoveringChunk: true }, () => {
          window.location.reload();
        });
      }
    }
  }

  handleRetry = (): void => {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null, recoveringChunk: false });
  };

  handleGoHome = (): void => {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    this.setState({ hasError: false, error: null, errorInfo: null, recoveringChunk: false }, () => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {this.state.recoveringChunk ? "Refreshing Corevia" : "Something went wrong"}
              </CardTitle>
              <CardDescription>
                {this.state.error && isChunkLoadError(this.state.error)
                  ? "A new version is available. Corevia is refreshing the page so the latest modules load correctly."
                  : "An unexpected error occurred. Please try again or contact support if the issue persists."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {this.state.error && (
                <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground font-mono overflow-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return ComponentWithErrorBoundary;
}

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  title?: string;
  description?: string;
}

export function BusinessCaseErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Business Case Error</CardTitle>
          <CardDescription>
            There was an error loading the business case. Your data is safe.
          </CardDescription>
        </CardHeader>
        {error && (
          <CardContent>
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground font-mono overflow-auto max-h-32">
              {error.message}
            </div>
          </CardContent>
        )}
        {resetErrorBoundary && (
          <CardFooter className="flex gap-3 justify-center">
            <Button variant="outline" onClick={resetErrorBoundary}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default ErrorBoundary;
