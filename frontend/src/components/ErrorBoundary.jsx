import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NITI ErrorBoundary Caught Error]:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4fbf7] flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-emerald-100 space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl font-black">
              🌱
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              NITI Platform Ready
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Something went wrong while rendering this view. Click below to refresh or reset to the default view.
            </p>
            {this.state.error && (
              <pre className="text-[11px] bg-red-50 text-red-700 p-3 rounded-xl overflow-x-auto text-left max-h-32 border border-red-200">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                Reload App
              </button>
              <button
                onClick={this.handleReset}
                className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
