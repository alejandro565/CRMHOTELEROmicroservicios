const { Company } = require('../models');
const AppError = require('../middlewares/AppError');

async function createCompany({ tenant_id, business_name, tax_id, email, phone, contact_name, corporate_discount, notes }) {
  const exists = await Company.findOne({ where: { tenant_id, tax_id } });
  if (exists) throw new AppError(`El NIT "${tax_id}" ya está registrado`, 409, 'COMPANY_TAX_ID_EXISTS');

  return Company.create({ tenant_id, business_name, tax_id, email, phone, contact_name, corporate_discount, notes });
}

async function listCompanies(tenant_id, { page = 1, limit = 20 } = {}) {
  const { count, rows } = await Company.findAndCountAll({
    where: { tenant_id },
    order: [['business_name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

async function getCompany(id, tenant_id) {
  const company = await Company.findOne({ where: { id, tenant_id } });
  if (!company) throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
  return company;
}

async function updateCompany(id, tenant_id, data) {
  const company = await getCompany(id, tenant_id);
  await company.update(data);
  return company;
}

async function deleteCompany(id, tenant_id) {
  const company = await getCompany(id, tenant_id);
  await company.destroy();
  return { deleted: true, id };
}

module.exports = { createCompany, listCompanies, getCompany, updateCompany, deleteCompany };
