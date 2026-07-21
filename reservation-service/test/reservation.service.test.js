jest.mock('../src/config/database', () => ({
  sequelize: { transaction: jest.fn().mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() }) },
}));

jest.mock('../src/models', () => {
  const mockReservation = {
    id: 'res-001', tenant_id: 'tenant-001', status: 'CONFIRMED',
    total_price: 600, discount_applied: 0,
    rooms: [{
      id: 'rr-001', room_type_id: 'rt-001', room_type_name: 'Simple',
      check_in_date: '2025-01-10', check_out_date: '2025-01-12',
      rate_per_night: 300,
    }],
    update: jest.fn().mockResolvedValue(true),
  };
  return {
    Reservation:    { findOne: jest.fn().mockResolvedValue(mockReservation), create: jest.fn() },
    ReservationRoom: { create: jest.fn().mockResolvedValue({ id: 'rr-001' }) },
    ReservationGuest: { create: jest.fn() },
    StayLoan: { findOne: jest.fn(), findAll: jest.fn() },
    RESERVATION_STATUS: { CONFIRMED:'CONFIRMED', PRE_CHECKIN:'PRE_CHECKIN', IN_HOUSE:'IN_HOUSE', CHECKED_OUT:'CHECKED_OUT', CANCELED:'CANCELED', NOSHOW:'NOSHOW' },
    LOAN_STATUS: { LENT: 'LENT', RETURNED: 'RETURNED' },
    RESERVATION_SOURCE: ['WALK_IN','WEB','PHONE'],
    _mock: { mockReservation },
  };
});

jest.mock('../src/services/availability.service', () => ({
  checkAvailability: jest.fn().mockResolvedValue({ available: true, nights: 2, unavailable_dates: [] }),
  blockDates:        jest.fn().mockResolvedValue(true),
  releaseDates:      jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/services/guestClient',  () => ({ validateGuest: jest.fn().mockResolvedValue({ best_discount: 0 }) }));
jest.mock('../src/services/billingClient', () => ({ updateCharges: jest.fn(), getBalance: jest.fn().mockResolvedValue({ balance: 0, has_pending: false }) }));
jest.mock('../src/events/publisher', () => ({
  publishReservationCreated: jest.fn(),
  publishStayExtended:       jest.fn(),
  publishCheckinCompleted:   jest.fn(),
  publishCheckoutCompleted:  jest.fn(),
}));

const { Reservation, ReservationRoom, ReservationGuest, RESERVATION_STATUS, _mock } = require('../src/models');
const { checkAvailability, blockDates, releaseDates } = require('../src/services/availability.service');
const guestClient = require('../src/services/guestClient');
const { publishReservationCreated } = require('../src/events/publisher');
const reservationService = require('../src/services/reservation.service');

beforeEach(() => jest.clearAllMocks());

describe('createReservation()', () => {
  const input = {
    tenant_id: 'tenant-001', main_guest_id: 'guest-001', source: 'WALK_IN',
    rooms: [{ room_type_id: 'rt-001', room_type_name: 'Simple', check_in_date: '2025-01-10', check_out_date: '2025-01-12', rate_per_night: 300 }],
  };

  it('checks availability, creates records, and publishes event', async () => {
    Reservation.create = jest.fn().mockResolvedValue({ id: 'res-new', tenant_id: 'tenant-001', discount_applied: 0 });
    Reservation.findOne.mockResolvedValue({ ..._mock.mockReservation, id: 'res-new', rooms: [{ id: 'rr-001', ...input.rooms[0] }] });

    await reservationService.createReservation(input);

    expect(checkAvailability).toHaveBeenCalledWith('tenant-001', 'rt-001', '2025-01-10', '2025-01-12');
    expect(blockDates).toHaveBeenCalledTimes(1);
    expect(Reservation.create).toHaveBeenCalledTimes(1);
    expect(publishReservationCreated).toHaveBeenCalledTimes(1);
  });

  it('calculates price per room using each guest loyalty discount', async () => {
    const multiRoomInput = {
      tenant_id: 'tenant-001',
      main_guest_id: 'guest-001',
      source: 'WALK_IN',
      rooms: [
        {
          room_type_id: 'rt-001',
          room_type_name: 'Simple',
          check_in_date: '2025-01-10',
          check_out_date: '2025-01-11',
          rate_per_night: 100,
          adults: 1,
          children: 0,
          guests: [{ guest_id: 'guest-001' }],
        },
        {
          room_type_id: 'rt-002',
          room_type_name: 'Doble',
          check_in_date: '2025-01-10',
          check_out_date: '2025-01-11',
          rate_per_night: 200,
          adults: 1,
          children: 0,
          guests: [{ guest_id: 'guest-002' }],
        },
      ],
    };

    Reservation.create = jest.fn().mockResolvedValue({ id: 'res-new', tenant_id: 'tenant-001', discount_applied: 0 });
    Reservation.findOne.mockResolvedValue({ ..._mock.mockReservation, id: 'res-new', rooms: [{ id: 'rr-001', ...multiRoomInput.rooms[0] }, { id: 'rr-002', ...multiRoomInput.rooms[1] }] });
    guestClient.validateGuest.mockImplementation(async (guestId) => ({ best_discount: guestId === 'guest-001' ? 0.1 : 0 }));

    await reservationService.createReservation(multiRoomInput);

    expect(Reservation.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-001',
      main_guest_id: 'guest-001',
      total_price: 290,
      discount_applied: 0.1,
    }), expect.anything());
  });

  it('throws NO_AVAILABILITY when dates are blocked', async () => {
    checkAvailability.mockResolvedValueOnce({ available: false, unavailable_dates: ['2025-01-11'] });

    await expect(reservationService.createReservation(input))
      .rejects.toMatchObject({ code: 'NO_AVAILABILITY' });
    expect(Reservation.create).not.toHaveBeenCalled();
  });
});

describe('cancelReservation()', () => {
  it('releases dates and sets status to CANCELED', async () => {
    Reservation.findOne.mockResolvedValue(_mock.mockReservation);

    await reservationService.cancelReservation('res-001', 'tenant-001');

    expect(releaseDates).toHaveBeenCalledTimes(1);
    expect(_mock.mockReservation.update).toHaveBeenCalledWith({ status: RESERVATION_STATUS.CANCELED }, expect.anything());
  });

  it('throws RESERVATION_IMMUTABLE for checked-out reservations', async () => {
    Reservation.findOne.mockResolvedValue({ ..._mock.mockReservation, status: 'CHECKED_OUT' });

    await expect(reservationService.cancelReservation('res-001', 'tenant-001'))
      .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });
});
