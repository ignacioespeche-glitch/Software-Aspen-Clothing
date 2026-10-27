import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  RefreshCw, 
  AlertOctagon, 
  CheckCircle2 
} from 'lucide-react';

interface PrendaVariante {
  id: string;
  productoNombre: string;
  color: string;
  talle: string;
  precioVenta: number;
  stockActual: number;
}

export const CambiosDevolucionesView = () => {
  const { sucursalActiva, cajaActiva } = useAuth();

  const [variantes, setVariantes] = useState<PrendaVariante[]>([]);
  const [varianteEntranteId, setVarianteEntranteId] = useState('');
  const [varianteSalienteId, setVarianteSalienteId] = useState('');
  const [motivo, setMotivo] = useState<'cambio_talle' | 'cambio_modelo' | 'falla_merma'>('cambio_talle');
  const [metodoPagoDiferencia, setMetodoPagoDiferencia] = useState<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo');
  const [observaciones, setObservaciones] = useState('');
  const [resultadoOperacion, setResultadoOperacion] = useState<any | null>(null);

  useEffect(() => {
    if (sucursalActiva) {
      cargarVariantes();
    }
  }, [sucursalActiva]);

  const cargarVariantes = async () => {
    if (!sucursalActiva) return;

    const { data } = await supabase
      .from('variantes')
      .select(`
        id,
        color,
        talles_catalogo (etiqueta),
        productos (nombre, precio_venta),
        stock_sucursal (cantidad, sucursal_id)
      `)
      .eq('activo', true);

    if (data) {
      const items: PrendaVariante[] = data.map((v: any) => ({
        id: v.id,
        productoNombre: v.productos.nombre,
        color: v.color,
        talle: v.talles_catalogo?.etiqueta || '',
        precioVenta: v.productos.precio_venta,
        stockActual: v.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva.id)?.cantidad || 0
      }));
      setVariantes(items);
      if (items.length > 0) {
        setVarianteEntranteId(items[0].id);
        setVarianteSalienteId(items[0].id);
      }
    }
  };

  const prendaEntrante = variantes.find((v) => v.id === varianteEntranteId);
  const prendaSaliente = variantes.find((v) => v.id === varianteSalienteId);

  const precioEntrante = prendaEntrante?.precioVenta || 0;
  const precioSaliente = motivo === 'falla_merma' ? 0 : prendaSaliente?.precioVenta || 0;
  const diferenciaMonto = precioSaliente - precioEntrante;

  const handleProcesarOperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursalActiva) return;

    if (motivo !== 'falla_merma' && !cajaActiva) {
      alert('Se requiere un turno de caja abierto en ' + sucursalActiva.nombre);
      return;
    }

    if (motivo !== 'falla_merma' && prendaSaliente && prendaSaliente.stockActual <= 0) {
      alert('La prenda saliente seleccionada no tiene stock disponible en este local');
      return;
    }

    const dummyUsuarioId = '00000000-0000-0000-0000-000000000000';

    try {
      if (motivo === 'falla_merma') {
        if (prendaEntrante) {
          const nuevoStock = Math.max(0, prendaEntrante.stockActual - 1);
          await supabase
            .from('stock_sucursal')
            .update({ cantidad: nuevoStock, updated_at: new Date().toISOString() })
            .eq('variante_id', prendaEntrante.id)
            .eq('sucursal_id', sucursalActiva.id);

          await supabase.from('movimientos_stock').insert({
            variante_id: prendaEntrante.id,
            sucursal_id: sucursalActiva.id,
            tipo_movimiento: 'falla_merma',
            cantidad_delta: -1,
            stock_resultante: nuevoStock,
            usuario_id: dummyUsuarioId
          });
        }

        setResultadoOperacion({
          tipo: 'merma',
          mensaje: 'Prenda enviada al inventario de outlet/taller por falla sin alterar caja.'
        });
      } else {
        if (prendaEntrante && prendaSaliente) {
          const stockEntranteNuevo = prendaEntrante.stockActual + 1;
          await supabase
            .from('stock_sucursal')
            .upsert(
              {
                variante_id: prendaEntrante.id,
                sucursal_id: sucursalActiva.id,
                cantidad: stockEntranteNuevo,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'variante_id,sucursal_id' }
            );

          const stockSalienteNuevo = prendaSaliente.stockActual - 1;
          await supabase
            .from('stock_sucursal')
            .update({ cantidad: stockSalienteNuevo, updated_at: new Date().toISOString() })
            .eq('variante_id', prendaSaliente.id)
            .eq('sucursal_id', sucursalActiva.id);

          if (diferenciaMonto > 0 && cajaActiva) {
            await supabase.from('ventas').insert({
              sucursal_id: sucursalActiva.id,
              caja_turno_id: cajaActiva.id,
              vendedor_id: dummyUsuarioId,
              subtotal: diferenciaMonto,
              total_final: diferenciaMonto,
              metodo_pago: metodoPagoDiferencia,
              estado: 'completada'
            });
          }

          setResultadoOperacion({
            tipo: 'cambio',
            diferencia: diferenciaMonto,
            mensaje: diferenciaMonto === 0 
              ? 'Cambio mano a mano procesado: stock ajustado con saldo $0 en caja.' 
              : diferenciaMonto > 0 
                ? `Cambio con diferencia cobrada: +$${diferenciaMonto.toLocaleString()} en caja.`
                : `Saldo a favor del cliente: -$${Math.abs(diferenciaMonto).toLocaleString()} (Vale / Nota de crédito).`
          });
        }
      }

      setObservaciones('');
      cargarVariantes();
    } catch (err: any) {
      alert('Error procesando cambio: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-sky-400" />
          Cambios, Devoluciones & Gestión de Fallas
        </h1>
        <p className="text-sm text-slate-400">
          Reingreso de prendas devueltas, egreso de nuevos talles y control de mermas de taller para <span className="text-sky-400 font-semibold">{sucursalActiva?.nombre}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleProcesarOperacion} className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-2">Tipo de Trámite</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMotivo('cambio_talle')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    motivo === 'cambio_talle'
                      ? 'bg-sky-500 border-sky-400 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  Cambio de Talle
                </button>

                <button
                  type="button"
                  onClick={() => setMotivo('cambio_modelo')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    motivo === 'cambio_modelo'
                      ? 'bg-sky-500 border-sky-400 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  Cambio por Prenda
                </button>

                <button
                  type="button"
                  onClick={() => setMotivo('falla_merma')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    motivo === 'falla_merma'
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  Falla / Merma
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="block text-xs uppercase font-bold text-slate-400">
                {motivo === 'falla_merma' ? 'Prenda que se Da de Baja' : 'Prenda Devuelta por el Cliente (Entra al Stock)'}
              </label>
              <select
                value={varianteEntranteId}
                onChange={(e) => setVarianteEntranteId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                {variantes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productoNombre} - {v.color} (Talle {v.talle}) - ${Number(v.precioVenta).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {motivo !== 'falla_merma' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs uppercase font-bold text-slate-400">
                  Nueva Prenda Elegida (Sale del Stock)
                </label>
                <select
                  value={varianteSalienteId}
                  onChange={(e) => setVarianteSalienteId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {variantes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productoNombre} - {v.color} (Talle {v.talle}) - ${Number(v.precioVenta).toLocaleString()} [Stock: {v.stockActual}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {motivo !== 'falla_merma' && diferenciaMonto > 0 && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <label className="block text-xs uppercase font-bold text-slate-400">
                  Forma de Cobro de la Diferencia (+${diferenciaMonto.toLocaleString()})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['efectivo', 'transferencia', 'tarjeta'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPagoDiferencia(m)}
                      className={`py-1.5 px-2 rounded border text-xs font-bold capitalize ${
                        metodoPagoDiferencia === m
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Notas / Motivo del Cambio</label>
              <input
                type="text"
                placeholder="Ej. Talle M le quedó chico, se lleva L"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Procesar Operación
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Balance de Caja & Arqueo</h2>

            {motivo === 'falla_merma' ? (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <AlertOctagon className="w-4 h-4" /> Baja por Merma / Falla
                </div>
                <p className="text-slate-400">
                  La unidad se descuenta físicamente del perchero y se deriva al sub-inventario de outlet/taller sin alterar los ingresos de caja.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Valor Prenda Devuelta:</span>
                  <span className="font-bold text-white">${precioEntrante.toLocaleString()}</span>
                </div>

                <div className="p-3 bg-slate-950 rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Valor Nueva Prenda:</span>
                  <span className="font-bold text-white">${precioSaliente.toLocaleString()}</span>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold uppercase text-[10px] text-slate-400">Resultado en Caja:</span>
                  <p className={`text-xl font-black ${
                    diferenciaMonto === 0 ? 'text-emerald-400' : diferenciaMonto > 0 ? 'text-sky-400' : 'text-amber-400'
                  }`}>
                    {diferenciaMonto === 0 
                      ? 'Saldo $0 (Mano a Mano)' 
                      : diferenciaMonto > 0 
                        ? `Cobrar +$${diferenciaMonto.toLocaleString()}` 
                        : `Saldo a Favor -$${Math.abs(diferenciaMonto).toLocaleString()}`}
                  </p>
                </div>
              </div>
            )}

            {resultadoOperacion && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-1 text-xs">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Operación Finalizada
                </p>
                <p className="text-slate-300">{resultadoOperacion.mensaje}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};