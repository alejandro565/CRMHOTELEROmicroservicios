import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, Table, Button, Input, Select, Modal, Badge, StatusBadge } from '../../../components/ui';
import toast from 'react-hot-toast';
import { UserPlus, Shield, Power, Clock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import ShiftScheduler from '../../../components/examples/ShiftScheduler';

/* ─── Helpers to convert between ShiftScheduler array and backend string ───── */

const DAY_MAP = {
  lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue',
  vie: 'Vie', sab: 'Sáb', dom: 'Dom',
};
const DAY_MAP_REV = Object.fromEntries(
  Object.entries(DAY_MAP).map(([k, v]) => [v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), k])
);
const DAY_KEYS_ORDERED = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

function parseTimeStr(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

/** Parse backend string → ShiftScheduler shifts array */
function stringToShifts(str) {
  if (!str) return [];
  const shifts = [];
  str.split(',').forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([a-zA-ZáéíóúÁÉÍÓÚü\s-/]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) return;
    const daysPart = match[1].trim();
    const entrada = match[2];
    const salida = match[3];

    const resolveKey = (name) => {
      const c = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (DAY_MAP_REV[c]) return DAY_MAP_REV[c];
      const found = Object.entries(DAY_MAP_REV).find(([k]) => k.startsWith(c) || c.startsWith(k));
      return found ? found[1] : null;
    };

    let dayKeys = [];
    if (daysPart.includes('-')) {
      const [startDay, endDay] = daysPart.split('-').map(d => d.trim());
      const startKey = resolveKey(startDay);
      const endKey = resolveKey(endDay);
      if (startKey && endKey) {
        const si = DAY_KEYS_ORDERED.indexOf(startKey);
        const ei = DAY_KEYS_ORDERED.indexOf(endKey);
        if (si !== -1 && ei !== -1) {
          for (let i = si; i <= ei; i++) dayKeys.push(DAY_KEYS_ORDERED[i]);
        }
      }
    } else if (daysPart.includes('/')) {
      daysPart.split('/').forEach(d => {
        const k = resolveKey(d.trim());
        if (k) dayKeys.push(k);
      });
    } else {
      const k = resolveKey(daysPart);
      if (k) dayKeys = [k];
    }

    if (dayKeys.length > 0) {
      const eTime = parseTimeStr(entrada);
      const sTime = parseTimeStr(salida);
      const eMin = eTime.hour * 60 + eTime.minute;
      const sMin = sTime.hour * 60 + sTime.minute;
      shifts.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        days: dayKeys,
        entrada,
        salida,
        overnight: sMin < eMin,
      });
    }
  });
  return shifts;
}

/** Convert ShiftScheduler shifts array → backend string */
function shiftsToString(shifts) {
  if (!shifts || shifts.length === 0) return null;
  return shifts.map(s => {
    const labels = s.days.map(k => DAY_MAP[k] || k);
    let dayStr;
    if (labels.length === 1) {
      dayStr = labels[0];
    } else {
      const indices = s.days.map(k => DAY_KEYS_ORDERED.indexOf(k));
      const isConsecutive = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
      dayStr = isConsecutive
        ? `${labels[0]}-${labels[labels.length - 1]}`
        : labels.join('/');
    }
    return `${dayStr} ${s.entrada}-${s.salida}`;
  }).join(', ');
}

/* ─── Modals ──────────────────────────────────────────────────────────────── */

function CreateUserModal({ open, onClose, roles = [] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: '', email: '', role_id: '', password: 'Password1' });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.auth.createUser(), body),
    onSuccess: () => { qc.invalidateQueries(['users']); onClose(); toast.success('Empleado creado'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Nuevo empleado" size="sm">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="flex flex-col gap-4">
        <Input label="Nombre completo *" value={form.full_name} onChange={f('full_name')} required />
        <Input label="Email *" type="email" value={form.email} onChange={f('email')} required />
        <Select label="Rol *" value={form.role_id} onChange={f('role_id')} required>
          <option value="">— seleccionar rol —</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Input label="Contraseña inicial" value={form.password} onChange={f('password')} />
        <Button type="submit" variant="primary" loading={create.isPending}>Crear empleado</Button>
      </form>
    </Modal>
  );
}

function ScheduleModal({ open, onClose, user }) {
  const qc = useQueryClient();
  const [currentShifts, setCurrentShifts] = useState([]);

  const update = useMutation({
    mutationFn: (work_schedule) => api.patch(ENDPOINTS.auth.updateUserSchedule(user.id), { work_schedule }),
    onSuccess: () => { qc.invalidateQueries(['users']); onClose(); toast.success('Horario actualizado'); },
    onError: (e) => toast.error(e.message),
  });

  const initialShifts = useMemo(() => {
    if (!open || !user) return [];
    return stringToShifts(user.work_schedule);
  }, [open, user]);

  React.useEffect(() => {
    if (open && user) {
      setCurrentShifts(stringToShifts(user.work_schedule));
    }
  }, [open, user]);

  const onSave = () => {
    const str = shiftsToString(currentShifts);
    update.mutate(str);
  };

  const onClear = () => {
    update.mutate(null);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Horario de ${user?.full_name || 'empleado'}`} size="lg">
      <div className="flex flex-col gap-5">
        <ShiftScheduler
          noFrame
          initialShifts={initialShifts}
          onScheduleChange={setCurrentShifts}
        />

        <div className="flex gap-3 border-t border-surface-100 pt-4">
          <Button variant="primary" className="flex-1" onClick={onSave} loading={update.isPending}>
            Guardar Horario
          </Button>
          {user?.work_schedule && (
            <Button variant="ghost" onClick={onClear} loading={update.isPending}>
              Quitar Horario
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Main Tab ────────────────────────────────────────────────────────────── */

export default function UsersTab() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleUser, setScheduleUser] = useState(null);
  const canManage = hasPermission('USERS_MANAGE');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get(ENDPOINTS.auth.listUsers()),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get(ENDPOINTS.auth.listRoles()),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(ENDPOINTS.auth.toggleUser(id), { is_active }),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('Usuario actualizado'); },
    onError: (e) => toast.error(e.message),
  });

  const rolesData = roles?.data || [];

  const columns = [
    { key: 'full_name', label: 'Nombre' },
    { key: 'email',     label: 'Email' },
    { key: 'role_name', label: 'Rol',       render: (v) => v ? <Badge color="indigo">{v}</Badge> : '—' },
    { key: 'is_active', label: 'Estado',    render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'work_schedule', label: 'Horario',
      render: (v, row) => (
        <button
          onClick={() => canManage && setScheduleUser(row)}
          className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-all
            ${v
              ? 'bg-brand-500/10 text-brand-700 hover:bg-brand-500/20'
              : 'bg-surface-100 text-surface-400 hover:bg-surface-200'
            }
            ${canManage ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          <Clock size={12} />
          {v || 'Sin asignar'}
        </button>
      ),
    },
    canManage && { key: 'actions',   label: '',
      render: (_, row) => (
        <Button
          size="sm"
          variant={row.is_active ? 'ghost' : 'success'}
          className={row.is_active ? 'text-red-500' : ''}
          onClick={() => toggle.mutate({ id: row.id, is_active: !row.is_active })}
          loading={toggle.isPending}
        >
          <Power size={14} className="mr-1" />
          {row.is_active ? 'Desactivar' : 'Activar'}
        </Button>
      )
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
         <div>
            <h3 className="text-lg font-bold text-surface-900">Personal / Empleados</h3>
            <p className="text-xs text-surface-500">Gestiona los accesos y horarios de tu equipo.</p>
         </div>
         {canManage && <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus size={16} className="mr-2" /> Nuevo Empleado
         </Button>}
      </div>

      <Card>
        <Table
          columns={columns}
          data={users?.data || []}
          loading={isLoading}
          emptyMsg="No hay empleados registrados"
        />
      </Card>

      {canManage && (
        <>
          <CreateUserModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            roles={rolesData}
          />
          <ScheduleModal
            open={!!scheduleUser}
            onClose={() => setScheduleUser(null)}
            user={scheduleUser}
          />
        </>
      )}
    </div>
  );
}
