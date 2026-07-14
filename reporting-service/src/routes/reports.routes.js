const router = require('express').Router();
const ExcelJS = require('exceljs');
const { authenticate, requirePermission } = require('../middlewares/errorHandler');
const svc = require('../services/reporting.service');

router.use(authenticate);

/**
 * GET /reports/sales
 * Sales report — JSON by default, ?format=xlsx for Excel download.
 * Query: ?from=2024-01-01&to=2024-01-31&category=ROOM&format=xlsx
 */
router.get('/sales', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getSalesReport(req.user.tid, {
      from:     req.query.from,
      to:       req.query.to,
      category: req.query.category,
    });

    if (req.query.format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Reporte de Ventas');

      ws.columns = [
        { header: 'Fecha',           key: 'date',          width: 14 },
        { header: 'Ingresos (BOB)',  key: 'total_revenue',  width: 18 },
        { header: 'ADR (BOB)',       key: 'adr',            width: 14 },
        { header: 'RevPAR (BOB)',    key: 'revpar',         width: 14 },
        { header: 'Categoría',       key: 'category',       width: 16 },
      ];
      ws.getRow(1).font = { bold: true };

      data.rows.forEach((r) => ws.addRow({
        date:          r.date,
        total_revenue: Number(r.total_revenue),
        adr:           Number(r.adr),
        revpar:        Number(r.revpar),
        category:      r.category,
      }));

      // Totals row
      ws.addRow({});
      const totalRow = ws.addRow({ date: 'TOTAL', total_revenue: data.grand_total });
      totalRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ventas-${req.query.from || 'all'}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /reports/occupancy
 * Occupancy report. Supports ?format=xlsx.
 */
router.get('/occupancy', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const rows = await svc.getOccupancyReport(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });

    if (req.query.format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Ocupación');
      ws.columns = [
        { header: 'Fecha',           key: 'date',                 width: 14 },
        { header: 'Total Habitaciones', key: 'total_rooms',       width: 20 },
        { header: 'Habitaciones Ocupadas', key: 'occupied_rooms', width: 22 },
        { header: 'Ocupación %',     key: 'occupancy_percentage', width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow({
        date:                 r.date,
        total_rooms:          r.total_rooms,
        occupied_rooms:       r.occupied_rooms,
        occupancy_percentage: Number(r.occupancy_percentage),
      }));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ocupacion.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /reports/libro-ventas
 * Bolivian tax compliance: monthly Libro de Ventas.
 * Required query: ?year=2024&month=1
 * Supports ?format=xlsx.
 */
router.get('/libro-ventas', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const { year, month, format } = req.query;
    if (!year || !month) return res.status(400).json({ success: false, error_code: 'MISSING_PARAMS', message: 'year y month son requeridos' });

    const data = await svc.getLibroDeVentas(req.user.tid, {
      year:  parseInt(year),
      month: parseInt(month),
    });

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Libro Ventas ${month}-${year}`);
      ws.mergeCells('A1:C1');
      ws.getCell('A1').value = `LIBRO DE VENTAS — ${String(month).padStart(2,'0')}/${year}`;
      ws.getCell('A1').font  = { bold: true, size: 13 };

      ws.addRow([]);
      ws.addRow(['Fecha', 'Ingresos (BOB)', 'ADR (BOB)']);
      ws.getRow(3).font = { bold: true };

      data.rows.forEach((r) => ws.addRow([r.date, Number(r.total_revenue), Number(r.adr)]));

      ws.addRow([]);
      const tot = ws.addRow(['TOTAL', data.total_revenue]);
      tot.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="libro-ventas-${month}-${year}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /reports/guests
 * Guest report for a date range — fetches from reservation-service internal API.
 * Supports ?format=print for a printable HTML page.
 * Query: ?from=2024-01-01&to=2024-01-31&format=print|json
 */
router.get('/guests', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getGuestReport(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });

    if (req.query.format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Reporte de Huéspedes');
      ws.columns = [
        { header: 'Reserva',        key: 'reservation_id', width: 12 },
        { header: 'Huésped',        key: 'guest_name',     width: 28 },
        { header: 'Titular',        key: 'is_primary',     width: 8  },
        { header: 'País Origen',    key: 'origin_country', width: 16 },
        { header: 'Ciudad Origen',  key: 'origin_city',    width: 16 },
        { header: 'Doc. Verificado',key: 'id_verified',    width: 14 },
        { header: 'Habitación',     key: 'room_number',    width: 10 },
        { header: 'Tipo',           key: 'room_type',      width: 18 },
        { header: 'Entrada',        key: 'check_in_date',  width: 12 },
        { header: 'Salida',         key: 'check_out_date', width: 12 },
        { header: 'Tarifa/Noche',   key: 'rate_per_night', width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      data.rows.forEach(r => ws.addRow({
        ...r,
        is_primary: r.is_primary ? 'Sí' : '',
        id_verified: r.id_verified ? 'Sí' : 'No',
      }));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="huespedes-${req.query.from || 'all'}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
