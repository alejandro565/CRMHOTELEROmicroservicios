/**
 * Notification Service (Mock)
 * Simulates sending communications to guests.
 */

async function sendPortalLinkEmail(reservation_id, guest_name, email, portal_url) {
  console.log(`[Notification Mock] Sending Email to ${guest_name} (${email}):`);
  console.log(`Body: Hola ${guest_name}, aquí tienes tu enlace para el pre-registro: ${portal_url}`);
  
  // Simulate delay
  await new Promise(r => setTimeout(r, 500));
  return { success: true, provider: 'mock-smtp' };
}

async function sendPortalLinkWhatsApp(reservation_id, guest_name, phone, portal_url) {
  console.log(`[Notification Mock] Sending WhatsApp to ${guest_name} (${phone}):`);
  console.log(`Message: Hola ${guest_name}, gracias por elegirnos. Aquí tienes tu enlace para el pre-registro digital: ${portal_url}. Completa tus datos para agilizar tu llegada. ¡Buen viaje!`);

  // Simulate delay
  await new Promise(r => setTimeout(r, 500));
  return { success: true, provider: 'mock-wa-api' };
}

module.exports = {
  sendPortalLinkEmail,
  sendPortalLinkWhatsApp
};
