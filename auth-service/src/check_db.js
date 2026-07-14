const { LocalTenant, UserTenant, User, Role } = require('./models');
const { sequelize } = require('./config/database');

async function check() {
  try {
    await sequelize.authenticate();
    const tenants = await LocalTenant.findAll();
    console.log('TENANTS:', JSON.stringify(tenants, null, 2));
    
    const userTenants = await UserTenant.findAll();
    console.log('USER_TENANTS:', JSON.stringify(userTenants, null, 2));

    const users = await User.findAll({ 
      include: [{ model: Role, as: 'role' }] 
    });
    console.log('USERS:', JSON.stringify(users, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
