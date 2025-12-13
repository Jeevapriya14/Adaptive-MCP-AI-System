import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: "#e11d48" }}>
          ⚠️ UI crashed. Refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}
