export interface Sucursal {
  id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activa: boolean;
  created_at: string;
}

export interface Perfil {
  id: string;
  nombre: string;
  apellido?: string;
  rol: 'admin' | 'vendedor';
  sucursal_id?: string;
  activo: boolean;
  created_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export interface CurvaTalle {
  id: string;
  nombre: string;
}

export interface TalleCatalogo {
  id: string;
  curva_id: string;
  etiqueta: string;
  orden: number;
}

export interface Producto {
  id: string;
  categoria_id: string;
  curva_talles_id: string;
  nombre: string;
  descripcion?: string;
  precio_costo: number;
  precio_venta: number;
  activo: boolean;
  created_at: string;
}

export interface Variante {
  id: string;
  producto_id: string;
  color: string;
  talle_id: string;
  sku_interno?: string;
  activo: boolean;
  talles_catalogo?: TalleCatalogo;
  stock_sucursal?: StockSucursal[];
}

export interface StockSucursal {
  id: string;
  variante_id: string;
  sucursal_id: string;
  cantidad: number;
  stock_minimo_alerta: number;
  updated_at: string;
}

export interface CajaTurno {
  id: string;
  sucursal_id: string;
  vendedor_id: string;
  fecha_apertura: string;
  fecha_cierre?: string;
  monto_inicial_efectivo: number;
  monto_cierre_declarado?: number;
  monto_cierre_esperado?: number;
  diferencia?: number;
  estado: 'abierta' | 'cerrada';
  observaciones?: string;
}