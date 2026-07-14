/**
 * Validates whether the current time falls within the given work schedule.
 *
 * Format examples:
 *   "Lun-Vie 8:00-17:00"
 *   "Lun/Mie/Vie 9:00-13:00, Sab 10:00-14:00"
 *   "Lun-Vie 22:00-6:00"  (night shift crossing midnight)
 *
 * @param {string|null} scheduleStr  — comma-separated shift definitions
 * @returns {boolean} true if access is allowed (no schedule = always allowed)
 */

const DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

function isWithinSchedule(scheduleStr) {
  if (!scheduleStr) return true;

  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentDayKey = DAY_KEYS[currentDayIndex];
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  const clean = (s) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const parts = scheduleStr.split(',');
  let hasMatchingShift = false;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([a-zA-ZáéíóúÁÉÍÓÚü\s-/]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) continue;

    const daysPart = match[1].trim();
    const entrada = match[2];
    const salida = match[3];

    const DAY_MAP_REV = {
      'lun': 'lun', 'lunes': 'lun',
      'mar': 'mar', 'martes': 'mar',
      'mie': 'mie', 'miercoles': 'mie',
      'jue': 'jue', 'jueves': 'jue',
      'vie': 'vie', 'viernes': 'vie',
      'sab': 'sab', 'sabado': 'sab',
      'dom': 'dom', 'domingo': 'dom'
    };

    const resolveKey = (name) => {
      const c = clean(name);
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
        const DAY_KEYS_ORDERED = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
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

    if (dayKeys.includes(currentDayKey)) {
      const [entH, entM] = entrada.split(':').map(Number);
      const [salH, salM] = salida.split(':').map(Number);

      const entTotal = entH * 60 + entM;
      const salTotal = salH * 60 + salM;

      if (salTotal > entTotal) {
        if (currentTotalMinutes >= entTotal && currentTotalMinutes <= salTotal) {
          hasMatchingShift = true;
          break;
        }
      } else {
        if (currentTotalMinutes >= entTotal) {
          hasMatchingShift = true;
          break;
        }
      }
    }

    const yesterdayIndex = (currentDayIndex + 6) % 7;
    const yesterdayDayKey = DAY_KEYS[yesterdayIndex];
    if (dayKeys.includes(yesterdayDayKey)) {
      const [entH, entM] = entrada.split(':').map(Number);
      const [salH, salM] = salida.split(':').map(Number);
      const entTotal = entH * 60 + entM;
      const salTotal = salH * 60 + salM;

      if (salTotal < entTotal) {
        if (currentTotalMinutes <= salTotal) {
          hasMatchingShift = true;
          break;
        }
      }
    }
  }

  return hasMatchingShift;
}

module.exports = { isWithinSchedule };
