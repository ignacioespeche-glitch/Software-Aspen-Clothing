import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { guardarVentaOffline } from '../lib/offlineSync';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  PauseCircle, 
  Plus, 
  CheckCircle, 
  MessageSquare, 
  AlertTriangle,
  AlertCircle,
  Receipt,
  Eye,
  ExternalLink
} from 'lucide-react';

interface CarritoItem {
  varianteId: string;
  productoNombre: string;
  color: string;
  talle: string;
  precioUnitario: number;
  costoUnitario: number;
  cantidad: number;
  stockDisponible: number;
}

interface CarritoPestaña {
  id: string;
  nombre: string;
  items: CarritoItem[];
  descuentoTipo: 'ninguno' | 'porcentaje' | 'monto';
  descuentoValor: number;
}

export const PosView = () => {
  const { perfil, sucursalActiva, cajaActiva } = useAuth();

  const [productos, setProductos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const [categorias, setCategorias] = useState<any[]>([]);

  const [carritos, setCarritos] = useState<CarritoPestaña[]>([
    { id: '1', nombre: 'Venta #1', items: [], descuentoTipo: 'ninguno', descuentoValor: 0 }
  ]);
  const [carritoActivoId, setCarritoActivoId] = useState<string>('1');

  const [productoSeleccionado, setProductoSeleccionado] = useState<any | null>(null);

  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'debito' | 'credito' | 'mixto'>('efectivo');
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState('');
  const [montoDigitalMixto, setMontoDigitalMixto] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');

  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [mensajePos, setMensajePos] = useState<string | null>(null);

  const [toastExito, setToastExito] = useState<{ mostrar: boolean; monto: number; ventaId?: string; offline?: boolean } | null>(null);

  // Historial del turno para el vendedor
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [ventasTurno, setVentasTurno] = useState<any[]>([]);
  const [ticketDetalleVendedor, setTicketDetalleVendedor] = useState<any | null>(null);

  useEffect(() => {
    cargarCatalogoPOS();
  }, [sucursalActiva]);

  const cargarCatalogoPOS = async () => {
    if (!sucursalActiva) return;

    try {
      const [resCat, resProd] = await Promise.all([
        supabase.from('categorias').select('*').order('orden'),
        supabase.from('productos').select(`
          *,
          categorias (nombre),
          variantes (
            id,
            color,
            sku_interno,
            talles_catalogo (etiqueta, orden),
            stock_sucursal (cantidad, sucursal_id)
          )
        `).eq('activo', true)
      ]);

      if (resCat.data) {
        setCategorias(resCat.data);
        localStorage.setItem('aspen_cache_categorias', JSON.stringify(resCat.data));
      }
      if (resProd.data) {
        setProductos(resProd.data);
        localStorage.setItem('aspen_cache_productos', JSON.stringify(resProd.data));
      }
    } catch {
      const cacheCat = localStorage.getItem('aspen_cache_categorias');
      const cacheProd = localStorage.getItem('aspen_cache_productos');
      if (cacheCat) setCategorias(JSON.parse(cacheCat));
      if (cacheProd) setProductos(JSON.parse(cacheProd));
    }
  };

  const cargarHistorialTurnoVendedor = async () => {
    if (!cajaActiva) return;

    const { data } = await supabase
      .from('ventas')
      .select(`
        *,
        clientes (nombre, telefono_whatsapp),
        ventas_detalle (
          id,
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
      .eq('caja_turno_id', cajaActiva.id)
      .eq('estado', 'completada')
      .order('created_at', { ascending: false });

    if (data) setVentasTurno(data);
    setMostrarModalHistorial(true);
  };

  const carritoActual = carritos.find((c) => c.id === carritoActivoId) || carritos[0];

  const agregarNuevoCarrito = () => {
    const nuevoId = String(Date.now());
    const nuevo: CarritoPestaña = {
      id: nuevoId,
      nombre: `Venta #${carritos.length + 1}`,
      items: [],
      descuentoTipo: 'ninguno',
      descuentoValor: 0
    };
    setCarritos([...carritos, nuevo]);
    setCarritoActivoId(nuevoId);
  };

  const cerrarCarrito = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (carritos.length === 1) {
      setCarritos([{ id: '1', nombre: 'Venta #1', items: [], descuentoTipo: 'ninguno', descuentoValor: 0 }]);
      return;
    }
    const filtrados = carritos.filter((c) => c.id !== id);
    setCarritos(filtrados);
    if (carritoActivoId === id) {
      setCarritoActivoId(filtrados[0].id);
    }
  };

  const agregarItemAlCarrito = (variante: any, producto: any) => {
    setMensajePos(null);
    const stockActual = variante.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva?.id)?.cantidad || 0;

    if (stockActual <= 0 && navigator.onLine) {
      setMensajePos(`Sin stock para ${producto.nombre} (${variante.color} - ${variante.talles_catalogo?.etiqueta}) en este local.`);
      return;
    }

    setCarritos((prev) =>
      prev.map((c) => {
        if (c.id !== carritoActivoId) return c;

        const existeIndex = c.items.findIndex((item) => item.varianteId === variante.id);
        if (existeIndex > -1) {
          const nuevaCantidad = c.items[existeIndex].cantidad + 1;
          if (nuevaCantidad > stockActual && navigator.onLine) {
            setMensajePos(`Stock máximo alcanzado (${stockActual} unidades disponibles).`);
            return c;
          }
          const actualizados = [...c.items];
          actualizados[existeIndex].cantidad = nuevaCantidad;
          return { ...c, items: actualizados };
        } else {
          const nuevoItem: CarritoItem = {
            varianteId: variante.id,
            productoNombre: producto.nombre,
            color: variante.color,
            talle: variante.talles_catalogo?.etiqueta || 'U',
            precioUnitario: producto.precio_venta,
            costoUnitario: producto.precio_costo,
            cantidad: 1,
            stockDisponible: stockActual
          };
          return { ...c, items: [...c.items, nuevoItem] };
        }
      })
    );

    setProductoSeleccionado(null);
  };

  const modificarCantidad = (varianteId: string, delta: number) => {
    setMensajePos(null);
    setCarritos((prev) =>
      prev.map((c) => {
        if (c.id !== carritoActivoId) return c;
        const actualizados = c.items
          .map((item) => {
            if (item.varianteId === varianteId) {
              const nuevaCant = item.cantidad + delta;
              if (nuevaCant > item.stockDisponible && navigator.onLine) {
                setMensajePos('Cantidad solicitada supera el stock físico disponible.');
                return item;
              }
              return { ...item, cantidad: nuevaCant };
            }
            return item;
          })
          .filter((item) => item.cantidad > 0);
        return { ...c, items: actualizados };
      })
    );
  };

  const subtotal = carritoActual.items.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0);
  let descuentoTotal = 0;
  if (carritoActual.descuentoTipo === 'porcentaje') {
    descuentoTotal = (subtotal * carritoActual.descuentoValor) / 100;
  } else if (carritoActual.descuentoTipo === 'monto') {
    descuentoTotal = carritoActual.descuentoValor;
  }
  const totalFinal = Math.max(0, subtotal - descuentoTotal);

  const handleConfirmarVenta = async () => {
    setErrorCobro(null);
    if (!cajaActiva || !sucursalActiva) {
      setErrorCobro('La caja debe estar abierta para registrar ventas.');
      return;
    }
    if (carritoActual.items.length === 0) {
      setErrorCobro('El carrito está vacío.');
      return;
    }

    let detallesPagoJson: any = null;
    if (metodoPago === 'mixto') {
      detallesPagoJson = {
        efectivo: parseFloat(montoEfectivoMixto) || 0,
        digital: parseFloat(montoDigitalMixto) || 0
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const idVendedorReal = perfil?.id || sessionData?.session?.user?.id || null;

    if (!navigator.onLine) {
      await guardarVentaOffline({
        sucursal_id: sucursalActiva.id,
        caja_turno_id: cajaActiva.id,
        vendedor_id: idVendedorReal || '',
        cliente_id: null,
        subtotal: subtotal,
        descuento_tipo: carritoActual.descuentoTipo,
        descuento_valor: carritoActual.descuentoValor,
        total_final: totalFinal,
        metodo_pago: metodoPago,
        detalles_pago: detallesPagoJson,
        items: carritoActual.items.map((i) => ({
          variante_id: i.varianteId,
          cantidad: i.cantidad,
          precio_unitario: i.precioUnitario,
          costo_unitario: i.costoUnitario,
        })),
        created_at: new Date().toISOString(),
      });

      setToastExito({
        mostrar: true,
        monto: totalFinal,
        offline: true,
      });

      limpiarFormularioVenta();
      return;
    }

    try {
      let clienteId: string | null = null;
      if (telefonoCliente.trim()) {
        const { data: clienteData, error: cErr } = await supabase
          .from('clientes')
          .upsert(
            {
              telefono_whatsapp: telefonoCliente.trim(),
              nombre: nombreCliente.trim() || 'Cliente Mostrador'
            },
            { onConflict: 'telefono_whatsapp' }
          )
          .select('id')
          .single();

        if (cErr) throw cErr;
        clienteId = clienteData?.id || null;
      }

      const { data: ventaData, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          sucursal_id: sucursalActiva.id,
          caja_turno_id: cajaActiva.id,
          vendedor_id: idVendedorReal,
          cliente_id: clienteId,
          subtotal: subtotal,
          descuento_tipo: carritoActual.descuentoTipo,
          descuento_valor: carritoActual.descuentoValor,
          total_final: totalFinal,
          metodo_pago: metodoPago,
          detalles_pago: detallesPagoJson,
          estado: 'completada'
        })
        .select('id')
        .single();

      if (ventaError) throw ventaError;

      for (const item of carritoActual.items) {
        await supabase.from('ventas_detalle').insert({
          venta_id: ventaData.id,
          variante_id: item.varianteId,
          cantidad: item.cantidad,
          precio_unitario_cobrado: item.precioUnitario,
          costo_unitario_historico: item.costoUnitario,
          subtotal_linea: item.precioUnitario * item.cantidad
        });

        const { data: stockActualData } = await supabase
          .from('stock_sucursal')
          .select('cantidad')
          .eq('variante_id', item.varianteId)
          .eq('sucursal_id', sucursalActiva.id)
          .single();

        const nuevoStock = (stockActualData?.cantidad || 0) - item.cantidad;

        await supabase
          .from('stock_sucursal')
          .update({ cantidad: Math.max(0, nuevoStock), updated_at: new Date().toISOString() })
          .eq('variante_id', item.varianteId)
          .eq('sucursal_id', sucursalActiva.id);
      }

      setToastExito({
        mostrar: true,
        monto: totalFinal,
        ventaId: ventaData.id,
        offline: false,
      });

      limpiarFormularioVenta();
      cargarCatalogoPOS();
    } catch (err: any) {
      setErrorCobro(err.message || 'Error procesando la venta');
    }
  };

  const limpiarFormularioVenta = () => {
    setCarritos((prev) =>
      prev.map((c) => (c.id === carritoActivoId ? { ...c, items: [], descuentoTipo: 'ninguno', descuentoValor: 0 } : c))
    );
    setMostrarModalCobro(false);
    setMontoEfectivoMixto('');
    setMontoDigitalMixto('');
    setTimeout(() => setToastExito(null), 5000);
  };

  const enviarWhatsAppComprobante = () => {
    if (!telefonoCliente.trim() || !toastExito) return;

    let tel = telefonoCliente.replace(/\D/g, '');
    if (!tel.startsWith('549')) {
      tel = `549${tel}`;
    }

    const linkComprobante = `${window.location.origin}/ticket/${toastExito.ventaId}`;

    const mensaje = encodeURIComponent(
      `¡Hola ${nombreCliente || 'Genio/a'}! Gracias por comprar en *Aspen Clothing* (${sucursalActiva?.nombre}).\n\n` +
      `Tu compra por un total de *$${toastExito.monto.toLocaleString()}* quedó confirmada.\n\n` +
      `Podés consultar tu ticket digital y políticas de cambio en este link:\n${linkComprobante}`
    );

    window.open(`https://wa.me/${tel}?text=${mensaje}`, '_blank');
  };

  const productosFiltrados = productos.filter((p) => {
    const coincideTexto = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoriaFiltro === 'todos' || p.categoria_id === categoriaFiltro;
    return coincideTexto && coincideCategoria;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6 relative">
      {toastExito?.mostrar && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border-2 border-emerald-500 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-bounce">
          <div className="animate-[spin_0.6s_ease-out_1] text-emerald-400">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-black text-sm text-emerald-400">
              {toastExito.offline ? '¡Venta Registrada Offline!' : '¡Venta registrada con éxito!'}
            </h4>
            <p className="text-xs text-slate-300">
              {toastExito.offline ? 'Guardada en memoria local. Se sincronizará al volver la red.' : `Cobrado: $${toastExito.monto.toLocaleString()}`}
            </p>
          </div>
          {telefonoCliente && !toastExito.offline && (
            <button
              onClick={enviarWhatsAppComprobante}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-bold ml-2"
            >
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </button>
          )}
        </div>
      )}

      <div className="flex-1 space-y-4">
        {mensajePos && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-lg flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {mensajePos}
          </div>
        )}

        <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400">
            Mostrador de <strong className="text-white">{sucursalActiva?.nombre}</strong>
          </span>

          <button
            onClick={cargarHistorialTurnoVendedor}
            disabled={!cajaActiva}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-sky-400 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Receipt className="w-4 h-4" /> Ventas del Turno
          </button>
        </div>

        {!cajaActiva && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            La caja de {sucursalActiva?.nombre} está cerrada. Abrila desde la pestaña "Caja & Turnos" para registrar operaciones.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar prenda por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCategoriaFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                categoriaFiltro === 'todos'
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaFiltro(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  categoriaFiltro === cat.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[640px] overflow-y-auto pr-1">
          {productosFiltrados.map((prod) => (
            <div
              key={prod.id}
              onClick={() => setProductoSeleccionado(prod)}
              className="bg-slate-900 border border-slate-800 hover:border-sky-500/60 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-sm select-none"
            >
              <div>
                <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                  {prod.categorias?.nombre}
                </span>
                <h4 className="font-bold text-slate-100 text-sm mt-0.5 line-clamp-2">
                  {prod.nombre}
                </h4>
              </div>
              <div className="mt-3 flex justify-between items-baseline border-t border-slate-800/80 pt-2">
                <span className="text-xs text-slate-400">Variantes</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  ${Number(prod.precio_venta).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[700px]">
        <div className="flex items-center border-b border-slate-800 bg-slate-950 rounded-t-xl overflow-x-auto">
          {carritos.map((c) => (
            <div
              key={c.id}
              onClick={() => setCarritoActivoId(c.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border-r border-slate-800 cursor-pointer transition-colors ${
                c.id === carritoActivoId
                  ? 'bg-slate-900 text-sky-400 border-b-2 border-b-sky-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{c.nombre}</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full text-slate-300">
                {c.items.reduce((acc, i) => acc + i.cantidad, 0)}
              </span>
              <button
                onClick={(e) => cerrarCarrito(c.id, e)}
                className="hover:text-rose-400 ml-1 text-slate-500"
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={agregarNuevoCarrito}
            className="p-2 text-slate-400 hover:text-white cursor-pointer ml-auto"
            title="Abrir nueva venta simultánea"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {carritoActual.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <ShoppingCart className="w-8 h-8 stroke-1" />
              <p className="text-xs">El mostrador está vacío</p>
            </div>
          ) : (
            carritoActual.items.map((item) => (
              <div
                key={item.varianteId}
                className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center text-xs"
              >
                <div>
                  <p className="font-bold text-slate-100">{item.productoNombre}</p>
                  <p className="text-slate-400 text-[11px]">
                    {item.color} • Talle {item.talle}
                  </p>
                  <p className="text-emerald-400 font-semibold mt-0.5">
                    ${Number(item.precioUnitario).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg">
                    <button
                      onClick={() => modificarCantidad(item.varianteId, -1)}
                      className="px-2 py-1 text-slate-400 hover:text-white font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-2 font-bold text-white">{item.cantidad}</span>
                    <button
                      onClick={() => modificarCantidad(item.varianteId, 1)}
                      className="px-2 py-1 text-slate-400 hover:text-white font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => modificarCantidad(item.varianteId, -item.cantidad)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-800 p-4 space-y-3 bg-slate-950/80 rounded-b-xl">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-200">${subtotal.toLocaleString()}</span>
            </div>

            {descuentoTotal > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Descuento:</span>
                <span className="font-semibold">-${descuentoTotal.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-sm pt-1 border-t border-slate-800 font-black">
              <span className="text-white">TOTAL:</span>
              <span className="text-emerald-400 text-base">${totalFinal.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const tipo = prompt('Tipo de descuento: escribe "porcentaje" o "monto"') as any;
                if (tipo === 'porcentaje' || tipo === 'monto') {
                  const valor = parseFloat(prompt('Valor del descuento:') || '0');
                  setCarritos((prev) =>
                    prev.map((c) => (c.id === carritoActivoId ? { ...c, descuentoTipo: tipo, descuentoValor: valor } : c))
                  );
                }
              }}
              className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              % Descuento
            </button>

            <button
              onClick={agregarNuevoCarrito}
              className="py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Pausar
            </button>
          </div>

          <button
            disabled={!cajaActiva || carritoActual.items.length === 0}
            onClick={() => {
              setErrorCobro(null);
              setMostrarModalCobro(true);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold py-3 rounded-lg transition-colors cursor-pointer text-sm uppercase tracking-wider"
          >
            Cobrar ${totalFinal.toLocaleString()}
          </button>
        </div>
      </div>

      {productoSeleccionado && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{productoSeleccionado.nombre}</h3>
                <p className="text-xs text-slate-400">Seleccioná talle y color para añadir al mostrador</p>
              </div>
              <button
                onClick={() => setProductoSeleccionado(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {productoSeleccionado.variantes?.map((v: any) => {
                const stock = v.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva?.id)?.cantidad || 0;

                return (
                  <div
                    key={v.id}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-semibold text-white text-sm">{v.color}</span>
                      <span className="mx-2 text-slate-500">•</span>
                      <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-sky-400 font-bold">
                        Talle {v.talles_catalogo?.etiqueta}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock > 0 ? `${stock} en stock` : 'Sin stock'}
                      </span>

                      <button
                        disabled={stock <= 0 && navigator.onLine}
                        onClick={() => agregarItemAlCarrito(v, productoSeleccionado)}
                        className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mostrarModalCobro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Finalizar Venta</h3>
            
            {errorCobro && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorCobro}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400">Total a Cobrar:</p>
              <p className="text-2xl font-black text-emerald-400">${totalFinal.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase font-bold text-slate-400">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['efectivo', 'transferencia', 'debito', 'credito', 'mixto'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    className={`py-2 px-3 rounded-lg border font-bold capitalize cursor-pointer transition-colors ${
                      metodoPago === m
                        ? 'bg-sky-500 border-sky-400 text-slate-950'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {m === 'transferencia' ? 'Mercado Pago / Transf.' : m}
                  </button>
                ))}
              </div>
            </div>

            {metodoPago === 'mixto' && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Efectivo ($)</label>
                  <input
                    type="number"
                    placeholder="Monto"
                    value={montoEfectivoMixto}
                    onChange={(e) => setMontoEfectivoMixto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Digital ($)</label>
                  <input
                    type="number"
                    placeholder="Monto"
                    value={montoDigitalMixto}
                    onChange={(e) => setMontoDigitalMixto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-slate-800 pt-3 space-y-2">
              <label className="block text-xs uppercase font-bold text-slate-400">Cliente (Para WhatsApp)</label>
              <input
                type="text"
                placeholder="Nombre del cliente (opcional)"
                value={nombreCliente}
                onChange={(e) => setNombreCliente(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white mb-2"
              />
              <input
                type="text"
                placeholder="Número de WhatsApp (ej. 2634404400)"
                value={telefonoCliente}
                onChange={(e) => setTelefonoCliente(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setMostrarModalCobro(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarVenta}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Ventas del Turno (Para Vendedor - Solo Lectura) */}
      {mostrarModalHistorial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-sky-400" />
                  Ventas Cobradas en este Turno
                </h3>
                <p className="text-xs text-slate-400">
                  Historial de tickets emitidos bajo la caja activa de {sucursalActiva?.nombre}.
                </p>
              </div>
              <button
                onClick={() => {
                  setMostrarModalHistorial(false);
                  setTicketDetalleVendedor(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {!ticketDetalleVendedor ? (
              <div className="overflow-x-auto max-h-96 border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Hora</th>
                      <th className="px-3 py-2.5">Cliente</th>
                      <th className="px-3 py-2.5">Método de Pago</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5 text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ventasTurno.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500">
                          Todavía no registraste ventas en este turno de caja.
                        </td>
                      </tr>
                    ) : (
                      ventasTurno.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2.5 font-mono text-slate-300">
                            {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            {v.clientes?.nombre || 'Consumidor Final'}
                          </td>
                          <td className="px-3 py-2.5 capitalize text-slate-300">
                            {v.metodo_pago === 'transferencia' ? 'Mercado Pago' : v.metodo_pago}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-400 font-mono">
                            ${Number(v.total_final).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => setTicketDetalleVendedor(v)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Ver
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setTicketDetalleVendedor(null)}
                  className="text-xs text-sky-400 hover:underline font-semibold"
                >
                  ← Volver a la lista de ventas
                </button>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-baseline border-b border-slate-800 pb-2 text-xs">
                    <span className="text-slate-400">Hora: {new Date(ticketDetalleVendedor.created_at).toLocaleTimeString()} hs</span>
                    <span className="font-bold text-emerald-400 text-sm">${Number(ticketDetalleVendedor.total_final).toLocaleString()}</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold uppercase text-[10px] text-slate-500">Prendas:</p>
                    {ticketDetalleVendedor.ventas_detalle?.map((d: any) => (
                      <div key={d.id} className="flex justify-between text-slate-300">
                        <span>{d.variantes?.productos?.nombre} ({d.variantes?.color} - Talle {d.variantes?.talles_catalogo?.etiqueta}) ×{d.cantidad}</span>
                        <span className="font-mono">${Number(d.subtotal_linea).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400 capitalize">Pago: {ticketDetalleVendedor.metodo_pago}</span>
                    <a
                      href={`/ticket/${ticketDetalleVendedor.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Ticket Digital
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};