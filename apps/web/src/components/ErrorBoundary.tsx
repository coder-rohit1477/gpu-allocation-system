import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button, Card } from "@gpu/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors in whatever page is currently mounted under it
 * (App.tsx remounts this per-route via `key={pathname}`, so a crash on one
 * page never leaves a stale fallback showing on the next). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[web] page crashed:", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <Card className="error-boundary" role="alert">
          <h2>Something went wrong</h2>
          <p>This page hit an unexpected error. You can try reloading it.</p>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
