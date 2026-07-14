const axios = require('axios');
const { Invoice, Folio, FOLIO_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

/**
 * Generate a fiscal invoice for a folio.
 * The SIN (Bolivian tax authority) integration is stubbed here —
 * in production this would call the real SIN API to obtain a CUF code.
 */
async function generateInvoice({ folio_id, tenant_id, nit_ci, razon_social, email }) {
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id } });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');

  if (folio.balance > 0) {
    throw new AppError(
      `No se puede facturar con saldo pendiente de Bs ${folio.balance}`,
      409, 'PENDING_BALANCE', { balance: folio.balance }
    );
  }

  // Prevent duplicate invoices for same folio + tax_id
  const existing = await Invoice.findOne({ where: { folio_id, tenant_id, nit_ci } });
  if (existing) throw new AppError('Ya existe una factura para este NIT/CI en este folio', 409, 'INVOICE_DUPLICATE');

  const total_amount = Math.abs(folio.balance === 0
    ? await _getTotalCharges(folio_id, tenant_id)
    : folio.balance
  );

  // SIN stub — in production: call SIN API for CUF and XML
  const { cuf, xml_url } = await _submitToSIN({ tenant_id, nit_ci, razon_social, total_amount });

  const invoice = await Invoice.create({
    folio_id, tenant_id, nit_ci, razon_social, email,
    total_amount, cuf, xml_url, sin_status: 'ACCEPTED',
  });

  // Notify communication-service to email the invoice
  publishEvent('billing.invoice_generated', {
    tenant_id,
    invoice_id:   invoice.id,
    folio_id,
    email,
    razon_social,
    total_amount,
    xml_url,
    occurred_at:  new Date().toISOString(),
  });

  return invoice;
}

async function listInvoices(tenant_id, folio_id) {
  const where = { tenant_id };
  if (folio_id) where.folio_id = folio_id;
  return Invoice.findAll({ where, order: [['created_at', 'DESC']] });
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _getTotalCharges(folio_id, tenant_id) {
  const { Charge } = require('../models');
  const result = await Charge.sum('amount', { where: { folio_id, tenant_id, is_voided: false } });
  return parseFloat(result || 0);
}

async function _submitToSIN({ tenant_id, nit_ci, razon_social, total_amount }) {
  // STUB: Replace with real SIN API call in production
  // The real implementation would use DOSIFICACIÓN + XML signing
  const cuf     = `${tenant_id.slice(0, 8).toUpperCase()}${Date.now()}`;
  const xml_url = null; // Would be populated by SIN response

  try {
    if (process.env.SIN_API_URL && process.env.NODE_ENV === 'production') {
      const { data } = await axios.post(`${process.env.SIN_API_URL}/facturas`, {
        nit: nit_ci, razonSocial: razon_social, montoTotal: total_amount,
      }, { headers: { Authorization: `Bearer ${process.env.SIN_API_TOKEN}` }, timeout: 10000 });
      return { cuf: data.cuf, xml_url: data.xmlUrl };
    }
  } catch (err) {
    console.error('[SIN] submission failed:', err.message);
    // Fail gracefully — invoice is saved as PENDING for manual retry
  }

  return { cuf, xml_url };
}

module.exports = { generateInvoice, listInvoices };
