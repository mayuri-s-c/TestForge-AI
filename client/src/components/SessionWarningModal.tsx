import { useAuth } from '../context/AuthContext';

export function SessionWarningModal() {
  const {
    showSessionWarning,
    secondsRemaining,
    extendSession,
    dismissSessionWarning,
  } = useAuth();

  if (!showSessionWarning) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
      <div className="modal-card">
        <h2 id="session-warning-title">Session Expiring Soon</h2>
        <p>
          Your session will expire in <strong>{secondsRemaining}s</strong>.
          Do you want to continue your session, or will you be logged out shortly?
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={() => void extendSession()}>
            Yes, continue session
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void dismissSessionWarning()}>
            No, log me out
          </button>
        </div>
      </div>
    </div>
  );
}

export function LogoutOverlay() {
  const { isLoggingOut, logoutMessage } = useAuth();

  if (!isLoggingOut || !logoutMessage) {
    return null;
  }

  return (
    <div className="logout-overlay" role="status" aria-live="polite">
      <div className="logout-overlay-card">
        <span className="test-progress-spinner test-progress-spinner-lg" aria-hidden="true" />
        <strong>{logoutMessage}</strong>
      </div>
    </div>
  );
}
