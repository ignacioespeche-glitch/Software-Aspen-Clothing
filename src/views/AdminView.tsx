import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Sucursal } from '../types/database';
import { 
  BarChart3, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Clock, 
  Layers, 
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  Percent,
  Receipt,
  Eye,
  Edit2,
  Check,
  X,
  ExternalLink,
  ArrowLeftRight,
  Search,
  Calendar
} from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HORAS_JORNADA = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface MetricaMes {
  anio: number;
  mes: number;
  totalVentas: number;
  totalPrendas: number;
}

export const AdminView = () => {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');
  
  const [ventas, setVentas] = useState<any[]>([]);
  const [detallesVenta, setDetallesVenta] = useState<any[]>([]);
  const [productosConStock, setProductosConStock] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [todosLosTraspasos, setTodosLosTraspasos] = useState<any[]>([]);

  const [busquedaMatrizStock, setBusquedaMatrizStock] = useState<string>('');

  const anioActual = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActual);
  const [filtroFechaHistorial, setFiltroFechaHistorial] = useState<string>('');
  const [busquedaTextoHistorial, setBusquedaTextoHistorial] = useState<string>('');
  const [mesFiltroActivo, setMesFiltroActivo] = useState<number | null>(null);

  const [ventaSeleccionada, setVentaSeleccionada] = useState<any | null>(null);
  const [editandoMetodo, setEditandoMetodo] = useState<boolean>(false);
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState<string>('');

  useEffect(() => {
    cargarDatosAdmin();
  }, [filtroSucursal]);

  const cargarDatosAdmin = async () => {
    const { data: sucs } = await supabase.from('sucursales').select('*').order('nombre');
    if (sucs) setSucursales(sucs as Sucursal[]);

    let queryVentas = supabase
      .from('ventas')
      .select(`
        *,
        sucursales (nombre),
        perfiles (nombre, apellido),
        clientes (nombre, telefono_whatsapp),
        ventas_detalle (
          id,
          cantidad,
          precio_unitario_cobrado,
          costo_unitario_historico,
          subtotal_linea,
          variantes (
            color,
            talles_catalogo (etiqueta),
            productos (nombre)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (filtroSucursal !== 'todas') {
      queryVentas = queryVentas.eq('sucursal_id', filtroSucursal);
    }

    const { data: ventasData } = await queryVentas;
    if (ventasData) setVentas(ventasData);

    const { data: detallesData } = await supabase
      .from('ventas_detalle')
      .select('*, ventas!inner(sucursal_id, created_at, estado), variantes (productos (nombre, precio_costo, precio_venta))')
      .eq('ventas.estado', 'completada');

    let detallesFiltrados = detallesData || [];
    if (filtroSucursal !== 'todas') {
      detallesFiltrados = detallesFiltrados.filter((d: any) => d.ventas?.sucursal_id === filtroSucursal);
    }
    setDetallesVenta(detallesFiltrados);

    const { data: prodsStock } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        precio_costo,
        precio_venta,
        variantes (
          id,
          color,
          talles_catalogo (etiqueta, tipo_curva),
          stock_sucursal (cantidad, sucursal_id)
        )
      `)
      .eq('activo', true)
      .order('nombre');

    if (prodsStock) setProductosConStock(prodsStock);

    const { data: usersData } = await supabase
      .from('perfiles')
      .select('*, sucursales (nombre)')
      .order('created_at', { ascending: false });

    if (usersData) setUsuarios(usersData);

    const { data: traspasosData } = await supabase
      .from('traspasos')
      .select(`
        *,
        sucursal_origen:sucursal_origen_id (nombre),
        sucursal_destino:sucursal_destino_id (nombre),
        usuario_emisor:usuario_emisor_id (nombre, apellido),
        usuario_receptor:usuario_receptor_id (nombre, apellido),
        traspasos_detalle (
          cantidad_enviada,
          variantes (
            color,
            talles_catalogo (etiqueta),
            productos (nombre)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (traspasosData) {
      if (filtroSucursal !== 'todas') {
        setTodosLosTraspasos(
          traspasosData.filter(
            (t: any) => t.sucursal_origen_id === filtroSucursal || t.sucursal_destino_id === filtroSucursal
          )
        );
      } else {
        setTodosLosTraspasos(traspasosData);
      }
    }
  };

  const handleCambiarEstadoUsuario = async (userId: string, nuevoEstado: boolean) => {
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', userId);

    if (error) {
      alert('Error actualizando permisos: ' + error.message);
    } else {
      cargarDatosAdmin();
    }
  };

  const handleCambiarSucursalUsuario = async (userId: string, nuevaSucursalId: string) => {
    const { error } = await supabase
      .from('perfiles')
      .update({ sucursal_id: nuevaSucursalId || null })
      .eq('id', userId);

    if (error) {
      alert('Error cambiando sucursal: ' + error.message);
    } else {
      cargarDatosAdmin();
    }
  };

  const handleGuardarMetodoPago = async () => {
    if (!ventaSeleccionada || !nuevoMetodoPago) return;

    const { error } = await supabase
      .from('ventas')
      .update({ metodo_pago: nuevoMetodoPago })
      .eq('id', ventaSeleccionada.id);

    if (error) {
      alert('Error al actualizar el método de pago: ' + error.message);
    } else {
      setVentaSeleccionada({ ...ventaSeleccionada, metodo_pago: nuevoMetodoPago });
      setEditandoMetodo(false);
      cargarDatosAdmin();
    }
  };

  const ventasValidas = ventas.filter((v) => v.estado === 'completada');
  const totalFacturado = ventasValidas.reduce((acc, v) => acc + Number(v.total_final), 0);
  const totalTickets = ventasValidas.length;
  const ticketPromedio = totalTickets > 0 ? totalFacturado / totalTickets : 0;

  const costoTotalHistorico = detallesVenta.reduce((acc, d) => acc + (Number(d.costo_unitario_historico) * d.cantidad), 0);
  const facturadoDetalles = detallesVenta.reduce((acc, d) => acc + Number(d.subtotal_linea), 0);
  const gananciaBruta = Math.max(0, facturadoDetalles - costoTotalHistorico);
  const margenPromedio = facturadoDetalles > 0 ? (gananciaBruta / facturadoDetalles) * 100 : 0;

  const pagosPorMetodo: { [key: string]: number } = {};
  ventasValidas.forEach((v) => {
    const met = v.metodo_pago;
    pagosPorMetodo[met] = (pagosPorMetodo[met] || 0) + Number(v.total_final);
  });

  const heatmapMatriz: { [key: string]: number } = {};
  ventasValidas.forEach((v) => {
    const d = new Date(v.created_at);
    const diaIndex = (d.getDay() + 6) % 7;
    const hora = d.getHours();
    if (hora >= 9 && hora <= 22) {
      const clave = `${diaIndex}-${hora}`;
      heatmapMatriz[clave] = (heatmapMatriz[clave] || 0) + 1;
    }
  });

  const getHeatmapColor = (conteo: number) => {
    if (!conteo || conteo === 0) return 'bg-slate-950 text-slate-600 border border-slate-900';
    if (conteo === 1) return 'bg-emerald-950 text-emerald-400 border border-emerald-800/40';
    if (conteo <= 3) return 'bg-emerald-700 text-white font-bold';
    if (conteo <= 6) return 'bg-amber-600 text-white font-bold';
    return 'bg-rose-600 text-white font-black animate-pulse';
  };

  const calcularMetricasMensuales = (anio: number): { [mes: number]: MetricaMes } => {
    const resultado: { [mes: number]: MetricaMes } = {};
    for (let m = 0; m < 12; m++) {
      resultado[m] = { anio, mes: m, totalVentas: 0, totalPrendas: 0 };
    }

    ventasValidas.forEach((v) => {
      const d = new Date(v.created_at);
      if (d.getFullYear() === anio) {
        const m = d.getMonth();
        resultado[m].totalVentas += Number(v.total_final);
      }
    });

    detallesVenta.forEach((d) => {
      const fecha = new Date(d.ventas?.created_at || d.created_at);
      if (fecha.getFullYear() === anio) {
        const m = fecha.getMonth();
        if (resultado[m]) {
          resultado[m].totalPrendas += Number(d.cantidad);
        }
      }
    });

    return resultado;
  };

  const metricasAnioActual = calcularMetricasMensuales(anioSeleccionado);
  const metricasAnioAnterior = calcularMetricasMensuales(anioSeleccionado - 1);

  const getFechaLocalYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const ponerFechaHoy = () => {
    setFiltroFechaHistorial(getFechaLocalYYYYMMDD(new Date()));
    setMesFiltroActivo(null);
  };

  const ventasFiltradasHistorial = ventas.filter((v) => {
    const d = new Date(v.created_at);
    
    if (filtroFechaHistorial) {
      const fechaLocalVenta = getFechaLocalYYYYMMDD(d);
      if (fechaLocalVenta !== filtroFechaHistorial) return false;
    }

    if (mesFiltroActivo !== null) {
      if (d.getFullYear() !== anioSeleccionado || d.getMonth() !== mesFiltroActivo) {
        return false;
      }
    }

    if (busquedaTextoHistorial.trim()) {
      const q = busquedaTextoHistorial.toLowerCase().trim();
      const atendio = `${v.perfiles?.nombre || ''} ${v.perfiles?.apellido || ''}`.toLowerCase();
      const cliente = (v.clientes?.nombre || '').toLowerCase();
      const fechaStr = d.toLocaleDateString();
      const metodo = (v.metodo_pago || '').toLowerCase();
      const coincide = atendio.includes(q) || cliente.includes(q) || fechaStr.includes(q) || metodo.includes(q);
      if (!coincide) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-400" />
            Panel Ejecutivo & Métricas de Marca
          </h1>
          <p className="text-sm text-slate-400">
            Control consolidado de facturación, rentabilidad y asignación de personal.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold uppercase">Sucursal:</span>
          <select
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
          >
            <option value="todas" className="bg-slate-900">Todas (Marca Consolidada)</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900">{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Recaudación Total</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">${totalFacturado.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> En tiempo real
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Promedio</span>
            <ShoppingBag className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-white">${Math.round(ticketPromedio).toLocaleString()}</p>
          <p className="text-[11px] text-slate-400">Sobre {totalTickets} operaciones registradas</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Margen Bruto Estimado</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-sky-400">+{margenPromedio.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-400">${gananciaBruta.toLocaleString()} utilidad real</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Canal Digital vs Efectivo</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xs font-bold text-slate-200 mt-2">
            Efectivo: ${Number(pagosPorMetodo['efectivo'] || 0).toLocaleString()}
          </p>
          <p className="text-xs font-bold text-sky-400">
            MP / Tarjetas: ${(totalFacturado - Number(pagosPorMetodo['efectivo'] || 0)).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-sky-400" />
              Historial de Ventas Detallado (Auditoría)
            </h2>
            <p className="text-xs text-slate-400">
              {mesFiltroActivo !== null 
                ? `Mostrando ventas de ${MESES[mesFiltroActivo]} ${anioSeleccionado}`
                : filtroFechaHistorial 
                  ? `Filtrando tickets del ${filtroFechaHistorial.split('-').reverse().join('/')}`
                  : 'Registro cronológico con vendedor responsable, método de pago y prendas vendidas.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {mesFiltroActivo !== null && (
              <button
                onClick={() => setMesFiltroActivo(null)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Quitar {MESES[mesFiltroActivo]}
              </button>
            )}

            <button
              onClick={ponerFechaHoy}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroFechaHistorial === getFechaLocalYYYYMMDD(new Date())
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Hoy
            </button>

            <div className="relative">
              <input
                type="date"
                value={filtroFechaHistorial}
                onChange={(e) => {
                  setFiltroFechaHistorial(e.target.value);
                  setMesFiltroActivo(null);
                }}
                className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 cursor-pointer font-sans"
              />
            </div>

            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar ticket, cliente o vendedor..."
                value={busquedaTextoHistorial}
                onChange={(e) => setBusquedaTextoHistorial(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-60"
              />
            </div>

            {(filtroFechaHistorial || busquedaTextoHistorial) && (
              <button
                onClick={() => {
                  setFiltroFechaHistorial('');
                  setBusquedaTextoHistorial('');
                }}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 cursor-pointer font-semibold"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Fecha & Hora</th>
                <th className="px-3 py-3">Sucursal</th>
                <th className="px-3 py-3">Atendido Por</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Método de Pago</th>
                <th className="px-3 py-3 text-right">Total Cobrado</th>
                <th className="px-3 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ventasFiltradasHistorial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500">
                    No hay operaciones registradas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                ventasFiltradasHistorial.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {new Date(v.created_at).toLocaleDateString()} • {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-300">
                      {v.sucursales?.nombre}
                    </td>
                    <td className="px-3 py-3 font-semibold text-sky-400">
                      {v.perfiles ? `${v.perfiles.nombre} ${v.perfiles.apellido || ''}` : 'Vendedor Mostrador'}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {v.clientes?.nombre || 'Consumidor Final'}
                    </td>
                    <td className="px-3 py-3 capitalize font-bold text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {v.metodo_pago === 'transferencia' ? 'Mercado Pago / Transf.' : v.metodo_pago}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-black text-emerald-400 font-mono text-sm">
                      ${Number(v.total_final).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => {
                          setVentaSeleccionada(v);
                          setNuevoMetodoPago(v.metodo_pago);
                          setEditandoMetodo(false);
                        }}
                        className="bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 px-2.5 py-1.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-sky-400" />
              Trazabilidad de Traspasos & Rotación de Stock
            </h2>
            <p className="text-xs text-slate-400">
              Auditoría global de envíos entre locales con operadores emisores y receptores identificados.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {todosLosTraspasos.length} remitos registrados
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Fecha & Hora</th>
                <th className="px-3 py-3">Origen</th>
                <th className="px-3 py-3">Destino</th>
                <th className="px-3 py-3">Despachado Por</th>
                <th className="px-3 py-3">Aceptado / Recibido Por</th>
                <th className="px-3 py-3">Prenda & Detalle</th>
                <th className="px-3 py-3 text-center">Cantidad</th>
                <th className="px-3 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {todosLosTraspasos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-500">
                    No se registran movimientos logísticos entre locales.
                  </td>
                </tr>
              ) : (
                todosLosTraspasos.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {new Date(t.created_at).toLocaleDateString()} • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                    </td>
                    <td className="px-3 py-3 font-bold text-white">
                      {t.sucursal_origen?.nombre}
                    </td>
                    <td className="px-3 py-3 font-bold text-sky-400">
                      {t.sucursal_destino?.nombre}
                    </td>
                    <td className="px-3 py-3 text-slate-300 font-semibold">
                      {t.usuario_emisor ? `${t.usuario_emisor.nombre} ${t.usuario_emisor.apellido || ''}` : 'Operador Aspen'}
                    </td>
                    <td className="px-3 py-3">
                      {t.usuario_receptor ? (
                        <span className="text-emerald-400 font-semibold">
                          {t.usuario_receptor.nombre} {t.usuario_receptor.apellido || ''}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold italic">Pendiente de recepción</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {t.traspasos_detalle?.map((d: any, idx: number) => (
                        <span key={idx}>
                          {d.variantes?.productos?.nombre} ({d.variantes?.color} • Talle {d.variantes?.talles_catalogo?.etiqueta})
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-slate-100 font-mono">
                      {t.traspasos_detalle?.reduce((acc: number, d: any) => acc + d.cantidad_enviada, 0)} unid.
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          t.estado === 'recibido'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {t.estado === 'recibido' ? 'Recibido' : 'En Tránsito'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              Histórico Mensual & Comparativa Interanual
            </h2>
            <p className="text-xs text-slate-400">
              Hacé clic sobre cualquier mes para filtrar el historial de tickets de ese período.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold uppercase">Año:</span>
            <select
              value={anioSeleccionado}
              onChange={(e) => {
                setAnioSeleccionado(parseInt(e.target.value));
                setMesFiltroActivo(null);
              }}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              {[anioActual, anioActual - 1, anioActual - 2].map((a) => (
                <option key={a} value={a} className="bg-slate-900">{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Mes</th>
                <th className="px-4 py-3 text-right">Recaudación {anioSeleccionado - 1}</th>
                <th className="px-4 py-3 text-right">Recaudación {anioSeleccionado}</th>
                <th className="px-4 py-3 text-center">Prendas ({anioSeleccionado})</th>
                <th className="px-4 py-3 text-right">Crecimiento Interanual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {MESES.map((nombreMes, idx) => {
                const actual = metricasAnioActual[idx]?.totalVentas || 0;
                const anterior = metricasAnioAnterior[idx]?.totalVentas || 0;
                const prendas = metricasAnioActual[idx]?.totalPrendas || 0;

                let crecimiento: number | null = null;
                if (anterior > 0) {
                  crecimiento = ((actual - anterior) / anterior) * 100;
                }

                const esMesSeleccionado = mesFiltroActivo === idx;

                return (
                  <tr 
                    key={nombreMes} 
                    onClick={() => {
                      setMesFiltroActivo(idx);
                      setFiltroFechaHistorial('');
                    }}
                    className={`cursor-pointer transition-colors ${
                      esMesSeleccionado ? 'bg-sky-500/10 border-l-4 border-sky-400' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                      {nombreMes}
                      {actual > 0 && (
                        <span className="text-[10px] bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded font-mono">
                          Ver tickets
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono">
                      ${anterior.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-100 font-mono">
                      ${actual.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-sky-400">
                      {prendas > 0 ? `${prendas} unid.` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {anterior === 0 && actual === 0 ? (
                        <span className="text-slate-600">-</span>
                      ) : anterior === 0 && actual > 0 ? (
                        <span className="text-emerald-400 font-semibold">+100% (Nuevo)</span>
                      ) : crecimiento !== null ? (
                        <span
                          className={`flex items-center justify-end gap-1 ${
                            crecimiento >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <Percent className="w-3 h-3" />
                          {crecimiento >= 0 ? '+' : ''}{crecimiento.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" /> Personal y Control de Accesos
        </h2>
        <p className="text-xs text-slate-400">
          Aprobá cuentas de empleados y reasigná su local de trabajo directamente desde aquí.
        </p>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Nombre Completo</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Sucursal Asignada</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-bold text-white">
                    {u.nombre} {u.apellido || ''}
                  </td>
                  <td className="px-3 py-3">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {u.rol === 'admin' ? (
                      <span className="text-slate-400 font-semibold italic">Global (Todas)</span>
                    ) : (
                      <select
                        value={u.sucursal_id || ''}
                        onChange={(e) => handleCambiarSucursalUsuario(u.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-sky-500 font-semibold cursor-pointer"
                      >
                        {sucursales.map((s) => (
                          <option key={s.id} value={s.id} className="bg-slate-900">
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.activo
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {u.activo ? 'Habilitado' : 'Pendiente / Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {u.activo ? (
                      <button
                        onClick={() => handleCambiarEstadoUsuario(u.id, false)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Suspender
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCambiarEstadoUsuario(u.id, true)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold cursor-pointer"
                      >
                        Aprobar Cuenta
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" /> Mapa de Calor de Ventas (09:00 a 22:00 hs)
            </h2>
            <p className="text-xs text-slate-400">
              Identifica los horarios y días de mayor afluencia en mostrador para organizar turnos del personal.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
            <span>Baja</span>
            <div className="flex gap-1">
              <span className="w-3 h-3 bg-slate-950 border border-slate-800 rounded-xs"></span>
              <span className="w-3 h-3 bg-emerald-950 rounded-xs"></span>
              <span className="w-3 h-3 bg-emerald-700 rounded-xs"></span>
              <span className="w-3 h-3 bg-amber-600 rounded-xs"></span>
              <span className="w-3 h-3 bg-rose-600 rounded-xs"></span>
            </div>
            <span>Alta Afluencia</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-slate-500 font-semibold">Día / Hora</th>
                {HORAS_JORNADA.map((h) => (
                  <th key={h} className="p-2 text-slate-400 font-medium">
                    {h}h
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS_SEMANA.map((dia, dIdx) => (
                <tr key={dia}>
                  <td className="p-2 text-left font-bold text-slate-300">{dia}</td>
                  {HORAS_JORNADA.map((h) => {
                    const cant = heatmapMatriz[`${dIdx}-${h}`] || 0;
                    return (
                      <td key={h} className="p-1">
                        <div
                          title={`${cant} ventas registradas el ${dia} a las ${h}:00 hs`}
                          className={`w-full py-2 rounded text-[11px] transition-all cursor-default ${getHeatmapColor(cant)}`}
                        >
                          {cant > 0 ? cant : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" /> Matriz de Stock Global por Sucursal
            </h2>
            <p className="text-xs text-slate-400">
              Visualización simultánea de existencias cruzando talles y colores en cada local.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar prenda, color o talle..."
              value={busquedaMatrizStock}
              onChange={(e) => setBusquedaMatrizStock(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
            {busquedaMatrizStock && (
              <button
                onClick={() => setBusquedaMatrizStock('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Prenda</th>
                <th className="px-3 py-3">Color</th>
                <th className="px-3 py-3">Talle</th>
                {sucursales.map((s) => (
                  <th key={s.id} className="px-3 py-3 text-center">{s.nombre}</th>
                ))}
                <th className="px-3 py-3 text-right">Total Marca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {productosConStock.flatMap((prod) =>
                (prod.variantes || [])
                  .filter((v: any) => {
                    if (!busquedaMatrizStock.trim()) return true;
                    const termino = busquedaMatrizStock.toLowerCase().trim();
                    const coincideNombre = prod.nombre?.toLowerCase().includes(termino);
                    const coincideColor = v.color?.toLowerCase().includes(termino);
                    const coincideTalle = v.talles_catalogo?.etiqueta?.toLowerCase().includes(termino);
                    return coincideNombre || coincideColor || coincideTalle;
                  })
                  .map((v: any) => {
                    let totalPrendaMarca = 0;

                    return (
                      <tr key={v.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-bold text-white">{prod.nombre}</td>
                        <td className="px-3 py-2.5 text-slate-300">{v.color}</td>
                        <td className="px-3 py-2.5 text-sky-400 font-bold">
                          {v.talles_catalogo?.tipo_curva === 'unico' ? 'Único' : `Talle ${v.talles_catalogo?.etiqueta}`}
                        </td>
                        
                        {sucursales.map((s) => {
                          const stockLocal = v.stock_sucursal?.find((st: any) => st.sucursal_id === s.id)?.cantidad || 0;
                          totalPrendaMarca += stockLocal;

                          return (
                            <td key={s.id} className="px-3 py-2.5 text-center font-semibold">
                              <span className={stockLocal > 0 ? 'text-slate-200' : 'text-slate-600'}>
                                {stockLocal}
                              </span>
                            </td>
                          );
                        })}

                        <td className="px-3 py-2.5 text-right font-black text-emerald-400">
                          {totalPrendaMarca} unid.
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-sky-400" />
                  Auditoría de Ticket
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {ventaSeleccionada.id}</p>
              </div>
              <button
                onClick={() => setVentaSeleccionada(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 uppercase font-bold text-[10px]">Sucursal & Vendedor</span>
                <p className="font-bold text-slate-200 mt-0.5">{ventaSeleccionada.sucursales?.nombre}</p>
                <p className="text-sky-400">
                  {ventaSeleccionada.perfiles ? `${ventaSeleccionada.perfiles.nombre} ${ventaSeleccionada.perfiles.apellido || ''}` : 'Vendedor Mostrador'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-slate-500 uppercase font-bold text-[10px]">Fecha & Hora</span>
                <p className="font-bold text-slate-200 mt-0.5">
                  {new Date(ventaSeleccionada.created_at).toLocaleDateString()}
                </p>
                <p className="text-slate-400">
                  {new Date(ventaSeleccionada.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs uppercase font-bold text-slate-400">Prendas en el Ticket</h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/60 p-2 max-h-48 overflow-y-auto">
                {ventaSeleccionada.ventas_detalle?.map((d: any) => (
                  <div key={d.id} className="py-2 px-2 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{d.variantes?.productos?.nombre}</p>
                      <p className="text-[11px] text-slate-400">
                        {d.variantes?.color} • Talle {d.variantes?.talles_catalogo?.etiqueta} (×{d.cantidad})
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-200">
                      ${Number(d.subtotal_linea).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Método de Pago Registrado:</span>
                {!editandoMetodo ? (
                  <button
                    onClick={() => setEditandoMetodo(true)}
                    className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleGuardarMetodoPago}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Guardar
                    </button>
                    <button
                      onClick={() => setEditandoMetodo(false)}
                      className="text-slate-400 hover:text-slate-200 ml-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {!editandoMetodo ? (
                <p className="font-bold text-slate-200 capitalize text-sm">
                  {ventaSeleccionada.metodo_pago === 'transferencia' ? 'Mercado Pago / Transferencia' : ventaSeleccionada.metodo_pago}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['efectivo', 'transferencia', 'debito', 'credito', 'mixto'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNuevoMetodoPago(m)}
                      className={`py-1 px-2 rounded border text-[11px] font-bold capitalize cursor-pointer transition-colors ${
                        nuevoMetodoPago === m
                          ? 'bg-sky-500 border-sky-400 text-slate-950'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {m === 'transferencia' ? 'MP / Transf.' : m}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-sm">
                <span className="font-bold text-slate-300">Total Cobrado:</span>
                <span className="font-black text-emerald-400 text-base font-mono">
                  ${Number(ventaSeleccionada.total_final).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href={`/ticket/${ventaSeleccionada.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Comprobante Digital
              </a>

              <button
                type="button"
                onClick={() => setVentaSeleccionada(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};