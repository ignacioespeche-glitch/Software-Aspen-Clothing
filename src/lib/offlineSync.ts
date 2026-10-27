import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import { supabase } from './supabase';

interface VentaOffline {
  idLocal?: number;
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
  items: Array<{
    variante_id: string;
    cantidad: number;
    precio_unitario: number;
    costo_unitario: number;
  }>;
  created_at: string;
}

interface AspenDB extends DBSchema {
  ventas_offline: {
    key: number;
    value: VentaOffline;
    indexes: { 'by-date': string };
  };
}

export const getDB = async () => {
  return openDB<AspenDB>('aspen_offline_db', 1, {
    upgrade(db) {
      const store = db.createObjectStore('ventas_offline', {
        keyPath: 'idLocal',
        autoIncrement: true,
      });
      store.createIndex('by-date', 'created_at');
    },
  });
};

export const guardarVentaOffline = async (venta: VentaOffline) => {
  const db = await getDB();
  return db.add('ventas_offline', venta);
};

export const obtenerVentasOffline = async () => {
  const db = await getDB();
  return db.getAll('ventas_offline');
};

export const sincronizarVentasPendientes = async (): Promise<number> => {
  const db = await getDB();
  const pendientes = await db.getAll('ventas_offline');

  if (pendientes.length === 0) return 0;

  let sincronizadas = 0;

  for (const v of pendientes) {
    try {
      const { data: ventaData, error: vError } = await supabase
        .from('ventas')
        .insert({
          sucursal_id: v.sucursal_id,
          caja_turno_id: v.caja_turno_id,
          vendedor_id: v.vendedor_id,
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

      if (vError) throw vError;

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

        const nuevoStock = Math.max(0, (stockData?.cantidad || 0) - item.cantidad);

        await supabase
          .from('stock_sucursal')
          .update({ cantidad: nuevoStock, updated_at: new Date().toISOString() })
          .eq('variante_id', item.variante_id)
          .eq('sucursal_id', v.sucursal_id);
      }

      if (v.idLocal) {
        await db.delete('ventas_offline', v.idLocal);
      }
      sincronizadas++;
    } catch (error) {
      console.error('Error sincronizando venta:', error);
      break;
    }
  }

  return sincronizadas;
};