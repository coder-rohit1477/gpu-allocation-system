import { Component } from 'react';

/**
 * Catches render-time exceptions in child component trees.
 * Without this, a single JS error crashes the entire app to a white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <AdminDashboard />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production swap this for a real error-reporting service (Sentry, etc.)
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 32,
        fontFamily: "'Source Sans 3', sans-serif",
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 20, color: 'rgb(14,34,64)' }}>
          Something went wrong
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'rgb(74,88,110)', textAlign: 'center', maxWidth: 420 }}>
          An unexpected error occurred in this section. Your session and data are safe.
        </p>
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            fontSize: 11, background: '#fef2f2', color: '#991b1b',
            padding: '12px 16px', borderRadius: 8, maxWidth: 600,
            overflowX: 'auto', textAlign: 'left',
          }}>
            {this.state.error.toString()}
          </pre>
        )}
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            padding: '10px 24px', background: 'rgb(14,34,64)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
