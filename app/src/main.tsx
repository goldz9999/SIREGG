import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@phosphor-icons/web/duotone';
import './styles/base.css';
import './styles/theme.css';
import './styles/app.css';
import Layout from './components/Layout';
import Categorias from './pages/Categorias';
import Comprobantes from './pages/Comprobantes';
import { ConfigEmpresa, ConfigPersonal } from './pages/Configuracion';
import Dashboard from './pages/Dashboard';
import Gastos from './pages/Gastos';
import Proveedores from './pages/Proveedores';
import Proyectos from './pages/Proyectos';
import Reportes from './pages/Reportes';
import Revision from './pages/Revision';
import Usuarios from './pages/Usuarios';
import { AppStateProvider, useApp } from './state/AppState';

function Home() {
  const { lastPage } = useApp();
  return <Navigate to={'/' + lastPage} replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="revision" element={<Revision />} />
            <Route path="gastos" element={<Gastos />}>
              <Route path=":id" element={null} />
            </Route>
            <Route path="comprobantes" element={<Comprobantes />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="empresa" element={<ConfigEmpresa />} />
            <Route path="personal" element={<ConfigPersonal />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  </StrictMode>,
);
