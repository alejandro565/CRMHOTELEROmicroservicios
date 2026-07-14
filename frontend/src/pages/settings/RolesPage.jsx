import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Modal, PageHeader, Badge } from '../../components/ui';
import toast from 'react-hot-toast';

function RoleCard({ role, onEdit, onDelete }) {
  const perms = role.permissions || [];
  const byModule = perms.reduce((acc, p) => {
    const mod = p.slug?.split('_')[0] || 'OTHER';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p.slug);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{role.name}</h3>
          {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {role.is_system_role
            ? <Badge color="purple">Sistema</Badge>
            : <Badge color="blue">Personalizado</Badge>
          }
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        {Object.entries(byModule).map(([mod, slugs]) => (
          <div key={mod} className="flex items-start gap-2">
            <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{mod}</span>
            <div className="flex flex-wrap gap-1">
              {slugs.map(s => <Badge key={s} color="gray">{s.replace(`${mod}_`, '')}</Badge>)}
            </div>
          </div>
        ))}
        {perms.length === 0 && <p className="text-xs text-gray-400">Sin permisos asignados</p>}
      </div>

      {!role.is_system_role && (
        <div className="flex gap-2 pt-3 border-t border-gray-50">
          <Button size="sm" variant="ghost" onClick={() => onEdit(role)}>Editar permisos</Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => onDelete(role.id)}>Eliminar</Button>
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
    const mod = p.module || 'OTHER';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, description: desc, permissions: [...selected] }); }}
      className="flex flex-col gap-4">
      <Input label="Nombre del rol *" value={name} onChange={e => setName(e.target.value)} required />
      <Input label="Descripción"      value={desc} onChange={e => setDesc(e.target.value)} />

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Permisos</p>
        <div className="max-h-72 overflow-y-auto flex flex-col gap-3 pr-1">
          {Object.entries(byModule).map(([mod, perms]) => (
            <div key={mod}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{mod}</p>
              <div className="grid grid-cols-1 gap-1">
                {perms.map(p => (
                  <label key={p.slug} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                    <input type="checkbox" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} className="accent-indigo-600" />
                    <span className="text-sm text-gray-700">{p.slug}</span>
                    {p.desc && <span className="text-xs text-gray-400 truncate">— {p.desc}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" variant="primary" loading={loading}>
        {initial.id ? 'Guardar permisos' : 'Crear rol'}
      </Button>
    </form>
  );
}

export default function RolesPage() {
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
    <div>
      <PageHeader
        title="Roles y permisos"
        subtitle="Control de acceso basado en roles (RBAC)"
        action={<Button variant="primary" onClick={() => { setSelected(null); setModal('create'); }}>+ Nuevo rol</Button>}
      />

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={(r) => { setSelected(r); setModal('edit'); }}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </div>
      )}

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nuevo rol" size="lg">
        <RoleForm
          permissions={permissions}
          onSave={(d) => create.mutate(d)}
          loading={create.isPending}
        />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar permisos del rol" size="lg">
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
