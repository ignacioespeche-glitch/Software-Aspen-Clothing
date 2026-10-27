import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Sucursal } from '../types/database';
import {
  Store,
  ShoppingCart,
  DollarSign,
  BookmarkCheck,
  RotateCcw,
  Boxes,
  ArrowLeftRight,
  ShieldAlert,
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';

export const Navbar = () => {
  const { perfil, sucursalActiva, setSucursalActiva, cajaActiva, cerrarSesion } = useAuth();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    supabase.from('sucursales').select('*').order('nombre').then(({ data }) => {
      if (data) setSucursales(data as Sucursal[]);
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const esAdmin = perfil?.rol === 'admin';

  return (
    <header className="bg-slate-950 border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-40 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-black text-base tracking-widest text-white">ASPEN</span>
          <span className="text-[10px] bg-slate-900 text-sky-400 font-mono px-1.5 py-0.5 rounded border border-slate-800">
            v1.0
          </span>
        </div>

        {/* SELECTOR O INSIGNIA FIJA SEGÚN EL ROL */}
        {esAdmin ? (
          <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200">
            <Store className="w-3.5 h-3.5 text-sky-400 mr-1.5 shrink-0" />
            <select
              value={sucursalActiva?.id || ''}
              onChange={(e) => {
                const encontrada = sucursales.find((s) => s.id === e.target.value);
                if (encontrada) setSucursalActiva(encontrada);
              }}
              className="bg-transparent font-bold text-xs text-white focus:outline-none cursor-pointer pr-4"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center bg-slate-900/90 border border-slate-800/80 rounded-lg px-3 py-1.5 text-slate-200">
            <Store className="w-3.5 h-3.5 text-sky-400 mr-2 shrink-0" />
            <span className="font-bold text-xs text-white">
              {sucursalActiva?.nombre || 'Mi Sucursal'}
            </span>
          </div>
        )}

        {/* NAVEGACIÓN PRINCIPAL */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Punto de Venta
          </NavLink>

          <NavLink
            to="/caja"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <DollarSign className="w-3.5 h-3.5" />
            Caja & Turnos
          </NavLink>

          <NavLink
            to="/reservas"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            Señas
          </NavLink>

          <NavLink
            to="/cambios"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Cambios
          </NavLink>

          <NavLink
            to="/catalogo"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <Boxes className="w-3.5 h-3.5" />
            Inventario
          </NavLink>

          <NavLink
            to="/traspasos"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Traspasos
          </NavLink>

          {esAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                  isActive ? 'bg-sky-500 text-slate-950 font-bold' : 'text-sky-400 hover:bg-sky-500/10'
                }`
              }
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Panel Admin
            </NavLink>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* ESTADO DE CONEXIÓN */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span>{online ? 'Online' : 'Offline'}</span>
        </div>

        {/* ESTADO DE CAJA */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            cajaActiva ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cajaActiva ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span>{cajaActiva ? 'Caja Abierta' : 'Caja Cerrada'}</span>
        </div>

        {/* PERFIL & LOGOUT */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
          <div className="text-right leading-tight">
            <p className="font-bold text-slate-200 text-xs">
              {perfil?.nombre} {perfil?.apellido || ''}
            </p>
            <p className="text-[10px] text-sky-400 uppercase font-bold">{perfil?.rol}</p>
          </div>

          <button
            onClick={cerrarSesion}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};