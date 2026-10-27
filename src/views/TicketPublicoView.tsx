import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Store, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

export const TicketPublicoView = () => {
  const { id } = useParams<{ id: string }>();
  const [venta, setVenta] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarComprobante() {
      if (!id) return;

      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          sucursales (nombre, direccion, telefono),
          clientes (nombre, telefono_whatsapp),
          ventas_detalle (
            cantidad,
            precio_unitario_cobrado,
            subtotal_linea,
            variantes (
              color,
              talles_catalogo (etiqueta),
              productos (nombre)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        setVenta(data);
      }
      setLoading(false);
    }

    cargarComprobante();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Cargando comprobante Aspen Clothing...
      </div>
    );
  }

  if (!venta) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-lg font-bold text-white mb-1">Comprobante no encontrado</h2>
        <p className="text-xs text-slate-500">El enlace no es válido o la operación ha sido anulada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 self-start">
        
        {/* Cabecera Ticket */}
        <div className="text-center space-y-2 border-b border-slate-800 pb-5">
          <span className="text-2xl font-black tracking-widest uppercase text-white">
            Aspen Clothing
          </span>
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Comprobante Digital Oficial</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">ID: {venta.id}</p>
        </div>

        {/* Datos de la Sucursal y Fecha */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Store className="w-3 h-3 text-sky-400" /> Local
            </span>
            <p className="font-semibold text-slate-200">{venta.sucursales?.nombre}</p>
            <p className="text-[10px] text-slate-500">{venta.sucursales?.direccion}</p>
          </div>

          <div className="space-y-0.5 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3 text-sky-400" /> Fecha
            </span>
            <p className="font-semibold text-slate-200">
              {new Date(venta.created_at).toLocaleDateString()}
            </p>
            <p className="text-[10px] text-slate-500">
              {new Date(venta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
            </p>
          </div>
        </div>

        {/* Detalle de Prendas */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Prendas Adquiridas</h3>
          
          <div className="divide-y divide-slate-800 border-t border-b border-slate-800">
            {venta.ventas_detalle?.map((d: any, index: number) => (
              <div key={index} className="py-2.5 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-100">{d.variantes?.productos?.nombre}</p>
                  <p className="text-[11px] text-slate-400">
                    {d.variantes?.color} • Talle {d.variantes?.talles_catalogo?.etiqueta} (×{d.cantidad})
                  </p>
                </div>
                <span className="font-bold text-slate-200">
                  ${Number(d.subtotal_linea).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="space-y-1.5 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>${Number(venta.subtotal).toLocaleString()}</span>
          </div>

          {Number(venta.descuento_valor) > 0 && (
            <div className="flex justify-between text-rose-400">
              <span>Descuento aplicado:</span>
              <span>
                {venta.descuento_tipo === 'porcentaje'
                  ? `-${venta.descuento_valor}%`
                  : `-$${Number(venta.descuento_valor).toLocaleString()}`}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm pt-2 border-t border-slate-800 font-black">
            <span className="text-white">TOTAL ABONADO:</span>
            <span className="text-emerald-400 text-base">${Number(venta.total_final).toLocaleString()}</span>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1 capitalize">
              <CreditCard className="w-3.5 h-3.5 text-sky-400" /> Método de pago:
            </span>
            <span className="font-semibold text-slate-200 capitalize">{venta.metodo_pago}</span>
          </div>
        </div>

        {/* Políticas de Cambio y Pie */}
        <div className="p-3.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Políticas de Cambio
          </div>
          <p>• Los cambios se realizan dentro de los 30 días de corrida la compra.</p>
          <p>• Es indispensable presentar este comprobante digital y la prenda con etiqueta en perfecto estado.</p>
          <p>• Válido en cualquier sucursal oficial de Aspen Clothing.</p>
        </div>

      </div>
    </div>
  );
};