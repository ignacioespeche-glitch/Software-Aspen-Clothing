import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Shirt,
  Store,
  Coffee,
  ShoppingBag,
  Wrench,
  Pill,
  Laptop,
  Dog,
  Hammer,
  Sparkles,
  Layers,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Warehouse,
  CheckSquare,
  TrendingUp,
  Boxes,
  Users
} from 'lucide-react';

const RUBROS = [
  { id: 'indumentaria', label: 'Indumentaria', icon: Shirt, activo: true },
  { id: 'almacen', label: 'Almacén', icon: Store, activo: false },
  { id: 'gastronomia', label: 'Gastronomía', icon: Coffee, activo: false },
  { id: 'kiosco', label: 'Kiosco', icon: ShoppingBag, activo: false },
  { id: 'servicios', label: 'Servicios', icon: Wrench, activo: false },
  { id: 'farmacia', label: 'Farmacia', icon: Pill, activo: false },
  { id: 'electronica', label: 'Electrónica', icon: Laptop, activo: false },
  { id: 'petshop', label: 'Petshop', icon: Dog, activo: false },
  { id: 'ferreteria', label: 'Ferretería', icon: Hammer, activo: false },
  { id: 'belleza', label: 'Artículos de belleza', icon: Sparkles, activo: false },
  { id: 'accesorios', label: 'Accesorios', icon: Shirt, activo: false },
  { id: 'otro', label: 'Otro', icon: Layers, activo: false }
];

const OBJETIVOS_LISTA = [
  { id: 'ventas', label: 'Organizar mis ventas y punto de venta rápido', icon: TrendingUp, default: true },
  { id: 'stock', label: 'Controlar mi stock con curvas de talles y colores', icon: Boxes, default: true },
  { id: 'caja_ciega', label: 'Delegar tareas a empleados y arqueo ciego de caja', icon: Users, default: true },
  { id: 'senas_cambios', label: 'Controlar señas, reservas y cambios de prendas', icon: Layers, default: true },
  { id: 'tareas_comunicacion', label: 'Coordinar tareas internas y novedades de equipo (Shot Call)', icon: CheckSquare, default: true },
  { id: 'gastos_proveedores', label: 'Registrar gastos fijos y cuentas por pagar a talleres/proveedores', icon: Building2, default: false }
];

export const OnboardingView = () => {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);

  // Paso 1
  const [rubroSeleccionado, setRubroSeleccionado] = useState('indumentaria');

  // Paso 2
  const [objetivos, setObjetivos] = useState<string[]>([
    'ventas',
    'stock',
    'caja_ciega',
    'senas_cambios',
    'tareas_comunicacion'
  ]);

  // Paso 3: Logística
  const [tieneDeposito, setTieneDeposito] = useState(true);
  const [nombreLocal, setNombreLocal] = useState('Local Principal');
  const [nombreDeposito, setNombreDeposito] = useState('Depósito Central');

  // Paso 4: Datos comerciales y usuario
  const [nombreMarca, setNombreMarca] = useState('');
  const [nombreDueno, setNombreDueno] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleObjetivo = (id: string) => {
    setObjetivos((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFinalizarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. Crear el usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim()
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear la cuenta de usuario.');

      const userId = authData.user.id;

      // 2. Crear la fila en la tabla empresas
      const slugGenerado = nombreMarca.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

      const { data: empresaData, error: empError } = await supabase
        .from('empresas')
        .insert({
          nombre: nombreMarca.trim(),
          slug: slugGenerado,
          rubro: rubroSeleccionado,
          modulo_traspasos: tieneDeposito,
          modulo_senas: objetivos.includes('senas_cambios'),
          modulo_cambios: objetivos.includes('senas_cambios'),
          modulo_tareas: objetivos.includes('tareas_comunicacion'),
          modulo_finanzas_gastos: objetivos.includes('gastos_proveedores'),
          activa: true
        })
        .select('id')
        .single();

      if (empError) throw empError;
      const empresaId = empresaData.id;

      // 3. Crear el perfil del usuario administrador
      const { error: perfError } = await supabase.from('perfiles').insert({
        id: userId,
        empresa_id: empresaId,
        nombre: nombreDueno.trim(),
        rol: 'admin',
        activo: true
      });

      if (perfError) throw perfError;

      // 4. Crear las sucursales base (Local y Depósito si tildó logística)
      const { data: sucursalPrincipal, error: suc1Error } = await supabase
        .from('sucursales')
        .insert({
          empresa_id: empresaId,
          nombre: nombreLocal.trim() || 'Local Mostrador',
          activa: true
        })
        .select('id')
        .single();

      if (suc1Error) throw suc1Error;

      if (tieneDeposito) {
        await supabase.from('sucursales').insert({
          empresa_id: empresaId,
          nombre: nombreDeposito.trim() || 'Depósito',
          activa: true
        });
      }

      // 5. Asignarle la sucursal por defecto al perfil
      await supabase
        .from('perfiles')
        .update({ sucursal_id: sucursalPrincipal.id })
        .eq('id', userId);

      // 6. Redirigir al inicio del POS listo para operar
      navigate('/');
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error durante el proceso de alta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-3xl w-full mx-auto space-y-8 my-auto">
        {/* Barra de Progreso */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-500 border-b border-slate-800 pb-3">
          <span>PASO {paso} DE 4</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full transition-all ${
                  i <= paso ? 'bg-sky-400' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* PASO 1: TIPO DE NEGOCIO */}
        {paso === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                ¿Qué tipo de negocio es?
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Esto nos ayuda a configurar funciones específicas para tu rubro.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {RUBROS.map((r) => {
                const Icon = r.icon;
                const seleccionado = rubroSeleccionado === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      if (r.id === 'indumentaria') setRubroSeleccionado(r.id);
                      else alert('Por el momento estamos habilitando tiendas de Indumentaria en este despliegue.');
                    }}
                    className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      seleccionado
                        ? 'bg-sky-500/10 border-sky-400 text-white ring-2 ring-sky-400/20'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${seleccionado ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">{r.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: OBJETIVOS */}
        {paso === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                ¿Cuáles son tus objetivos?
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Seleccioná todas las funciones que quieras habilitar en tu panel.
              </p>
            </div>

            <div className="space-y-2.5">
              {OBJETIVOS_LISTA.map((o) => {
                const Icon = o.icon;
                const activo = objetivos.includes(o.id);
                return (
                  <div
                    key={o.id}
                    onClick={() => toggleObjetivo(o.id)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      activo
                        ? 'bg-sky-500/10 border-sky-500/50 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${activo ? 'text-sky-400' : 'text-slate-500'}`} />
                      <span className="text-xs sm:text-sm font-semibold">{o.label}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                        activo ? 'bg-sky-500 border-sky-400 text-slate-950' : 'border-slate-700'
                      }`}
                    >
                      {activo && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                type="button"
                onClick={() => setPaso(3)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: LOGÍSTICA & DEPÓSITO */}
        {paso === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Distribución y Puntos de Venta
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                ¿Tu marca cuenta con depósito de stock o más de un local a la calle?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setTieneDeposito(true)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  tieneDeposito
                    ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <Warehouse className="w-7 h-7 text-sky-400 mb-2" />
                <h3 className="font-bold text-white text-sm">Sí, manejo Local y Depósito / 2 Locales</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Se activará el módulo de Traspasos para mover prendas entre depósito y mostrador.
                </p>
              </div>

              <div
                onClick={() => setTieneDeposito(false)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  !tieneDeposito
                    ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <Store className="w-7 h-7 text-emerald-400 mb-2" />
                <h3 className="font-bold text-white text-sm">No, es un único punto de venta</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Todo el stock se centralizará en una sola vista sin menús innecesarios de envío.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                  Nombre de tu local / showroom principal
                </label>
                <input
                  type="text"
                  required
                  value={nombreLocal}
                  onChange={(e) => setNombreLocal(e.target.value)}
                  placeholder="Ej. Showroom Centro o Local 1"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {tieneDeposito && (
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                    Nombre del Depósito / Taller
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreDeposito}
                    onChange={(e) => setNombreDeposito(e.target.value)}
                    placeholder="Ej. Depósito Central o Taller"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                type="button"
                onClick={() => setPaso(4)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: DATOS DE LA MARCA & LOGIN */}
        {paso === 4 && (
          <form onSubmit={handleFinalizarRegistro} className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Tu Marca y Acceso
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Completá los datos con los que vas a ingresar al sistema todos los días.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                  Nombre de la Marca / Tienda
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Shot Call"
                  value={nombreMarca}
                  onChange={(e) => setNombreMarca(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                  Tu Nombre y Apellido
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={nombreDueno}
                  onChange={(e) => setNombreDueno(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="juan@shotcall.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setPaso(3)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-black px-7 py-3 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-emerald-900/30"
              >
                {loading ? 'Creando Tienda...' : 'Comenzar a Usar el Software'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};