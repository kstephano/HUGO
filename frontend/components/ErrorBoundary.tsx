"use client";
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-full text-red-500 p-8">
            <div className="text-center">
              <p className="font-semibold mb-2">Something went wrong</p>
              <p className="text-sm text-gray-500">{this.state.message}</p>
              <button
                className="mt-4 px-4 py-2 text-sm bg-red-100 rounded hover:bg-red-200"
                onClick={() => this.setState({ hasError: false, message: "" })}
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
