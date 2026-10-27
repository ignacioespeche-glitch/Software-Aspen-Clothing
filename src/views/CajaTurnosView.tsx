import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export const CajaTurnosView = () => {
  const { perfil, sucursalActiva, cajaActiva, recargarCajaActiva } = useAuth();
  
  const [montoInicial, setMontoInicial] = useState('');
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [montoGasto, setMontoGasto] = useState('');
  const [motivoGasto, setMotivoGasto] = useState('');
  const [tipoGasto, setTipoGasto] = useState<'egreso' | 'ingreso_extra'>('egreso');
  const [montoDeclarado, setMontoDeclarado] = useState('');
  const [arqueoCerrado, setArqueoCerrado] = useState<any | null>(null);

  useEffect(() => {
    if (cajaActiva) {
      cargarMovimientos();
    }
  }, [cajaActiva]);

  const cargarMovimientos = async () => {
    if (!cajaActiva) return;
    const { data } = await supabase
      .from('movimientos_caja_chica')
      .select('*')
      .eq('caja_turno_id', cajaActiva.id)
      .order('created_at', { ascending: false });
    if (data) setMovimientos(data);
  };

  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursalActiva || !montoInicial || !perfil) {
      alert('Debes tener una sucursal activa y una sesión iniciada para abrir caja.');
      return;
    }

    const { error } = await supabase.from('cajas_turnos').insert({
      sucursal_id: sucursalActiva.id,
      vendedor_id: perfil.id,
      monto_inicial_efectivo: parseFloat(montoInicial),
      estado: 'abierta'
    });

    if (error) {
      alert('Error al abrir caja: ' + error.message);
    } else {
      setMontoInicial('');
      recargarCajaActiva();
    }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActiva || !montoGasto || !motivoGasto) return;

    const { error } = await supabase.from('movimientos_caja_chica').insert({
      caja_turno_id: cajaActiva.id,
      tipo: tipoGasto,
      monto: parseFloat(montoGasto),
      motivo: motivoGasto
    });

    if (error) {
      alert('Error registrando movimiento: ' + error.message);
    } else {
      setMontoGasto('');
      setMotivoGasto('');
      cargarMovimientos();
    }
  };

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActiva || !montoDeclarado) return;

    const { data: ventas } = await supabase
      .from('ventas')
      .select('total_final, metodo_pago, detalles_pago')
      .eq('caja_turno_id', cajaActiva.id)
      .eq('estado', 'completada');

    let ventasEfectivo = 0;
    ventas?.forEach((v) => {
      if (v.metodo_pago === 'efectivo') ventasEfectivo += Number(v.total_final);
      if (v.metodo_pago === 'mixto' && v.detalles_pago?.efectivo) {
        ventasEfectivo += Number(v.detalles_pago.efectivo);
      }
    });

    const sumaIngresosExtra = movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const sumaEgresos = movimientos
      .filter((m) => m.tipo === 'egreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const esperado = Number(cajaActiva.monto_inicial_efectivo) + ventasEfectivo + sumaIngresosExtra - sumaEgresos;
    const declarado = parseFloat(montoDeclarado);
    const dif = declarado - esperado;

    const { error } = await supabase
      .from('cajas_turnos')
      .update({
        fecha_cierre: new Date().toISOString(),
        monto_cierre_declarado: declarado,
        monto_cierre_esperado: esperado,
        diferencia: dif,
        estado: 'cerrada'
      })
      .eq('id', cajaActiva.id);

    if (error) {
      alert('Error cerrando caja: ' + error.message);
    } else {
      setArqueoCerrado({ declarado, esperado, dif });
      recargarCajaActiva();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          Control de Caja & Turno — {sucursalActiva?.nombre}
        </h1>
        <p className="text-sm text-slate-400">Apertura, movimientos de caja chica y arqueo ciego de cierre.</p>
      </div>

      {!cajaActiva ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-lg mx-auto">
          <h2 className="text-lg font-bold text-white mb-2">Apertura de Caja</h2>
          <p className="text-xs text-slate-400 mb-6">Ingresá el efectivo inicial físico disponible en el cajón.</p>

          <form onSubmit={handleAbrirCaja} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Monto Inicial en Efectivo ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="Ej. 15000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Abrir Turno de Caja
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Turno Activo</span>
              <div className="mt-2 flex justify-between items-baseline">
                <div>
                  <p className="text-xs text-slate-400">Apertura</p>
                  <p className="text-sm font-medium text-slate-200">
                    {new Date(cajaActiva.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Fondo Inicial</p>
                  <p className="text-xl font-bold text-emerald-400">${Number(cajaActiva.monto_inicial_efectivo).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Registrar Movimiento de Caja Chica</h3>
              <form onSubmit={handleRegistrarMovimiento} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoGasto('egreso')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                      tipoGasto === 'egreso'
                        ? 'bg-rose-500/10 border-rose-500/50 text-rose-400'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" /> Egreso / Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoGasto('ingreso_extra')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                      tipoGasto === 'ingreso_extra'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" /> Ingreso Extra
                  </button>
                </div>

                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Monto ($)"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />

                <input
                  type="text"
                  required
                  placeholder="Motivo (ej. Cinta, Bolsas, Limpieza, Viáticos)"
                  value={motivoGasto}
                  onChange={(e) => setMotivoGasto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Registrar Movimiento
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Movimientos del Turno</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {movimientos.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay movimientos registrados en este turno.</p>
                ) : (
                  movimientos.map((m) => (
                    <div key={m.id} className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-200">{m.motivo}</p>
                        <p className="text-slate-500">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</p>
                      </div>
                      <span className={`font-bold ${m.tipo === 'egreso' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {m.tipo === 'egreso' ? '-' : '+'}${Number(m.monto).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-2">Cierre de Caja (Arqueo Ciego)</h3>
              <p className="text-xs text-slate-400 mb-4">Contá el dinero físico del cajón e ingresá el total sin ver el cálculo del sistema.</p>

              <form onSubmit={handleCerrarCaja} className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Efectivo físico declarado ($)"
                  value={montoDeclarado}
                  onChange={(e) => setMontoDeclarado(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />

                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Confirmar y Cerrar Caja
                </button>
              </form>

              {arqueoCerrado && (
                <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Efectivo Declarado:</span>
                    <span className="font-semibold text-white">${arqueoCerrado.declarado.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Efectivo Esperado:</span>
                    <span className="font-semibold text-white">${arqueoCerrado.esperado.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1">
                    <span className="font-bold text-slate-200">Diferencia:</span>
                    <span className={`font-bold ${arqueoCerrado.dif < 0 ? 'text-rose-400' : arqueoCerrado.dif > 0 ? 'text-sky-400' : 'text-emerald-400'}`}>
                      {arqueoCerrado.dif === 0 ? 'Exacto ($0)' : `${arqueoCerrado.dif > 0 ? '+' : ''}$${arqueoCerrado.dif.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};