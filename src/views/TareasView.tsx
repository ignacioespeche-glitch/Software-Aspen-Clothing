import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  CheckSquare, 
  MessageSquare, 
  Plus, 
  User, 
  Calendar
} from 'lucide-react';

export const TareasView = () => {
  const { perfil, empresa } = useAuth();
  const [tabActiva, setTabActiva] = useState<'tareas' | 'novedades'>('tareas');
  const [tareas, setTareas] = useState<any[]>([]);
  const [novedades, setNovedades] = useState<any[]>([]);
  const [equipo, setEquipo] = useState<any[]>([]);

  // Modal nueva tarea
  const [mostrarModalTarea, setMostrarModalTarea] = useState(false);
  const [tituloTarea, setTituloTarea] = useState('');
  const [descTarea, setDescTarea] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [fechaLimite, setFechaLimite] = useState('');

  // Modal nueva publicacion
  const [mostrarModalPub, setMostrarModalPub] = useState(false);
  const [tituloPub, setTituloPub] = useState('');
  const [contenidoPub, setContenidoPub] = useState('');
  const [categoriaPub, setCategoriaPub] = useState('novedades');

  useEffect(() => {
    if (empresa?.id) {
      cargarDatos();
      cargarEquipo();
    }
  }, [empresa?.id]);

  const cargarEquipo = async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, rol')
      .eq('empresa_id', empresa?.id)
      .eq('activo', true);
    if (data) setEquipo(data);
  };

  const cargarDatos = async () => {
    const [resT, resN] = await Promise.all([
      supabase
        .from('tareas_equipo')
        .select('*, perfiles:responsable_id(nombre, apellido), creador:creador_id(nombre)')
        .eq('empresa_id', empresa?.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('publicaciones_equipo')
        .select('*, autor:autor_id(nombre, apellido)')
        .eq('empresa_id', empresa?.id)
        .order('created_at', { ascending: false })
    ]);

    if (resT.data) setTareas(resT.data);
    if (resN.data) setNovedades(resN.data);
  };

  const handleCrearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || !empresa) return;

    await supabase.from('tareas_equipo').insert({
      empresa_id: empresa.id,
      creador_id: perfil.id,
      responsable_id: responsableId || perfil.id,
      titulo: tituloTarea.trim(),
      descripcion: descTarea.trim() || null,
      prioridad,
      fecha_limite: fechaLimite || null,
      estado: 'pendiente'
    });

    setMostrarModalTarea(false);
    setTituloTarea('');
    setDescTarea('');
    cargarDatos();
  };

  const handleCrearPub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || !empresa) return;

    await supabase.from('publicaciones_equipo').insert({
      empresa_id: empresa.id,
      autor_id: perfil.id,
      titulo: tituloPub.trim(),
      contenido: contenidoPub.trim(),
      categoria: categoriaPub
    });

    setMostrarModalPub(false);
    setTituloPub('');
    setContenidoPub('');
    cargarDatos();
  };

  const cambiarEstadoTarea = async (id: string, nuevoEstado: string) => {
    await supabase
      .from('tareas_equipo')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', id);
    cargarDatos();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-sky-400" />
            Coordinación y Tareas Internas
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Canal de novedades, entregables de marketing y tareas operativas de {empresa?.nombre}.
          </p>
        </div>

        <div className="flex gap-2">
          {tabActiva === 'tareas' ? (
            <button
              onClick={() => setMostrarModalTarea(true)}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nueva Tarea
            </button>
          ) : (
            <button
              onClick={() => setMostrarModalPub(true)}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Publicar Novedad
            </button>
          )}
        </div>
      </div>

      {/* Selector de Solapa */}
      <div className="flex gap-2 border-b border-slate-800 text-xs">
        <button
          onClick={() => setTabActiva('tareas')}
          className={`pb-2.5 px-3 font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tabActiva === 'tareas'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Tareas Pendientes ({tareas.filter(t => t.estado !== 'completada').length})
        </button>
        <button
          onClick={() => setTabActiva('novedades')}
          className={`pb-2.5 px-3 font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tabActiva === 'novedades'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Novedades y Campañas ({novedades.length})
        </button>
      </div>

      {/* Contenido: Tareas */}
      {tabActiva === 'tareas' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['pendiente', 'en_proceso', 'completada'] as const).map((colEstado) => {
            const tareasCol = tareas.filter((t) => t.estado === colEstado);
            const tituloCol = 
              colEstado === 'pendiente' ? 'Por Hacer' :
              colEstado === 'en_proceso' ? 'En Progreso' : 'Completadas';

            return (
              <div key={colEstado} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-xs font-black uppercase text-slate-300 tracking-wider">
                    {tituloCol}
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                    {tareasCol.length}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                  {tareasCol.length === 0 ? (
                    <p className="text-slate-600 text-[11px] text-center py-6">Sin tareas en esta etapa</p>
                  ) : (
                    tareasCol.map((tarea) => (
                      <div
                        key={tarea.id}
                        className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2.5 shadow-sm"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-white leading-snug">{tarea.titulo}</h4>
                          <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
                            tarea.prioridad === 'urgente' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                            tarea.prioridad === 'alta' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {tarea.prioridad}
                          </span>
                        </div>

                        {tarea.descripcion && (
                          <p className="text-[11px] text-slate-400 line-clamp-2">{tarea.descripcion}</p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                          <span className="flex items-center gap-1 text-slate-300 font-semibold">
                            <User className="w-3 h-3 text-sky-400" />
                            {tarea.perfiles?.nombre || 'Sin asignar'}
                          </span>
                          {tarea.fecha_limite && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {tarea.fecha_limite}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1">
                          {colEstado !== 'pendiente' && (
                            <button
                              onClick={() => cambiarEstadoTarea(tarea.id, 'pendiente')}
                              className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-900 cursor-pointer"
                            >
                              ← Mover
                            </button>
                          )}
                          {colEstado !== 'en_proceso' && (
                            <button
                              onClick={() => cambiarEstadoTarea(tarea.id, 'en_proceso')}
                              className="text-[10px] text-sky-400 hover:bg-sky-500/10 px-1.5 py-0.5 rounded bg-slate-900 cursor-pointer"
                            >
                              En Progreso
                            </button>
                          )}
                          {colEstado !== 'completada' && (
                            <button
                              onClick={() => cambiarEstadoTarea(tarea.id, 'completada')}
                              className="text-[10px] text-emerald-400 hover:bg-emerald-500/10 px-1.5 py-0.5 rounded bg-slate-900 cursor-pointer font-bold"
                            >
                              ✓ Listo
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contenido: Novedades */}
      {tabActiva === 'novedades' && (
        <div className="space-y-4 max-w-3xl">
          {novedades.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No hay publicaciones ni comunicados activos todavía.
            </div>
          ) : (
            novedades.map((pub) => (
              <div key={pub.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{pub.autor?.nombre} {pub.autor?.apellido || ''}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                      {pub.categoria}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(pub.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-100">{pub.titulo}</h3>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{pub.contenido}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Nueva Tarea */}
      {mostrarModalTarea && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCrearTarea} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Crear Nueva Tarea</h3>
            
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Título de la Tarea</label>
              <input
                type="text"
                required
                placeholder="Ej. Coordinar sesión de fotos o Enviar curva al taller"
                value={tituloTarea}
                onChange={(e) => setTituloTarea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Detalle / Instrucciones</label>
              <textarea
                rows={2}
                placeholder="Detalle opcional..."
                value={descTarea}
                onChange={(e) => setDescTarea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Responsable</label>
                <select
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">Yo mismo</option>
                  {equipo.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre} {m.apellido || ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Fecha Límite</label>
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalTarea(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Guardar Tarea
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nueva Publicación */}
      {mostrarModalPub && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCrearPub} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Publicar Novedad o Campaña</h3>
            
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Título</label>
              <input
                type="text"
                required
                placeholder="Ej. Lanzamiento Drop Invierno o Canje con @artista"
                value={tituloPub}
                onChange={(e) => setTituloPub(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Categoría</label>
              <select
                value={categoriaPub}
                onChange={(e) => setCategoriaPub(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="novedades">Novedades Generales</option>
                <option value="marketing">Marketing & Influencers</option>
                <option value="produccion">Producción & Talleres</option>
                <option value="tienda_web">Tienda Online</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Contenido / Novedad</label>
              <textarea
                rows={4}
                required
                placeholder="Escribí los detalles que todo el equipo debe saber..."
                value={contenidoPub}
                onChange={(e) => setContenidoPub(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalPub(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Publicar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};