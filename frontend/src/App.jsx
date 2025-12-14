import ErrorBoundary from "./components/ErrorBoundary";
import ChatPage from "./pages/ChatPage";

export default function App() {
  return (
    <ErrorBoundary>
      <ChatPage />
    </ErrorBoundary>
  );
}
