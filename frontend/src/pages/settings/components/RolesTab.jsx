import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Button, Input, Modal, Badge } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Shield, Plus, Edit3, Trash2, CheckCircle } from 'lucide-react';

function RoleCard({ role, onEdit, onDelete }) {
  const perms = role.permissions || [];
  const byModule = perms.reduce((acc, p) => {
    const mod = p.slug?.split('_')[0] || 'OTROS';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p.slug);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-surface-900">{role.name}</h3>
          {role.description && <p className="text-[10px] text-surface-400 mt-0.5">{role.description}</p>}
        </div>
        {role.is_system_role ? (
          <Badge color="purple">Sistema</Badge>
        ) : (
          <Badge color="blue">Custom</Badge>
        )}
      </div>

      <div className="space-y-3 mb-6">
        {Object.entries(byModule).map(([mod, slugs]) => (
          <div key={mod} className="flex items-start gap-2">
            <span className="text-[9px] font-black text-surface-300 w-16 shrink-0 pt-1 uppercase tracking-tighter">{mod}</span>
            <div className="flex flex-wrap gap-1">
              {slugs.map(s => (
                <span key={s} className="px-1.5 py-0.5 bg-surface-50 text-surface-500 rounded text-[9px] font-medium border border-surface-100">
                   {s.replace(`${mod}_`, '')}
                </span>
              ))}
            </div>
          </div>
        ))}
        {perms.length === 0 && <p className="text-[10px] text-surface-400 italic">Sin permisos asignados</p>}
      </div>

      {!role.is_system_role && (
        <div className="flex gap-2 pt-4 border-t border-surface-50">
          <Button size="sm" variant="ghost" onClick={() => onEdit(role)} className="h-8 text-[10px] font-bold">
            <Edit3 size={12} className="mr-1" /> Editar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold text-red-500" onClick={() => onDelete(role.id)}>
            <Trash2 size={12} className="mr-1" /> Eliminar
          </Button>
        </div>
      )}
    </div>
  );
}

function RoleForm({ initial = {}, permissions = [], onSave, loading }) {
  const currentSlugs = (initial.permissions || []).map(p => p.slug);
  const [name, setName]       = useState(initial.name || '');
  const [desc, setDesc]       = useState(initial.description || '');
  const [selected, setSelected] = useState(new Set(currentSlugs));

  const toggle = (slug) => setSelected(s => {
    const next = new Set(s);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    return next;
  });

  const byModule = permissions.reduce((acc, p) => {
    const mod = p.module || 'OTROS';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, description: desc, permissions: [...selected] }); }}
      className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
         <Input label="Nombre del rol *" value={name} onChange={e => setName(e.target.value)} required />
         <Input label="Descripción"      value={desc} onChange={e => setDesc(e.target.value)} />
      </div>

      <div>
        <p className="text-xs font-black text-surface-400 uppercase tracking-widest mb-3">Asignar Permisos</p>
        <div className="max-h-96 overflow-y-auto flex flex-col gap-4 pr-2 custom-scrollbar">
          {Object.entries(byModule).map(([mod, perms]) => (
            <div key={mod} className="bg-surface-50 p-4 rounded-xl border border-surface-100">
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                <CheckCircle size={10} /> {mod}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {perms.map(p => (
                  <label key={p.slug} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-all ${
                    selected.has(p.slug) ? 'bg-white border-brand-200 shadow-sm' : 'border-transparent hover:bg-white/50'
                  }`}>
                    <input type="checkbox" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} className="accent-brand-600" />
                    <div className="flex flex-col">
                       <span className="text-[11px] font-bold text-surface-700">{p.slug}</span>
                       {p.desc && <span className="text-[9px] text-surface-400 line-clamp-1">{p.desc}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" variant="primary" loading={loading} className="py-3 font-bold rounded-xl">
        {initial.id ? 'Guardar Cambios' : 'Crear nuevo rol'}
      </Button>
    </form>
  );
}

export default function RolesTab() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => api.get(ENDPOINTS.auth.listRoles()),
  });

  const { data: permsData } = useQuery({
    queryKey: ['permissions-flat'],
    queryFn:  () => api.get(ENDPOINTS.auth.listPermissions() + '?grouped=false'),
  });

  const roles = rolesData?.data || [];
  const permissions = permsData?.data || [];

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.auth.createRole(), body),
    onSuccess: () => { qc.invalidateQueries(['roles']); setModal(null); toast.success('Rol creado'); },
    onError:   (e) => toast.error(e.message),
  });

  const reassign = useMutation({
    mutationFn: ({ id, permissions }) => api.put(ENDPOINTS.auth.reassignPerms(id), { permissions }),
    onSuccess: () => { qc.invalidateQueries(['roles']); setModal(null); toast.success('Permisos actualizados'); },
    onError:   (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(ENDPOINTS.auth.deleteRole(id)),
    onSuccess: () => { qc.invalidateQueries(['roles']); toast.success('Rol eliminado'); },
    onError:   (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
            <h3 className="text-lg font-bold text-surface-900">Roles y Permisos (RBAC)</h3>
            <p className="text-xs text-surface-500">Define qué puede hacer cada perfil en el sistema.</p>
         </div>
         <Button variant="primary" size="sm" onClick={() => { setSelected(null); setModal('create'); }}>
            <Shield size={16} className="mr-2" /> Nuevo Rol
         </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-surface-400 font-medium">Cargando roles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={(r) => { setSelected(r); setModal('edit'); }}
              onDelete={(id) => { if(window.confirm('¿Seguro?')) remove.mutate(id); }}
            />
          ))}
        </div>
      )}

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Crear Nuevo Rol" size="lg">
        <RoleForm
          permissions={permissions}
          onSave={(d) => create.mutate(d)}
          loading={create.isPending}
        />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={`Editando: ${selected?.name}`} size="lg">
        {selected && (
          <RoleForm
            initial={selected}
            permissions={permissions}
            onSave={(d) => reassign.mutate({ id: selected.id, permissions: d.permissions })}
            loading={reassign.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
