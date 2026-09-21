'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in component boundary:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="bg-destructive/5 border-destructive/20 text-foreground flex flex-col items-center justify-center rounded-xl border p-6 text-center shadow-xs"
        >
          <div className="bg-destructive/10 text-destructive mb-3 flex h-10 w-10 items-center justify-center rounded-full">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {this.props.fallbackTitle || 'Dieser Bereich konnte nicht geladen werden'}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md text-xs">
            {this.props.fallbackDescription ||
              'Es ist ein unerwarteter Darstellungsfehler aufgetreten. Der restliche Vorgang bleibt intakt.'}
          </p>
          {this.state.error?.message && (
            <pre className="bg-muted/60 text-muted-foreground text-2xs mt-2 max-w-full overflow-x-auto rounded px-2.5 py-1 font-mono">
              {this.state.error.message}
            </pre>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={this.handleReset}
            className="mt-4"
          >
            Erneut versuchen
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
