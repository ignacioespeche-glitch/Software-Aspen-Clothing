import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Sucursal } from '../types/database';
import { Lock, Mail, User, Store, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const LoginView = () => {
  const navigate = useNavigate();
  const [esRegistro, setEsRegistro] = useState(false);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [rol, setRol] = useState<'vendedor' | 'admin'>('vendedor');

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  useEffect(() => {
    supabase.from('sucursales').select('*').order('nombre').then(({ data }) => {
      if (data) {
        setSucursales(data as Sucursal[]);
        if (data.length > 0) setSucursalId(data[0].id);
      }
    });
  }, []);

  const validarEmail = (correo: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    if (!validarEmail(email)) {
      setMensaje({ tipo: 'error', texto: 'Por favor, ingresá un correo electrónico válido.' });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setMensaje({
          tipo: 'error',
          texto: 'Tu correo aún no fue confirmado. Revisá tu casilla de mail y hacé clic en el link de verificación.'
        });
      } else if (error.message.includes('Invalid login credentials')) {
        setMensaje({ tipo: 'error', texto: 'Credenciales inválidas. Verificá email y contraseña.' });
      } else {
        setMensaje({ tipo: 'error', texto: error.message });
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (perfil && !perfil.activo) {
        await supabase.auth.signOut();
        setMensaje({
          tipo: 'error',
          texto: 'Tu cuenta está pendiente de aprobación por el Administrador de Aspen Clothing.'
        });
        setLoading(false);
        return;
      }

      navigate('/');
    }
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    if (!validarEmail(email)) {
      setMensaje({ tipo: 'error', texto: 'Debes ingresar un formato de email real y verídico.' });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setMensaje({ tipo: 'error', texto: 'La contraseña debe tener un mínimo de 8 caracteres.' });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          rol,
          sucursal_id: rol === 'admin' ? null : sucursalId,
        },
        emailRedirectTo: window.location.origin + '/login',
      }
    });

    if (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } else {
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMensaje({
          tipo: 'error',
          texto: 'Ese correo ya está registrado en el sistema. Probá iniciando sesión.'
        });
      } else {
        setMensaje({
          tipo: 'exito',
          texto: 'Te enviamos un enlace de confirmación a tu casilla de correo. Confirmalo para que el Administrador pueda habilitarte.'
        });
        setEsRegistro(false);
        setEmail('');
        setPassword('');
        setNombre('');
        setApellido('');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-black tracking-widest uppercase text-white">
          Aspen Clothing
        </h1>
        <p className="text-xs text-sky-400 font-semibold tracking-wider uppercase mt-1">
          Sistema Central de Mostrador & Inventario
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6">
        <div className="border-b border-slate-800 pb-4 text-center">
          <h2 className="text-lg font-bold text-white">
            {esRegistro ? 'Registro de Personal' : 'Iniciar Sesión'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {esRegistro
              ? 'Completá tus datos reales para solicitar acceso'
              : 'Ingresá con tu cuenta autorizada'}
          </p>
        </div>

        {mensaje && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 ${
              mensaje.tipo === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            {mensaje.tipo === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        <form onSubmit={esRegistro ? handleRegistro : handleLogin} className="space-y-4">
          {esRegistro && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Nombre</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Lucas"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Gómez"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Rol</label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white capitalize focus:outline-none"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {rol === 'vendedor' && (
                  <div>
                    <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Sucursal</label>
                    <div className="relative">
                      <Store className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-500" />
                      <select
                        value={sucursalId}
                        onChange={(e) => setSucursalId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-2 text-xs text-white focus:outline-none"
                      >
                        {sucursales.map((s) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Email Real / Verídico</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="tu.correo@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="password"
                required
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-950 font-black py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? 'Procesando...' : esRegistro ? 'Registrarme' : 'Ingresar al Mostrador'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setEsRegistro(!esRegistro);
              setMensaje(null);
            }}
            className="text-xs text-slate-400 hover:text-sky-400 font-medium cursor-pointer transition-colors"
          >
            {esRegistro ? '¿Ya tenés cuenta? Iniciar Sesión' : '¿Nuevo vendedor? Registrarse'}
          </button>
        </div>
      </div>
    </div>
  );
};