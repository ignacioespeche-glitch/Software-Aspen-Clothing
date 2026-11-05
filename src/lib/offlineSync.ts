import { supabase } from './supabase';

export interface VentaOfflineItem {
  variante_id: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
}

export interface VentaOffline {
  id?: string;
  empresa_id?: string;
  sucursal_id: string;
  caja_turno_id: string;
  vendedor_id: string;
  cliente_id: string | null;
  subtotal: number;
  descuento_tipo: string;
  descuento_valor: number;
  total_final: number;
  metodo_pago: string;
  detalles_pago: any;
  items: VentaOfflineItem[];
  created_at: string;
}

const STORAGE_KEY = 'aspen_ventas_offline';

export const guardarVentaOffline = async (venta: VentaOffline): Promise<void> => {
  const guardadas = obtenerVentasOffline();
  guardadas.push({ ...venta, id: `offline_${Date.now()}` });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guardadas));
};

export const obtenerVentasOffline = (): VentaOffline[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const sincronizarVentasOffline = async (): Promise<{ exitosas: number; fallidas: number }> => {
  const pendientes = obtenerVentasOffline();
  if (pendientes.length === 0) return { exitosas: 0, fallidas: 0 };

  let exitosas = 0;
  const restantes: VentaOffline[] = [];

  for (const v of pendientes) {
    try {
      const { data: ventaData, error: errVenta } = await supabase
        .from('ventas')
        .insert({
          empresa_id: v.empresa_id,
          sucursal_id: v.sucursal_id,
          caja_turno_id: v.caja_turno_id,
          vendedor_id: v.vendedor_id || null,
          cliente_id: v.cliente_id,
          subtotal: v.subtotal,
          descuento_tipo: v.descuento_tipo,
          descuento_valor: v.descuento_valor,
          total_final: v.total_final,
          metodo_pago: v.metodo_pago,
          detalles_pago: v.detalles_pago,
          estado: 'completada',
          created_at: v.created_at,
        })
        .select('id')
        .single();

      if (errVenta) throw errVenta;

      for (const item of v.items) {
        await supabase.from('ventas_detalle').insert({
          venta_id: ventaData.id,
          variante_id: item.variante_id,
          cantidad: item.cantidad,
          precio_unitario_cobrado: item.precio_unitario,
          costo_unitario_historico: item.costo_unitario,
          subtotal_linea: item.precio_unitario * item.cantidad,
        });

        const { data: stockData } = await supabase
          .from('stock_sucursal')
          .select('cantidad')
          .eq('variante_id', item.variante_id)
          .eq('sucursal_id', v.sucursal_id)
          .single();

        const stockActual = stockData?.cantidad || 0;
        await supabase
          .from('stock_sucursal')
          .update({
            cantidad: Math.max(0, stockActual - item.cantidad),
            updated_at: new Date().toISOString(),
          })
          .eq('variante_id', item.variante_id)
          .eq('sucursal_id', v.sucursal_id);
      }

      exitosas++;
    } catch {
      restantes.push(v);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(restantes));
  return { exitosas, fallidas: restantes.length };
};