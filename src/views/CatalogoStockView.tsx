import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Categoria } from '../types/database';
import { 
  Boxes, 
  Plus, 
  Save, 
  Search, 
  Check, 
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';

interface TalleCatalogo {
  id: string;
  etiqueta: string;
  tipo_curva: 'superior' | 'numerico' | 'unico';
  orden: number;
}

export const CatalogoStockView = () => {
  const { sucursalActiva } = useAuth();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [talles, setTalles] = useState<TalleCatalogo[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<any | null>(null);

  const [modoEdicion, setModoEdicion] = useState<'sumar' | 'sobrescribir'>('sumar');
  const [nuevoColor, setNuevoColor] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCategoriaId, setNuevaCategoriaId] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('');
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState('');
  const [tallesSeleccionadosIds, setTallesSeleccionadosIds] = useState<string[]>([]);
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editPrecioVenta, setEditPrecioVenta] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [eliminandoProducto, setEliminandoProducto] = useState(false);

  const [matrizValores, setMatrizValores] = useState<{ [varianteId: string]: number }>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  useEffect(() => {
    cargarDatosMaestros();
  }, []);

  useEffect(() => {
    if (sucursalActiva) {
      cargarProductos();
    }
  }, [sucursalActiva]);

  useEffect(() => {
    if (productoSeleccionado && sucursalActiva) {
      cargarMatrizValores(productoSeleccionado);
    }
  }, [productoSeleccionado, sucursalActiva]);

  const cargarDatosMaestros = async () => {
    const [resCat, resTalles] = await Promise.all([
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('talles_catalogo').select('*').order('orden')
    ]);

    if (resCat.data) {
      setCategorias(resCat.data as Categoria[]);
      if (resCat.data.length > 0 && !nuevaCategoriaId) {
        setNuevaCategoriaId(resCat.data[0].id);
      }
    }
    if (resTalles.data) {
      const tallesData = resTalles.data as TalleCatalogo[];
      setTalles(tallesData);
      const superiores = tallesData.filter((t) => t.tipo_curva === 'superior').map((t) => t.id);
      setTallesSeleccionadosIds(superiores);
    }
  };

  const cargarProductos = async () => {
    const { data } = await supabase
      .from('productos')
      .select(`
        *,
        categorias (id, nombre),
        variantes (
          id,
          color,
          sku_interno,
          talle_id,
          talles_catalogo (id, etiqueta, orden, tipo_curva),
          stock_sucursal (cantidad, sucursal_id)
        )
      `)
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setProductos(data);
      if (data.length > 0 && !productoSeleccionado) {
        setProductoSeleccionado(data[0]);
      } else if (productoSeleccionado) {
        const prodActualizado = data.find((p) => p.id === productoSeleccionado.id);
        setProductoSeleccionado(prodActualizado || (data.length > 0 ? data[0] : null));
      } else if (data.length === 0) {
        setProductoSeleccionado(null);
      }
    }
  };

  const cargarMatrizValores = (prod: any) => {
    const mapa: { [key: string]: number } = {};
    prod.variantes?.forEach((v: any) => {
      const stock = v.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva?.id)?.cantidad || 0;
      mapa[v.id] = stock;
    });
    setMatrizValores(mapa);
  };

  const obtenerTipoCurvaPorCategoria = (catId: string): 'superior' | 'numerico' | 'unico' => {
    const cat = categorias.find((c) => c.id === catId);
    if (!cat) return 'superior';
    const nom = cat.nombre.toLowerCase();

    if (nom.includes('pantalon') || nom.includes('bermuda') || nom.includes('denim')) {
      return 'numerico';
    }
    if (nom.includes('accesorio')) {
      return 'unico';
    }
    return 'superior';
  };

  const handleCambiarCategoriaModal = (catId: string) => {
    setNuevaCategoriaId(catId);
    setErrorModal(null);
    const curva = obtenerTipoCurvaPorCategoria(catId);
    const tallesDisponibles = talles.filter((t) => t.tipo_curva === curva);

    if (curva === 'superior') {
      const comunes = tallesDisponibles
        .filter((t) => ['S', 'M', 'L', 'XL'].includes(t.etiqueta))
        .map((t) => t.id);
      setTallesSeleccionadosIds(comunes.length > 0 ? comunes : tallesDisponibles.map((t) => t.id));
    } else {
      setTallesSeleccionadosIds(tallesDisponibles.map((t) => t.id));
    }
  };

  const toggleTalleSeleccionado = (talleId: string) => {
    setErrorModal(null);
    setTallesSeleccionadosIds((prev) =>
      prev.includes(talleId) ? prev.filter((id) => id !== talleId) : [...prev, talleId]
    );
  };

  const handleCrearProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorModal(null);
    setMensaje(null);

    if (!nuevoNombre.trim() || !nuevaCategoriaId || !nuevoCosto || !nuevoPrecioVenta) {
      setErrorModal('Completá todos los campos del producto.');
      return;
    }

    if (tallesSeleccionadosIds.length === 0) {
      setErrorModal('Tenés que seleccionar al menos un talle para este producto.');
      return;
    }

    setCreandoProducto(true);

    try {
      const { data: prodData, error: prodErr } = await supabase
        .from('productos')
        .insert({
          nombre: nuevoNombre.trim(),
          categoria_id: nuevaCategoriaId,
          precio_costo: parseFloat(nuevoCosto),
          precio_venta: parseFloat(nuevoPrecioVenta),
          activo: true
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      const tallesACrear = talles.filter((t) => tallesSeleccionadosIds.includes(t.id));
      const colorInicial = 'Negro';

      for (const t of tallesACrear) {
        const skuGenerado = `${prodData.nombre.replace(/\s+/g, '').substring(0, 4).toUpperCase()}-${colorInicial.substring(0, 3).toUpperCase()}-${t.etiqueta}-${Date.now().toString().slice(-4)}`;

        const { data: varData, error: varErr } = await supabase
          .from('variantes')
          .insert({
            producto_id: prodData.id,
            talle_id: t.id,
            color: colorInicial,
            sku_interno: skuGenerado
          })
          .select()
          .single();

        if (varErr) throw varErr;

        if (varData && sucursalActiva) {
          await supabase.from('stock_sucursal').insert({
            variante_id: varData.id,
            sucursal_id: sucursalActiva.id,
            cantidad: 0
          });
        }
      }

      setMostrarModalNuevo(false);
      setNuevoNombre('');
      setNuevoCosto('');
      setNuevoPrecioVenta('');
      await cargarProductos();
      setProductoSeleccionado(prodData);
      setMensaje({ tipo: 'exito', texto: '¡Prenda creada exitosamente con los talles elegidos!' });
    } catch (err: any) {
      setErrorModal(err.message || 'Error al guardar en la base de datos.');
    } finally {
      setCreandoProducto(false);
    }
  };

  const abrirModalEditar = () => {
    if (!productoSeleccionado) return;
    setEditNombre(productoSeleccionado.nombre);
    setEditCategoriaId(productoSeleccionado.categoria_id);
    setEditCosto(productoSeleccionado.precio_costo.toString());
    setEditPrecioVenta(productoSeleccionado.precio_venta.toString());
    setMostrarModalEditar(true);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoSeleccionado) return;

    setGuardandoEdicion(true);
    setMensaje(null);

    try {
      const { error } = await supabase
        .from('productos')
        .update({
          nombre: editNombre.trim(),
          categoria_id: editCategoriaId,
          precio_costo: parseFloat(editCosto),
          precio_venta: parseFloat(editPrecioVenta)
        })
        .eq('id', productoSeleccionado.id);

      if (error) throw error;

      setMostrarModalEditar(false);
      await cargarProductos();
      setMensaje({ tipo: 'exito', texto: '¡Datos de la prenda actualizados correctamente!' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error actualizando los datos de la prenda.' });
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleEliminarProducto = async () => {
    if (!productoSeleccionado) return;
    setEliminandoProducto(true);
    setMensaje(null);

    try {
      const { error: errFisico } = await supabase
        .from('productos')
        .delete()
        .eq('id', productoSeleccionado.id);

      if (errFisico) {
        const { error: errLogico } = await supabase
          .from('productos')
          .update({ activo: false })
          .eq('id', productoSeleccionado.id);

        if (errLogico) throw errLogico;
      }

      setMostrarModalEliminar(false);
      setProductoSeleccionado(null);
      await cargarProductos();
      setMensaje({ tipo: 'exito', texto: '¡Prenda eliminada del catálogo y percheros!' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al eliminar la prenda.' });
    } finally {
      setEliminandoProducto(false);
    }
  };

  const handleAgregarColor = async () => {
    if (!productoSeleccionado || !nuevoColor.trim() || !sucursalActiva) return;

    const colorFormateado = nuevoColor.trim();
    const tallesActualesIds = Array.from(
      new Set(productoSeleccionado.variantes?.map((v: any) => v.talle_id) || [])
    ) as string[];

    const tallesAptos = talles.filter((t) => tallesActualesIds.includes(t.id));

    for (const t of tallesAptos) {
      const skuGenerado = `${productoSeleccionado.nombre.replace(/\s+/g, '').substring(0, 4).toUpperCase()}-${colorFormateado.substring(0, 3).toUpperCase()}-${t.etiqueta}-${Date.now().toString().slice(-4)}`;

      const { data: varData } = await supabase
        .from('variantes')
        .insert({
          producto_id: productoSeleccionado.id,
          talle_id: t.id,
          color: colorFormateado,
          sku_interno: skuGenerado
        })
        .select()
        .single();

      if (varData) {
        await supabase.from('stock_sucursal').insert({
          variante_id: varData.id,
          sucursal_id: sucursalActiva.id,
          cantidad: 0
        });
      }
    }

    setNuevoColor('');
    await cargarProductos();
  };

  const handleGuardarStock = async () => {
    if (!productoSeleccionado || !sucursalActiva) return;
    setGuardando(true);
    setMensaje(null);

    try {
      for (const variante of productoSeleccionado.variantes || []) {
        const valorInput = matrizValores[variante.id] ?? 0;
        const stockActual = variante.stock_sucursal?.find((s: any) => s.sucursal_id === sucursalActiva.id)?.cantidad || 0;

        let nuevoStock = valorInput;
        if (modoEdicion === 'sumar') {
          nuevoStock = stockActual + valorInput;
        }

        const finalCalculado = Math.max(0, nuevoStock);

        await supabase
          .from('stock_sucursal')
          .upsert({
            variante_id: variante.id,
            sucursal_id: sucursalActiva.id,
            cantidad: finalCalculado,
            updated_at: new Date().toISOString()
          }, { onConflict: 'variante_id,sucursal_id' });
      }

      setMensaje({ tipo: 'exito', texto: `¡Stock guardado en ${sucursalActiva.nombre}!` });
      await cargarProductos();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error guardando stock.' });
    } finally {
      setGuardando(false);
    }
  };

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const coloresAgrupados = Array.from(
    new Set(productoSeleccionado?.variantes?.map((v: any) => v.color) || [])
  ) as string[];

  const mapaTalles = new Map<string, TalleCatalogo>();
  productoSeleccionado?.variantes?.forEach((v: any) => {
    if (v.talles_catalogo && !mapaTalles.has(v.talles_catalogo.id)) {
      mapaTalles.set(v.talles_catalogo.id, v.talles_catalogo as TalleCatalogo);
    }
  });

  const tallesDeLaPrenda: TalleCatalogo[] = Array.from(mapaTalles.values()).sort(
    (a, b) => a.orden - b.orden
  );

  const curvaActualModal = obtenerTipoCurvaPorCategoria(nuevaCategoriaId);
  const tallesDisponiblesModal = talles.filter((t) => t.tipo_curva === curvaActualModal);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-sky-400" />
            Catálogo & Matriz de Stock
          </h1>
          <p className="text-sm text-slate-400">
            Control de inventario por talle y color para <strong className="text-sky-400">{sucursalActiva?.nombre}</strong>
          </p>
        </div>

        <button
          onClick={() => {
            setMostrarModalNuevo(true);
            setErrorModal(null);
            if (categorias.length > 0) {
              handleCambiarCategoriaModal(categorias[0].id);
            }
          }}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
        >
          <Plus className="w-4 h-4" /> Nuevo Producto Base
        </button>
      </div>

      {mensaje && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            mensaje.tipo === 'error'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}
        >
          {mensaje.tipo === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar prenda..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {productosFiltrados.map((prod) => (
              <div
                key={prod.id}
                onClick={() => setProductoSeleccionado(prod)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  productoSeleccionado?.id === prod.id
                    ? 'bg-sky-500/10 border-sky-500/60 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-xs">{prod.nombre}</h4>
                    <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                      {prod.categorias?.nombre}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    ${Number(prod.precio_venta).toLocaleString()}
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-900 flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Costo: ${Number(prod.precio_costo).toLocaleString()}</span>
                  <span className="text-sky-400 font-bold">
                    Margen: +{Math.round(((prod.precio_venta - prod.precio_costo) / prod.precio_costo) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          {productoSeleccionado ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-white">
                      Matriz de Stock: {productoSeleccionado.nombre}
                    </h2>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={abrirModalEditar}
                        title="Editar nombre, costo y precio"
                        className="p-1.5 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setMostrarModalEliminar(true)}
                        title="Eliminar prenda del inventario"
                        className="p-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Navegá entre casilleros con la tecla <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Tab</kbd>
                  </p>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setModoEdicion('sumar')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      modoEdicion === 'sumar'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Modo Sumar (+)
                  </button>
                  <button
                    onClick={() => setModoEdicion('sobrescribir')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      modoEdicion === 'sobrescribir'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Modo Sobrescribir (=)
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar color (ej. Negro, Washed, White, Gris)"
                  value={nuevoColor}
                  onChange={(e) => setNuevoColor(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white flex-1 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleAgregarColor}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  + Color
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Color</th>
                      {tallesDeLaPrenda.map((t) => (
                        <th key={t.id} className="px-3 py-3 text-center">
                          {t.tipo_curva === 'unico' ? 'Único' : `Talle ${t.etiqueta}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {coloresAgrupados.map((color) => (
                      <tr key={color} className="hover:bg-slate-800/20">
                        <td className="px-4 py-3 font-bold text-white capitalize">
                          {color}
                        </td>
                        {tallesDeLaPrenda.map((t) => {
                          const variante = productoSeleccionado.variantes?.find(
                            (v: any) => v.color.toLowerCase() === color.toLowerCase() && v.talle_id === t.id
                          );

                          if (!variante) {
                            return <td key={t.id} className="text-center text-slate-600">-</td>;
                          }

                          return (
                            <td key={t.id} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={matrizValores[variante.id] ?? 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setMatrizValores({
                                    ...matrizValores,
                                    [variante.id]: val
                                  });
                                }}
                                className="w-16 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded px-2 py-1.5 text-center text-white font-mono font-bold text-xs"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={guardando}
                  onClick={handleGuardarStock}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-extrabold px-6 py-2.5 rounded-lg text-xs flex items-center gap-2 uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : `Guardar Stock en ${sucursalActiva?.nombre}`}
                </button>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              Seleccioná un producto del listado o creá uno nuevo.
            </div>
          )}
        </div>
      </div>

      {mostrarModalEditar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" /> Editar Datos de la Prenda
              </h3>
              <button
                onClick={() => setMostrarModalEditar(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-bold text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block uppercase font-bold text-slate-400 mb-1">Categoría</label>
                <select
                  value={editCategoriaId}
                  onChange={(e) => setEditCategoriaId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase font-bold text-slate-400 mb-1">Costo Compra/Taller ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCosto}
                    onChange={(e) => setEditCosto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-slate-400 mb-1">Precio Venta Mostrador ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrecioVenta}
                    onChange={(e) => setEditPrecioVenta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarModalEditar(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-lg cursor-pointer uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  {guardandoEdicion && <Loader2 className="w-4 h-4 animate-spin" />}
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarModalEliminar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black uppercase text-white">
                ¿Eliminar {productoSeleccionado?.nombre}?
              </h3>
              <p className="text-xs text-slate-400">
                Esta acción dará de baja la prenda y sus variantes del catálogo y no estará disponible para nuevas ventas.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalEliminar(false)}
                className="w-1/2 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer hover:bg-slate-700 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminandoProducto}
                onClick={handleEliminarProducto}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg cursor-pointer uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {eliminandoProducto && <Loader2 className="w-4 h-4 animate-spin" />}
                {eliminandoProducto ? 'Borrando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-black uppercase text-white">
                Crear Nuevo Producto Padre
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Elegí la categoría y tildá únicamente los talles que llegaron en esta tanda.
              </p>
            </div>

            {errorModal && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorModal}</span>
              </div>
            )}

            <form onSubmit={handleCrearProducto} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-bold text-slate-400 mb-1">Nombre de la Prenda</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Remera Boxy Heavy Cotton"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block uppercase font-bold text-slate-400 mb-1">Categoría</label>
                <select
                  value={nuevaCategoriaId}
                  onChange={(e) => handleCambiarCategoriaModal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="uppercase font-bold text-slate-400">
                    Talles Disponibles para esta Prenda ({tallesSeleccionadosIds.length} seleccionados)
                  </label>
                  {curvaActualModal !== 'unico' && (
                    <button
                      type="button"
                      onClick={() => {
                        const todos = tallesDisponiblesModal.map((t) => t.id);
                        if (tallesSeleccionadosIds.length === todos.length) {
                          setTallesSeleccionadosIds([]);
                        } else {
                          setTallesSeleccionadosIds(todos);
                        }
                      }}
                      className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer"
                    >
                      {tallesSeleccionadosIds.length === tallesDisponiblesModal.length
                        ? 'Desmarcar todos'
                        : 'Marcar todos'}
                    </button>
                  )}
                </div>

                {curvaActualModal === 'unico' ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-amber-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Talle Único (U) - Se asigna automáticamente para accesorios
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {tallesDisponiblesModal.map((t) => {
                      const seleccionado = tallesSeleccionadosIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTalleSeleccionado(t.id)}
                          className={`py-2 px-1 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer border ${
                            seleccionado
                              ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          {t.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase font-bold text-slate-400 mb-1">Costo Compra/Taller ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 12000"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-slate-400 mb-1">Precio Venta Mostrador ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 35000"
                    value={nuevoPrecioVenta}
                    onChange={(e) => setNuevoPrecioVenta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  disabled={creandoProducto}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoProducto}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-lg cursor-pointer uppercase tracking-wider transition-colors shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creandoProducto && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creandoProducto ? 'Creando Prenda...' : 'Crear y Continuar a Matriz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};