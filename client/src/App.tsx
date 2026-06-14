import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardApp from './DashboardApp';
import { LoginPage } from './components/LoginPage';
import { LogoutOverlay, SessionWarningModal } from './components/SessionWarningModal';

function AppGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-backdrop" />
        <div className="login-card login-loading">
          <span className="test-progress-spinner test-progress-spinner-lg" aria-hidden="true" />
          <strong>Loading session...</strong>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <>
          <DashboardApp />
          <SessionWarningModal />
        </>
      ) : (
        <LoginPage />
      )}
      <LogoutOverlay />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
