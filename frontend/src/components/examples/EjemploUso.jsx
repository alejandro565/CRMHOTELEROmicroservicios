import ShiftScheduler from "./ShiftScheduler";

export default function EjemploUso() {
  const handleScheduleChange = (turnos) => {
    // turnos: [{ id, days: ['lun','mar'], entrada: '08:00', salida: '16:00', overnight: false }, ...]
    console.log("Turnos actualizados:", turnos);
    // Aquí puedes hacer el POST/PUT a tu API del CRM
  };

  return (
    <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
      <ShiftScheduler onScheduleChange={handleScheduleChange} />
    </div>
  );
}
