import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Perfil, Sucursal, CajaTurno, Empresa } from '../types/database';

interface AuthContextType {
  perfil: Perfil | null;
  empresa: Empresa | null;
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
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [sucursalActiva, setSucursalActiva] = useState<Sucursal | null>(null);
  const [cajaActiva, setCajaActiva] = useState<CajaTurno | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfilYEntorno = async (userId: string) => {
    const { data: perf } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!perf) return;

    setPerfil(perf as Perfil);

    // Cargar datos de la empresa vinculada
    if (perf.empresa_id) {
      const { data: empData } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', perf.empresa_id)
        .maybeSingle();

      if (empData) setEmpresa(empData as Empresa);

      // Cargar solo las sucursales de esta empresa
      const { data: sucsEmpresa } = await supabase
        .from('sucursales')
        .select('*')
        .eq('empresa_id', perf.empresa_id)
        .order('nombre');

      if (sucsEmpresa && sucsEmpresa.length > 0) {
        if (perf.sucursal_id) {
          const sucAsignada = sucsEmpresa.find((s) => s.id === perf.sucursal_id);
          setSucursalActiva((sucAsignada as Sucursal) || (sucsEmpresa[0] as Sucursal));
        } else {
          setSucursalActiva(sucsEmpresa[0] as Sucursal);
        }
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

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await cargarPerfilYEntorno(session.user.id);
      } else {
        setPerfil(null);
        setEmpresa(null);
        setSucursalActiva(null);
      }

      setLoading(false);
    }

    inicializar();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await cargarPerfilYEntorno(session.user.id);
      } else {
        setPerfil(null);
        setEmpresa(null);
        setSucursalActiva(null);
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
    setEmpresa(null);
    setSucursalActiva(null);
    setCajaActiva(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        perfil,
        empresa,
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