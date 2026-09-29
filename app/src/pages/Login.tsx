import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui';
import { useAuth } from '../state/Auth';

export default function Login() {
  const { login, error: sessionError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={submit} className="panel stack" style={{ width: 'min(400px, 100%)', gap: 16, padding: 28 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="brand-mark">S</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>siregg</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>Inicia sesión para ver los gastos de tu organización.</p>
        <div className="field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input id="login-email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-pass">Contraseña</label>
          <input id="login-pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {(error || sessionError) && <div role="alert" className="row" style={{ gap: 8, color: 'var(--color-accent-2-700)', fontSize: 14 }}><Icon n="ph-warning-circle" />{error || sessionError}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}

export function NoCompanies() {
  const { logout } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel stack" style={{ width: 'min(420px, 100%)', gap: 14, padding: 28 }}>
        <strong style={{ fontSize: 18 }}>Sin organizaciones asignadas</strong>
        <p className="muted" style={{ margin: 0 }}>Tu usuario todavía no pertenece a ninguna empresa. Pide a un administrador que te agregue.</p>
        <button className="btn btn-secondary" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
