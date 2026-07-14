import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  format, 
  addDays, 
  startOfDay, 
  isSameDay, 
  isWithinInterval, 
  differenceInDays, 
  addMonths, 
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale/es';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Search, 
  Users, 
  Bed, 
  Info,
  Maximize2
} from 'lucide-react';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { PageHeader, Card, Spinner, Badge, Button, Input } from '../../components/ui';
import StayManagerModal from '../../components/reservations/StayManagerModal';

const CELL_WIDTH = 50;
const ROOM_COL_WIDTH = 220;
const ROW_HEIGHT = 60;

export default function OccupancyCalendarPage() {
  const qc = useQueryClient();
  const scrollRef = useRef(null);
  
  // State
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [selectedResId, setSelectedResId] = useState(null);
  const [hoveredResId, setHoveredResId] = useState(null);
  const [prioritizeOccupied, setPrioritizeOccupied] = useState(false);

  // Time range calculation
  const { startDate, endDate, days } = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const dayList = eachDayOfInterval({ start, end });
    return { startDate: start, endDate: end, days: dayList };
  }, [viewDate]);

  // Data Fetching
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['calendar-rooms'],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.hotels.listRooms ? ENDPOINTS.hotels.listRooms() : '/hotels/rooms');
      return res.data || res;
    }
  });

  const { data: resData, isLoading: resLoading } = useQuery({
    queryKey: ['calendar-reservations', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // We fetch a bit more range to catch reservations that started before or end after
      const qs = `start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`;
      const res = await api.get(ENDPOINTS.reservation.listReservations(qs));
      return res.data || res;
    }
  });

  const reservations = useMemo(() => {
    return Array.isArray(resData) ? resData : (resData?.data || []);
  }, [resData]);

  // Group reservations by room_id for easier rendering
  const roomReservations = useMemo(() => {
    const map = {};
    if (!Array.isArray(reservations)) return map;
    
    reservations.forEach(res => {
      if (!res || !['CONFIRMED', 'IN_HOUSE', 'PRE_CHECKIN'].includes(res.status)) return;
      res.rooms?.forEach(rm => {
        if (!rm || !rm.room_id) return;
        if (!map[rm.room_id]) map[rm.room_id] = [];
        map[rm.room_id].push({
          ...rm,
          reservation_id: res.id,
          status: res.status,
          main_guest_name: res.main_guest_name,
          total_rooms: res.rooms?.length || 1
        });
      });
    });
    return map;
  }, [reservations]);

  const rooms = useMemo(() => {
    const list = Array.isArray(roomsData) ? roomsData : (roomsData?.data || []);
    const filtered = list.filter(r => 
      r.number?.toLowerCase().includes(search.toLowerCase()) || 
      r.room_type_name?.toLowerCase().includes(search.toLowerCase())
    );

    if (prioritizeOccupied) {
      return [...filtered].sort((a, b) => {
        const hasA = roomReservations[a.id]?.length > 0 ? 1 : 0;
        const hasB = roomReservations[b.id]?.length > 0 ? 1 : 0;
        if (hasA !== hasB) return hasB - hasA;
        return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
      });
    }

    return filtered.sort((a, b) => (a.number || '').localeCompare(b.number || '', undefined, { numeric: true }));
  }, [roomsData, search, prioritizeOccupied, roomReservations]);

  // Auto-scroll to today on load
  useEffect(() => {
    if (scrollRef.current && isSameDay(startDate, startOfMonth(new Date()))) {
      const today = new Date();
      const diff = differenceInDays(today, startDate);
      if (diff > 0) {
        scrollRef.current.scrollLeft = diff * CELL_WIDTH - 100;
      }
    }
  }, [startDate, roomsLoading]);

  const getStatusColor = (status, isHovered) => {
    const opacity = isHovered ? '1' : '0.85';
    switch (status) {
      case 'IN_HOUSE':   return `rgba(16, 185, 129, ${opacity})`; // Emerald 500
      case 'CONFIRMED':  return `rgba(59, 130, 246, ${opacity})`; // Blue 500
      case 'PRE_CHECKIN': return `rgba(168, 85, 247, ${opacity})`; // Purple 500
      default:           return `rgba(100, 116, 139, ${opacity})`; // Slate 500
    }
  };

  const handlePrevMonth = () => setViewDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setViewDate(prev => addMonths(prev, 1));
  const handleToday = () => setViewDate(startOfMonth(new Date()));

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      <PageHeader 
        title="Calendario de Ocupación" 
        subtitle="Visualización en tiempo real de disponibilidad y estadías"
        action={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar habitación..."
                className="pl-10 pr-4 py-2 bg-white/50 backdrop-blur-md border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setPrioritizeOccupied(!prioritizeOccupied)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${prioritizeOccupied ? 'bg-brand-500 text-white border-brand-600 shadow-lg shadow-brand-500/20' : 'bg-white/50 text-slate-600 border-slate-200 hover:bg-white'}`}
            >
              <Maximize2 size={14} />
              {prioritizeOccupied ? 'Orden: Ocupadas Arriba' : 'Orden: Normal'}
            </button>
            <div className="flex items-center bg-white/50 backdrop-blur-md border border-slate-200 rounded-xl p-1">
              <Button variant="ghost" size="sm" onClick={handlePrevMonth}><ChevronLeft size={18} /></Button>
              <button 
                onClick={handleToday}
                className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-brand-600 transition-colors"
              >
                {format(viewDate, 'MMMM yyyy', { locale: es })}
              </button>
              <Button variant="ghost" size="sm" onClick={handleNextMonth}><ChevronRight size={18} /></Button>
            </div>
          </div>
        }
      />

      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl shadow-slate-200/50 relative">
        {/* Timeline Container */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Room Labels (Sticky Left) */}
          <div className="w-[220px] bg-slate-50/80 backdrop-blur-md border-r border-slate-200 z-20 flex flex-col shrink-0">
            <div className="h-12 border-b border-slate-200 flex items-center px-4 shrink-0 bg-slate-100/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Habitación / Tipo</span>
            </div>
            <div className="flex-1 overflow-y-hidden" id="room-labels-container">
              {rooms.map(room => (
                <div key={room.id} style={{ height: ROW_HEIGHT }} className="flex flex-col justify-center px-4 border-b border-slate-100 group hover:bg-brand-50/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{room.number}</span>
                    <Badge color={room.status === 'CLEAN' ? 'green' : room.status === 'DIRTY' ? 'yellow' : 'red'}>
                      {room.status === 'CLEAN' ? 'L' : room.status === 'DIRTY' ? 'S' : 'O'}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate font-medium uppercase">{room.room_type_name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Grid Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-auto custom-scrollbar relative"
            onScroll={(e) => {
              const labels = document.getElementById('room-labels-container');
              if (labels) labels.scrollTop = e.target.scrollTop;
            }}
          >
            {/* Header (Dates) */}
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50/90 backdrop-blur-md h-12">
              {days.map(day => {
                const isToday = isSameDay(day, new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div 
                    key={day.toISOString()} 
                    style={{ width: CELL_WIDTH }} 
                    className={`shrink-0 flex flex-col items-center justify-center border-r border-slate-100/50 
                      ${isToday ? 'bg-brand-500/10' : isWeekend ? 'bg-slate-100/30' : ''}`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={`text-sm font-black ${isToday ? 'text-brand-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grid Body */}
            <div className="relative" style={{ width: days.length * CELL_WIDTH }}>
              {/* Background Cells */}
              {rooms.map(room => (
                <div key={room.id} style={{ height: ROW_HEIGHT }} className="flex border-b border-slate-100">
                  {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div 
                        key={day.toISOString()} 
                        style={{ width: CELL_WIDTH }} 
                        className={`shrink-0 border-r border-slate-50 
                          ${isToday ? 'bg-brand-500/5' : isWeekend ? 'bg-slate-50/50' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Reservation Bars */}
              {rooms.map((room, rowIndex) => {
                const resList = roomReservations[room.id] || [];
                return resList.map((res, i) => {
                  // Calculate positioning
                  const checkIn = startOfDay(new Date(res.check_in_date + 'T12:00'));
                  const checkOut = startOfDay(new Date(res.check_out_date + 'T12:00'));
                  
                  // Clip to visible range
                  const effectiveStart = checkIn < startDate ? startDate : checkIn;
                  const effectiveEnd = checkOut > endDate ? endDate : checkOut;
                  
                  const startOffset = differenceInDays(effectiveStart, startDate);
                  const duration = differenceInDays(effectiveEnd, effectiveStart);
                  
                  if (duration <= 0 && !isSameDay(effectiveStart, effectiveEnd)) return null;

                  const left = startOffset * CELL_WIDTH + 4; // padding
                  const width = (duration || 0.5) * CELL_WIDTH - 8; // small gap between bars
                  const top = rowIndex * ROW_HEIGHT + 10;
                  const height = ROW_HEIGHT - 20;

                  const isHovered = hoveredResId === res.reservation_id;
                  const isGroup = res.total_rooms > 1;

                  return (
                    <div
                      key={`${res.reservation_id}-${room.id}`}
                      className="absolute rounded-lg cursor-pointer transition-all duration-200 z-10 shadow-sm overflow-hidden group/bar"
                      style={{
                        left,
                        width,
                        top,
                        height,
                        backgroundColor: getStatusColor(res.status, isHovered),
                        border: isHovered ? '2px solid white' : 'none',
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isHovered ? '0 10px 25px -5px rgba(0,0,0,0.2)' : 'none'
                      }}
                      onMouseEnter={() => setHoveredResId(res.reservation_id)}
                      onMouseLeave={() => setHoveredResId(null)}
                      onClick={() => setSelectedResId(res.reservation_id)}
                    >
                      <div className="flex flex-col px-2 py-1 h-full justify-center relative">
                        {isGroup && (
                          <div className="absolute top-1 right-1 opacity-50 group-hover/bar:opacity-100">
                            <Users size={10} className="text-white" />
                          </div>
                        )}
                        <span className="text-[10px] font-black text-white leading-tight truncate">
                          {res.main_guest_name || 'Huésped'}
                        </span>
                        <span className="text-[8px] font-bold text-white/70 uppercase tracking-tighter">
                          {res.status === 'IN_HOUSE' ? 'EN CASA' : res.status === 'CONFIRMED' ? 'CONFIRMADA' : 'RESERVADO'}
                        </span>
                      </div>
                      
                      {/* Tooltip hint on hover */}
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>

        {/* Legend Footer */}
        <div className="h-12 border-t border-slate-200 bg-white flex items-center px-6 gap-6 shrink-0 relative z-30">
          <div className="flex items-center gap-2 border-r border-slate-200 pr-6 mr-2">
            <Badge color="green">L</Badge> <span className="text-[10px] font-bold text-slate-500">Limpia</span>
            <Badge color="yellow">S</Badge> <span className="text-[10px] font-bold text-slate-500">Sucia</span>
            <Badge color="red">O</Badge> <span className="text-[10px] font-bold text-slate-500">Ocu.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor('IN_HOUSE', false) }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">En Casa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor('CONFIRMED', false) }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confirmada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor('PRE_CHECKIN', false) }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reservado</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span className="text-[10px] font-medium">Icono indica reserva grupal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Info size={14} />
              <span className="text-[10px] font-medium">Clic para gestionar estadía</span>
            </div>
          </div>
        </div>
      </Card>

      {selectedResId && (
        <StayManagerModal 
          isOpen={true}
          onClose={() => setSelectedResId(null)}
          reservationId={selectedResId}
          onUpdate={() => qc.invalidateQueries(['calendar-reservations'])}
        />
      )}
    </div>
  );
}
