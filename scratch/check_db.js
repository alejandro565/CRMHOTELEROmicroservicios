const path = require('path');
// Since this script is in ./scratch, we go up one level
const modelsPath = path.join(__dirname, '../auth-service/src/models');
const configPath = path.join(__dirname, '../auth-service/src/config/database');

const { LocalTenant, UserTenant, User, Role } = require(modelsPath);
const { sequelize } = require(configPath);

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
