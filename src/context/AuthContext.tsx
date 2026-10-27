import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Perfil, Sucursal, CajaTurno } from '../types/database';

interface AuthContextType {
  perfil: Perfil | null;
  sucursalActiva: Sucursal | null;
  cajaActiva: CajaTurno | null;
  loading: boolean;
  setSucursalActiva: (sucursal: Sucursal | null) => void;
  recargarCajaActiva: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [sucursalActiva, setSucursalActiva] = useState<Sucursal | null>(null);
  const [cajaActiva, setCajaActiva] = useState<CajaTurno | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfilUsuario = async (userId: string) => {
    const { data: perf } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (perf) {
      setPerfil(perf as Perfil);
      if (perf.sucursal_id) {
        const { data: sucAsignada } = await supabase
          .from('sucursales')
          .select('*')
          .eq('id', perf.sucursal_id)
          .single();
        if (sucAsignada) setSucursalActiva(sucAsignada as Sucursal);
      }
    }
  };

  const recargarCajaActiva = async () => {
    if (!sucursalActiva) {
      setCajaActiva(null);
      return;
    }
    const { data } = await supabase
      .from('cajas_turnos')
      .select('*')
      .eq('sucursal_id', sucursalActiva.id)
      .eq('estado', 'abierta')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle();

    setCajaActiva((data as CajaTurno) || null);
  };

  useEffect(() => {
    async function inicializar() {
      setLoading(true);

      const { data: sucs } = await supabase.from('sucursales').select('*').order('nombre');
      if (sucs && sucs.length > 0 && !sucursalActiva) {
        setSucursalActiva(sucs[0] as Sucursal);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await cargarPerfilUsuario(session.user.id);
      } else {
        setPerfil(null);
      }

      setLoading(false);
    }

    inicializar();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await cargarPerfilUsuario(session.user.id);
      } else {
        setPerfil(null);
        setCajaActiva(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    recargarCajaActiva();
  }, [sucursalActiva]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setCajaActiva(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        perfil,
        sucursalActiva,
        cajaActiva,
        loading,
        setSucursalActiva,
        recargarCajaActiva,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);