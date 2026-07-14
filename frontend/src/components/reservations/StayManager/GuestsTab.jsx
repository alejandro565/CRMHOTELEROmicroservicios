import React, { useState, useMemo, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Step2_Occupancy from '../Reservation/Step2_Occupancy';
import { calculateAge } from '../Reservation/constants';
import { Country, City } from 'country-state-city';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Spinner } from '../../ui';

export default function GuestsTab({
  reservation,
  showGuestSearch,
  setShowGuestSearch,
  regMode,
  setRegMode,
  newGuestData,
  onNewGuestDataChange,
  creatingGuest,
  onCreateAndAddGuest,
  onChangeResponsible,
  onUpdateGuest,
  onAddGuest,
  onAssignGuestToRoom,
  onRemoveGuest,
  isUpdatingGuest,
  updatingGuestId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [guestResults, setGuestResults] = useState([]);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length < 3) {
        setGuestResults([]);
        return;
      }
      setGuestLoading(true);
      try {
        const res = await api.get(ENDPOINTS.guest.listGuests(`search=${searchQuery}`));
        const data = res.data || res || [];
        // Filter out guests already in the reservation
        const existingIds = reservation.guest_list?.map(g => g.guest_id) || [];
        setGuestResults(data.filter(g => !existingIds.includes(g.id)));
      } catch (e) {
        setGuestResults([]);
      } finally {
        setGuestLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, reservation.guest_list]);

  // Mapping reservation rooms to "cart" format
  const cart = useMemo(() => reservation.rooms?.map(r => ({
    id: r.id,
    room_number: r.room_number,
    room_type_name: r.room_type_name,
    max_capacity: r.max_capacity || 2
  })) || [], [reservation.rooms]);

  // Mapping reservation guests to "guestPool" format
  const guestPool = useMemo(() => reservation.guest_list?.map(gl => ({
    guest: {
      id: gl.guest_id,
      first_name: gl.guest_name?.split(' ')[0] || '',
      last_name: gl.guest_name?.split(' ').slice(1).join(' ') || '',
      doc_number: gl.doc_number || '',
      birth_date: gl.birth_date
    },
    id: gl.id, // guest_res_id
    res_room_id: gl.res_room_id,
    is_primary: gl.is_primary,
    id_verified: gl.id_verified,
    origin_country: gl.origin_country,
    origin_city: gl.origin_city
  })) || [], [reservation.guest_list]);

  const countriesOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
    return Country.getAllCountries().map(c => {
      let name = c.name;
      try { name = displayNames.of(c.isoCode) || c.name; } catch (e) {}
      return { label: name, value: c.isoCode }
    }).sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, []);

  const getCitiesOptions = (countryCode) => {
    if (!countryCode) return [];
    try {
      return City.getCitiesOfCountry(countryCode).map(c => ({ label: c.name, value: c.name }));
    } catch (e) { return []; }
  };

  // Handlers for Step2_Occupancy adapted for StayManager (API calls)
  const handleAssignGuestToRoom = (guestId, resRoomId) => {
    const gl = reservation.guest_list.find(g => g.guest_id === guestId);
    if (gl) {
      onAssignGuestToRoom({ guestResId: gl.id, resRoomId });
    }
  };

  const handleRemoveGuestFromPool = (guestId) => {
    const gl = reservation.guest_list.find(g => g.guest_id === guestId);
    if (gl) {
      onRemoveGuest({ guestResId: gl.id });
    }
  };

  const handleMarkGuestAsPrimary = (guestId) => {
    onChangeResponsible(guestId);
  };

  const handleUpdateGuestData = (guestId, field, value) => {
    const gl = reservation.guest_list.find(g => g.guest_id === guestId);
    if (gl) {
      onUpdateGuest({ guestResId: gl.id, [field]: value });
    }
  };

  // Note: Searching and Quick Create are handled by Step2_Occupancy if we pass the right props.
  // However, GuestsTab already has regMode and other states.
  // We'll wrap Step2_Occupancy but keep the "New Guest" form if regMode is 'new'.

  return (
    <div className="h-full flex flex-col min-h-[600px]">
      <Step2_Occupancy 
        hideHeader={false}
        title="Gestión de Huéspedes y Acompañantes"
        hideConfirm={true}
        onToggleVerify={(guestId, verified) => {
           const gl = reservation.guest_list.find(g => g.guest_id === guestId);
           if (gl) onUpdateGuest({ guestResId: gl.id, id_verified: verified });
        }}
        guestPool={guestPool}
        setShowQuickCreate={() => { setRegMode('new'); setShowGuestSearch(true); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        guestLoading={guestLoading}
        guestResults={guestResults}
        handleSelectGuest={(g) => onAddGuest({ guestResId: null, guestId: g.id })}
        assignGuestToRoom={handleAssignGuestToRoom}
        removeGuestFromPool={handleRemoveGuestFromPool}
        markGuestAsPrimary={handleMarkGuestAsPrimary}
        countriesOptions={countriesOptions}
        getCitiesOptions={getCitiesOptions}
        setGuestPool={() => {}} 
        setGuestTravelData={handleUpdateGuestData}
        cart={cart}
        getRoomCapacity={(r) => r.max_capacity}
        getCountableOccupants={(roomId) => guestPool.filter(p => p.res_room_id === roomId && calculateAge(p.guest.birth_date) >= 5).length}
      />

      {/* Quick Create Overlay (similar to ReservationModal) */}
      {showGuestSearch && regMode === 'new' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="font-black text-slate-900 text-lg uppercase">Registro de Huésped</h4>
              <button onClick={() => setShowGuestSearch(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <div className="p-8">
              <div className="space-y-6">
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                   <GuestFormFields values={newGuestData} onChange={onNewGuestDataChange} showOrigin={true} />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button 
                    disabled={creatingGuest}
                    onClick={() => onCreateAndAddGuest(null)}
                    className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                  >
                    {creatingGuest ? <Spinner size={16}/> : <Plus size={18}/>} Registrar y Añadir
                  </button>
                  <button onClick={() => setShowGuestSearch(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

