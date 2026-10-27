import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  BookmarkCheck, 
  Plus, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

interface PrendaVariante {
  id: string;
  productoNombre: string;
  color: string;
  talle: string;
  precioVenta: number;
  stockActual: number;
}

export const ReservasView = () => {
  const { sucursalActiva, cajaActiva } = useAuth();

  const [reservas, setReservas] = useState<any[]>([]);
  const [variantes, setVariantes] = useState<PrendaVariante[]>([]);

  const [mostrarModalNueva, setMostrarModalNueva] = useState(false);
  const [varianteId, setVarianteId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [montoSenia, setMontoSenia] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'debito' | 'credito'>('efectivo');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [diasLimite, setDiasLimite] = useState('7');

  useEffect(() => {
    if (sucursalActiva) {
      cargarReservas();
      cargarVariantes();
    }
  }, [sucursalActiva]);

  const cargarReservas = async () => {
    if (!sucursalActiva) return;

    const { data } = await supabase
      .from('reservas')
      .select(`
        *,
        clientes (nombre, telefono_whatsapp),
        reservas_detalle (
          cantidad,
          precio_unitario,
          variantes (
            color,
            talles_catalogo (etiqueta),
            productos (nombre)
          )
        )
      `)
      .eq('sucursal_id', sucursalActiva.id)
      .order('created_at', { ascending: false });

    if (data) setReservas(data);
  };

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
      if (items.length > 0) setVarianteId(items[0].id);
    }
  };

  const prendaSeleccionada = variantes.find((v) => v.id === varianteId);
  const totalEstimado = (prendaSeleccionada?.precioVenta || 0) * (parseInt(cantidad) || 1);
  const seniaNum = parseFloat(montoSenia) || 0;
  const saldoPendiente = Math.max(0, totalEstimado - seniaNum);

  const handleCrearReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActiva || !sucursalActiva || !prendaSeleccionada) {
      alert('La caja debe estar abierta para registrar el cobro de la seña.');
      return;
    }

    const cantNum = parseInt(cantidad) || 1;
    if (cantNum > prendaSeleccionada.stockActual) {
      alert('Stock insuficiente en perchero para apartar.');
      return;
    }

    if (seniaNum <= 0 || seniaNum > totalEstimado) {
      alert('Monto de seña inválido.');
      return;
    }

    try {
      let clienteId: string | null = null;
      if (telefonoCliente.trim()) {
        const { data: cData } = await supabase
          .from('clientes')
          .upsert(
            {
              telefono_whatsapp: telefonoCliente.trim(),
              nombre: nombreCliente.trim() || 'Cliente Reserva'
            },
            { onConflict: 'telefono_whatsapp' }
          )
          .select('id')
          .single();

        clienteId = cData?.id || null;
      }

      const fechaLimiteDate = new Date();
      fechaLimiteDate.setDate(fechaLimiteDate.getDate() + parseInt(diasLimite));

      const dummyVendedorId = '00000000-0000-0000-0000-000000000000';

      const { data: reservaData, error: rError } = await supabase
        .from('reservas')
        .insert({
          sucursal_id: sucursalActiva.id,
          caja_turno_id: cajaActiva.id,
          vendedor_id: dummyVendedorId,
          cliente_id: clienteId,
          total_reserva: totalEstimado,
          monto_senia: seniaNum,
          saldo_pendiente: saldoPendiente,
          metodo_pago_senia: metodoPago,
          fecha_limite: fechaLimiteDate.toISOString(),
          estado: 'pendiente'
        })
        .select('id')
        .single();

      if (rError) throw rError;

      await supabase.from('reservas_detalle').insert({
        reserva_id: reservaData.id,
        variante_id: prendaSeleccionada.id,
        cantidad: cantNum,
        precio_unitario: prendaSeleccionada.precioVenta,
        subtotal_linea: totalEstimado
      });

      const nuevoStock = prendaSeleccionada.stockActual - cantNum;
      await supabase
        .from('stock_sucursal')
        .update({ cantidad: nuevoStock, updated_at: new Date().toISOString() })
        .eq('variante_id', prendaSeleccionada.id)
        .eq('sucursal_id', sucursalActiva.id);

      alert('¡Seña registrada y prenda congelada en stock!');
      setMostrarModalNueva(false);
      setMontoSenia('');
      setTelefonoCliente('');
      setNombreCliente('');
      cargarReservas();
      cargarVariantes();
    } catch (err: any) {
      alert('Error registrando reserva: ' + err.message);
    }
  };

  const handleCompletarEntrega = async (reserva: any) => {
    if (!cajaActiva) {
      alert('Se requiere caja abierta para cobrar el saldo restante.');
      return;
    }

    const dummyVendedorId = '00000000-0000-0000-0000-000000000000';

    await supabase.from('ventas').insert({
      sucursal_id: sucursalActiva?.id,
      caja_turno_id: cajaActiva.id,
      vendedor_id: dummyVendedorId,
      cliente_id: reserva.cliente_id,
      subtotal: reserva.saldo_pendiente,
      total_final: reserva.saldo_pendiente,
      metodo_pago: 'efectivo',
      estado: 'completada'
    });

    await supabase
      .from('reservas')
      .update({ estado: 'completada', saldo_pendiente: 0 })
      .eq('id', reserva.id);

    alert('¡Reserva completada, saldo ingresado a caja y entrega finalizada!');
    cargarReservas();
  };

  const handleCancelarReserva = async (reserva: any) => {
    if (!confirm('¿Deseas cancelar esta reserva? La prenda volverá al stock disponible.')) return;

    for (const d of reserva.reservas_detalle) {
      const { data: stockData } = await supabase
        .from('stock_sucursal')
        .select('cantidad')
        .eq('variante_id', d.variante_id)
        .eq('sucursal_id', sucursalActiva?.id)
        .single();

      const devuelto = (stockData?.cantidad || 0) + d.cantidad;
      await supabase
        .from('stock_sucursal')
        .update({ cantidad: devuelto, updated_at: new Date().toISOString() })
        .eq('variante_id', d.variante_id)
        .eq('sucursal_id', sucursalActiva?.id);
    }

    await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reserva.id);

    alert('Reserva cancelada y stock liberado nuevamente a perchero.');
    cargarReservas();
    cargarVariantes();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <BookmarkCheck className="w-6 h-6 text-sky-400" />
            Señas, Reservas & Apartados
          </h1>
          <p className="text-sm text-slate-400">
            Prendas congeladas en stock por adelanto de dinero para <span className="text-sky-400 font-semibold">{sucursalActiva?.nombre}</span>.
          </p>
        </div>

        <button
          onClick={() => setMostrarModalNueva(true)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva Reserva / Seña
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reservas.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm">
            No hay apartados o señas activas en esta sucursal.
          </div>
        ) : (
          reservas.map((r) => {
            const estaPendiente = r.estado === 'pendiente';

            return (
              <div
                key={r.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-sm">
                        {r.clientes?.nombre || 'Cliente Mostrador'}
                      </p>
                      <p className="text-xs text-slate-400">
                        WhatsApp: {r.clientes?.telefono_whatsapp || 'No registrado'}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        r.estado === 'completada'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : r.estado === 'cancelada'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {r.estado}
                    </span>
                  </div>

                  <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1 text-xs">
                    {r.reservas_detalle?.map((d: any, idx: number) => (
                      <p key={idx} className="text-slate-300 font-medium">
                        {d.cantidad}x {d.variantes?.productos?.nombre} ({d.variantes?.color} - Talle {d.variantes?.talles_catalogo?.etiqueta})
                      </p>
                    ))}
                    <div className="pt-2 border-t border-slate-800 text-slate-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Total de Compra:</span>
                        <span className="font-bold text-white">${Number(r.total_reserva).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Seña Cobrada:</span>
                        <span className="font-bold">${Number(r.monto_senia).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-amber-400 font-bold">
                        <span>Saldo Pendiente:</span>
                        <span>${Number(r.saldo_pendiente).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {estaPendiente && (
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleCompletarEntrega(r)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Entregar & Cobrar
                    </button>
                    <button
                      onClick={() => handleCancelarReserva(r)}
                      className="px-3 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
                      title="Cancelar y liberar stock"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {mostrarModalNueva && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Nueva Seña de Prenda</h3>

            <form onSubmit={handleCrearReserva} className="space-y-3">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Prenda a Congelar</label>
                <select
                  value={varianteId}
                  onChange={(e) => setVarianteId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {variantes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productoNombre} - {v.color} (Talle {v.talle}) - ${Number(v.precioVenta).toLocaleString()} [Disp: {v.stockActual}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Días de Reserva</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={diasLimite}
                    onChange={(e) => setDiasLimite(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Monto de Seña ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 10000"
                    value={montoSenia}
                    onChange={(e) => setMontoSenia(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Pago de Seña</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white capitalize"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia / MP</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs flex justify-between">
                <span className="text-slate-400">Saldo Restante al Retirar:</span>
                <span className="font-bold text-amber-400">${saldoPendiente.toLocaleString()}</span>
              </div>

              <div className="border-t border-slate-800 pt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="WhatsApp del cliente (ej. 2611234567)"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarModalNueva(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Congelar Stock & Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};