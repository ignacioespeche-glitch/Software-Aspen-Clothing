import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Sucursal } from '../types/database';
import { 
  ArrowLeftRight, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  PackageCheck,
  Inbox,
  History,
  UserCheck
} from 'lucide-react';

interface PrendaVariante {
  id: string;
  productoNombre: string;
  color: string;
  talle: string;
  stockActual: number;
}

export const TraspasosView = () => {
  const { perfil, sucursalActiva } = useAuth();

  const [pestañaActiva, setPestañaActiva] = useState<'recibir' | 'emitir' | 'historial'>('recibir');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalDestinoId, setSucursalDestinoId] = useState('');
  
  const [variantes, setVariantes] = useState<PrendaVariante[]>([]);
  const [varianteId, setVarianteId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [observaciones, setObservaciones] = useState('Rotacion de Stock');

  const [traspasos, setTraspasos] = useState<any[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<{ [id: string]: string }>({});
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  useEffect(() => {
    cargarSucursalesYUsuarios();
  }, []);

  useEffect(() => {
    if (sucursalActiva) {
      cargarVariantesOrigen();
      cargarHistorialTraspasos();
    }
  }, [sucursalActiva]);

  const cargarSucursalesYUsuarios = async () => {
    const { data: sucs } = await supabase.from('sucursales').select('*').order('nombre');
    if (sucs) {
      setSucursales(sucs as Sucursal[]);
      const destinos = sucs.filter((s: any) => s.id !== sucursalActiva?.id);
      if (destinos.length > 0) {
        setSucursalDestinoId(destinos[0].id);
      }
    }

    const { data: users } = await supabase.from('perfiles').select('id, nombre, apellido');
    if (users) {
      const mapa: { [id: string]: string } = {};
      users.forEach((u: any) => {
        mapa[u.id] = `${u.nombre} ${u.apellido || ''}`.trim();
      });
      setUsuariosMap(mapa);
    }
  };

  const cargarVariantesOrigen = async () => {
    if (!sucursalActiva) return;

    const { data } = await supabase
      .from('variantes')
      .select(`
        id,
        color,
        talles_catalogo (etiqueta),
        productos (nombre),
        stock_sucursal (cantidad, sucursal_id)
      `)
      .eq('activo', true);

    if (data) {
      const mapeadas: PrendaVariante[] = data.map((v: any) => ({
        id: v.id,
        productoNombre: v.productos?.nombre || 'Prenda',
        color: v.color,
        talle: v.talles_catalogo?.etiqueta || '',
        stockActual: v.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva.id)?.cantidad || 0
      }));

      setVariantes(mapeadas);
      if (mapeadas.length > 0) {
        setVarianteId(mapeadas[0].id);
      }
    }
  };

  const cargarHistorialTraspasos = async () => {
    if (!sucursalActiva) return;

    const { data: traspasosRaw, error } = await supabase
      .from('traspasos')
      .select(`
        *,
        sucursal_origen:sucursal_origen_id (id, nombre),
        sucursal_destino:sucursal_destino_id (id, nombre),
        traspasos_detalle (
          id,
          variante_id,
          cantidad_enviada,
          cantidad_recibida,
          variantes (
            id,
            color,
            talles_catalogo (etiqueta),
            productos (nombre)
          )
        )
      `);

    if (error) {
      console.error('Error cargando traspasos:', error);
      return;
    }

    if (traspasosRaw) {
      const ordenados = [...traspasosRaw].sort((a, b) => {
        const fechaA = new Date(a.created_at || a.fecha_emision || 0).getTime();
        const fechaB = new Date(b.created_at || b.fecha_emision || 0).getTime();
        return fechaB - fechaA;
      });

      const filtrados = ordenados.filter(
        (t: any) => t.sucursal_origen_id === sucursalActiva.id || t.sucursal_destino_id === sucursalActiva.id
      );
      setTraspasos(filtrados);

      const pendientesParaMi = filtrados.filter(
        (t: any) => t.sucursal_destino_id === sucursalActiva.id && t.estado === 'en_transito'
      );
      if (pendientesParaMi.length > 0) {
        setPestañaActiva('recibir');
      }
    }
  };

  const handleEmitirTraspaso = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeEstado(null);

    const destinoFinal = sucursalDestinoId || sucursales.find((s) => s.id !== sucursalActiva?.id)?.id;

    if (!sucursalActiva || !destinoFinal || !varianteId) {
      setMensajeEstado({ tipo: 'error', texto: 'Completá todos los campos para despachar el remito.' });
      return;
    }

    const prenda = variantes.find((v) => v.id === varianteId);
    const cantNum = parseInt(cantidad) || 0;

    if (!prenda || cantNum <= 0) {
      setMensajeEstado({ tipo: 'error', texto: 'La cantidad a transferir debe ser mayor a 0.' });
      return;
    }

    if (cantNum > prenda.stockActual) {
      setMensajeEstado({ tipo: 'error', texto: `Stock insuficiente en ${sucursalActiva.nombre}. Solo tenés ${prenda.stockActual} unidades disponibles.` });
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const idEmisor = perfil?.id || sessionData?.session?.user?.id || null;

      const { data: traspasoData, error: tError } = await supabase
        .from('traspasos')
        .insert({
          sucursal_origen_id: sucursalActiva.id,
          sucursal_destino_id: destinoFinal,
          usuario_emisor_id: idEmisor,
          estado: 'en_transito',
          observaciones: observaciones.trim() || 'Rotación de stock'
        })
        .select('id')
        .single();

      if (tError) throw tError;

      const { error: dError } = await supabase
        .from('traspasos_detalle')
        .insert({
          traspaso_id: traspasoData.id,
          variante_id: prenda.id,
          cantidad_enviada: cantNum
        });

      if (dError) throw dError;

      const nuevoStockOrigen = Math.max(0, prenda.stockActual - cantNum);
      await supabase
        .from('stock_sucursal')
        .update({ cantidad: nuevoStockOrigen, updated_at: new Date().toISOString() })
        .eq('variante_id', prenda.id)
        .eq('sucursal_id', sucursalActiva.id);

      await supabase.from('movimientos_stock').insert({
        variante_id: prenda.id,
        sucursal_id: sucursalActiva.id,
        tipo_movimiento: 'traspaso_salida',
        cantidad_delta: -cantNum,
        stock_resultante: nuevoStockOrigen,
        referencia_id: traspasoData.id,
        usuario_id: idEmisor
      });

      setMensajeEstado({ tipo: 'exito', texto: '¡Remito emitido con éxito! La prenda quedó en tránsito hacia el destino.' });
      setCantidad('1');
      await cargarVariantesOrigen();
      await cargarHistorialTraspasos();
      setPestañaActiva('historial');
    } catch (err: any) {
      setMensajeEstado({ tipo: 'error', texto: err.message || 'Error al emitir el traspaso.' });
    }
  };

  const handleConfirmarRecepcion = async (traspaso: any) => {
    setMensajeEstado(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const idReceptor = perfil?.id || sessionData?.session?.user?.id || null;

      for (const item of traspaso.traspasos_detalle) {
        const idVar = item.variante_id || item.variantes?.id;
        const cant = Number(item.cantidad_enviada) || 1;

        if (!idVar) continue;

        const { data: stockExistente } = await supabase
          .from('stock_sucursal')
          .select('id, cantidad')
          .eq('variante_id', idVar)
          .eq('sucursal_id', traspaso.sucursal_destino_id)
          .maybeSingle();

        let nuevoStockDestino = cant;

        if (stockExistente) {
          nuevoStockDestino = Number(stockExistente.cantidad) + cant;
          await supabase
            .from('stock_sucursal')
            .update({ 
              cantidad: nuevoStockDestino, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', stockExistente.id);
        } else {
          await supabase
            .from('stock_sucursal')
            .insert({
              variante_id: idVar,
              sucursal_id: traspaso.sucursal_destino_id,
              cantidad: nuevoStockDestino,
              updated_at: new Date().toISOString()
            });
        }

        await supabase.from('movimientos_stock').insert({
          variante_id: idVar,
          sucursal_id: traspaso.sucursal_destino_id,
          tipo_movimiento: 'traspaso_entrada',
          cantidad_delta: cant,
          stock_resultante: nuevoStockDestino,
          referencia_id: traspaso.id,
          usuario_id: idReceptor
        });
      }

      const { error: updateError } = await supabase
        .from('traspasos')
        .update({
          estado: 'recibido',
          usuario_receptor_id: idReceptor,
          fecha_recepcion: new Date().toISOString()
        })
        .eq('id', traspaso.id);

      if (updateError) throw updateError;

      setMensajeEstado({ tipo: 'exito', texto: '¡Mercadería recibida e incorporada al perchero del local!' });
      await cargarVariantesOrigen();
      await cargarHistorialTraspasos();
      setPestañaActiva('historial');
    } catch (err: any) {
      setMensajeEstado({ tipo: 'error', texto: err.message || 'Error al confirmar recepción.' });
    }
  };

  const sucursalesDestinoDisponibles = sucursales.filter((s) => s.id !== sucursalActiva?.id);

  const traspasosPendientesRecepcion = traspasos.filter(
    (t) => t.sucursal_destino_id === sucursalActiva?.id && t.estado === 'en_transito'
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-sky-400" />
            Logística & Traspasos de Mercadería
          </h1>
          <p className="text-sm text-slate-400">
            Punto operativo actual: <span className="text-sky-400 font-bold">{sucursalActiva?.nombre}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setPestañaActiva('recibir')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              pestañaActiva === 'recibir'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Por Recibir</span>
            {traspasosPendientesRecepcion.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                pestañaActiva === 'recibir' ? 'bg-slate-950 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                {traspasosPendientesRecepcion.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setPestañaActiva('emitir');
              if (sucursalesDestinoDisponibles.length > 0 && !sucursalDestinoId) {
                setSucursalDestinoId(sucursalesDestinoDisponibles[0].id);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              pestañaActiva === 'emitir'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Emitir Envío</span>
          </button>

          <button
            onClick={() => setPestañaActiva('historial')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              pestañaActiva === 'historial'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial</span>
          </button>
        </div>
      </div>

      {mensajeEstado && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            mensajeEstado.tipo === 'error'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}
        >
          {mensajeEstado.tipo === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{mensajeEstado.texto}</span>
        </div>
      )}

      {pestañaActiva === 'recibir' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-amber-400" />
              Mercadería en Camino hacia {sucursalActiva?.nombre} ({traspasosPendientesRecepcion.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Revisá físicamente las prendas que llegaron al local y hacé clic en confirmar para ingresarlas al inventario.
            </p>
          </div>

          {traspasosPendientesRecepcion.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No tenés traspasos pendientes de recibir</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Todos los envíos dirigidos a {sucursalActiva?.nombre} ya fueron recibidos e ingresados al stock.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {traspasosPendientesRecepcion.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900 border-2 border-amber-500/40 rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider">
                          En Tránsito
                        </span>
                        <h4 className="font-bold text-white text-sm">
                          Desde: {t.sucursal_origen?.nombre}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {new Date(t.created_at || t.fecha_emision).toLocaleDateString()} a las {new Date(t.created_at || t.fecha_emision).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                        </p>
                        <p className="text-[11px] text-sky-400 flex items-center gap-1 font-semibold mt-0.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          Despachado por: {usuariosMap[t.usuario_emisor_id] || 'Operador Aspen'}
                        </p>
                      </div>

                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        Pendiente
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Contenido del Remito:</span>
                      {t.traspasos_detalle?.map((d: any) => (
                        <div key={d.id} className="flex justify-between items-center text-slate-200">
                          <span className="font-medium">
                            {d.variantes?.productos?.nombre} ({d.variantes?.color} • Talle {d.variantes?.talles_catalogo?.etiqueta})
                          </span>
                          <span className="font-black text-sky-400 font-mono text-sm">
                            ×{d.cantidad_enviada}
                          </span>
                        </div>
                      ))}
                    </div>

                    {t.observaciones && (
                      <p className="text-[11px] text-slate-400 italic">
                        Nota: "{t.observaciones}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleConfirmarRecepcion(t)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <PackageCheck className="w-4 h-4" /> Aceptar & Cargar al Perchero
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pestañaActiva === 'emitir' && (
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" /> Emitir Traspaso desde {sucursalActiva?.nombre}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              El stock se descuenta en el acto y queda en tránsito hasta que el local receptor lo acepte.
            </p>
          </div>

          <form onSubmit={handleEmitirTraspaso} className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Sucursal Destino</label>
              <select
                value={sucursalDestinoId}
                onChange={(e) => setSucursalDestinoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                {sucursalesDestinoDisponibles.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Prenda y Variante en Mostrador</label>
              <select
                value={varianteId}
                onChange={(e) => setVarianteId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                {variantes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productoNombre} - {v.color} (Talle {v.talle}) [Disp: {v.stockActual}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Cantidad a Enviar</label>
              <input
                type="number"
                min="1"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Motivo / Observaciones</label>
              <input
                type="text"
                placeholder="Ej. Rotación de Stock, Pedido de cliente"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Emitir Remito y Despachar
            </button>
          </form>
        </div>
      )}

      {pestañaActiva === 'historial' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" /> Registro Completo de Remitos
            </h2>
            <span className="text-xs text-slate-400 font-mono">Total: {traspasos.length} operaciones</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-3 py-3">Ruta</th>
                  <th className="px-3 py-3">Operadores</th>
                  <th className="px-3 py-3">Prenda & Talle</th>
                  <th className="px-3 py-3 text-center">Cantidad</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {traspasos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      No hay historial de traspasos registrado para este local.
                    </td>
                  </tr>
                ) : (
                  traspasos.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {new Date(t.created_at || t.fecha_emision).toLocaleDateString()} • {new Date(t.created_at || t.fecha_emision).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-bold text-white">{t.sucursal_origen?.nombre}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span className="font-bold text-sky-400">{t.sucursal_destino?.nombre}</span>
                      </td>
                      <td className="px-3 py-3 space-y-0.5">
                        <p className="text-slate-300">
                          <span className="text-slate-500 font-semibold">Envía:</span> {usuariosMap[t.usuario_emisor_id] || 'Operador'}
                        </p>
                        {t.usuario_receptor_id && (
                          <p className="text-emerald-400">
                            <span className="text-slate-500 font-semibold">Recibe:</span> {usuariosMap[t.usuario_receptor_id] || 'Operador'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {t.traspasos_detalle?.map((d: any) => (
                          <span key={d.id}>
                            {d.variantes?.productos?.nombre} ({d.variantes?.color} • {d.variantes?.talles_catalogo?.etiqueta})
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
      )}
    </div>
  );
};