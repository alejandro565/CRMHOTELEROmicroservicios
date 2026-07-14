import React, { useState, useMemo, useCallback, useRef } from "react";
import "./ShiftScheduler.css";

/* ---------------------------------------------------------
   Config
--------------------------------------------------------- */
const DAYS = [
  { key: "lun", label: "Lun", full: "Lunes" },
  { key: "mar", label: "Mar", full: "Martes" },
  { key: "mie", label: "Mié", full: "Miércoles" },
  { key: "jue", label: "Jue", full: "Jueves" },
  { key: "vie", label: "Vie", full: "Viernes" },
  { key: "sab", label: "Sáb", full: "Sábado" },
  { key: "dom", label: "Dom", full: "Domingo" },
];

const MINUTE_STEPS = [0, 15, 30, 45];

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(hour24, minute) {
  return `${pad(hour24)}:${pad(minute)}`;
}

/* ---------------------------------------------------------
   ClockDial — a circular analog-style time picker.
   Click a number to set the hour, toggle AM/PM, pick minutes
   from the step ring underneath.
--------------------------------------------------------- */
function ClockDial({ label, hour24, minute, onChange, accent = "brass" }) {
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const dialRef = useRef(null);

  const setHour12 = useCallback(
    (h12, pm) => {
      let h24 = h12 % 12;
      if (pm) h24 += 12;
      onChange(h24, minute);
    },
    [minute, onChange]
  );

  const setMinute = useCallback(
    (m) => {
      onChange(hour24, m);
    },
    [hour24, onChange]
  );

  const togglePM = useCallback(
    (pm) => {
      setHour12(hour12, pm);
    },
    [hour12, setHour12]
  );

  // Positions for 1..12 around the dial
  const numbers = useMemo(() => {
    const items = [];
    for (let i = 1; i <= 12; i++) {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const r = 74;
      const x = 90 + r * Math.cos(angle);
      const y = 90 + r * Math.sin(angle);
      items.push({ n: i, x, y });
    }
    return items;
  }, []);

  const handleAngle = ((hour12 / 12) * 360) + 180;

  const handleDialClick = (e) => {
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    let h = Math.round(angle / 30);
    if (h === 0) h = 12;
    setHour12(h, isPM);
  };

  return (
    <div className={`sched-clock sched-clock--${accent}`}>
      <div className="sched-clock__head">
        <span className="sched-clock__label">{label}</span>
        <span className="sched-clock__digital">{formatTime(hour24, minute)}</span>
      </div>

      <div
        className="sched-clock__dial"
        ref={dialRef}
        onClick={handleDialClick}
        role="slider"
        aria-label={`Hora de ${label}`}
        aria-valuenow={hour24}
        tabIndex={0}
      >
        <div
          className="sched-clock__hand"
          style={{ transform: `rotate(${handleAngle}deg)` }}
        />
        <div className="sched-clock__hub" />
        {numbers.map(({ n, x, y }) => (
          <button
            key={n}
            type="button"
            className={`sched-clock__num ${n === hour12 ? "is-active" : ""}`}
            style={{ left: x, top: y }}
            onClick={(e) => {
              e.stopPropagation();
              setHour12(n, isPM);
            }}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="sched-clock__controls">
        <div className="sched-clock__ampm">
          <button
            type="button"
            className={!isPM ? "is-active" : ""}
            onClick={() => togglePM(false)}
          >
            AM
          </button>
          <button
            type="button"
            className={isPM ? "is-active" : ""}
            onClick={() => togglePM(true)}
          >
            PM
          </button>
        </div>

        <div className="sched-clock__minutes">
          {MINUTE_STEPS.map((m) => (
            <button
              key={m}
              type="button"
              className={m === minute ? "is-active" : ""}
              onClick={() => setMinute(m)}
            >
              :{pad(m)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   WeekDayPicker — row of toggleable day chips
--------------------------------------------------------- */
function WeekDayPicker({ selected, onToggle }) {
  return (
    <div className="sched-days" role="group" aria-label="Días de la semana">
      {DAYS.map((d) => {
        const active = selected.includes(d.key);
        return (
          <button
            key={d.key}
            type="button"
            className={`sched-days__chip ${active ? "is-active" : ""}`}
            onClick={() => onToggle(d.key)}
            aria-pressed={active}
            title={d.full}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   ShiftScheduler — main component
--------------------------------------------------------- */
export default function ShiftScheduler({ onScheduleChange, initialShifts = [], noFrame = false }) {
  const [selectedDays, setSelectedDays] = useState([]);
  const [entrada, setEntrada] = useState({ hour: 8, minute: 0 });
  const [salida, setSalida] = useState({ hour: 16, minute: 0 });
  const [shifts, setShifts] = useState(initialShifts);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setShifts(initialShifts);
  }, [initialShifts]);

  const toggleDay = (key) => {
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
    setError("");
  };

  const emit = (next) => {
    setShifts(next);
    onScheduleChange && onScheduleChange(next);
  };

  const addShift = () => {
    if (selectedDays.length === 0) {
      setError("Selecciona al menos un día antes de agregar el turno.");
      return;
    }
    const entradaMin = entrada.hour * 60 + entrada.minute;
    const salidaMin = salida.hour * 60 + salida.minute;
    if (salidaMin === entradaMin) {
      setError("La hora de salida no puede ser igual a la de entrada.");
      return;
    }

    const orderedDays = DAYS.filter((d) => selectedDays.includes(d.key)).map(
      (d) => d.key
    );

    const newShift = {
      id: `${Date.now()}`,
      days: orderedDays,
      entrada: formatTime(entrada.hour, entrada.minute),
      salida: formatTime(salida.hour, salida.minute),
      overnight: salidaMin < entradaMin,
    };

    emit([...shifts, newShift]);
    setSelectedDays([]);
    setError("");
  };

  const removeShift = (id) => {
    emit(shifts.filter((s) => s.id !== id));
  };

  return (
    <div className={noFrame ? "sched-card-noframe" : "sched-card"}>
      {!noFrame && (
        <header className="sched-card__header">
          <div>
            <p className="sched-card__eyebrow">Recepción · Turnos</p>
            <h3 className="sched-card__title">Horario del recepcionista</h3>
          </div>
        </header>
      )}

      <section className="sched-card__section">
        <p className="sched-card__label">Días laborales</p>
        <WeekDayPicker selected={selectedDays} onToggle={toggleDay} />
      </section>

      <section className="sched-card__clocks">
        <ClockDial
          label="Entrada"
          hour24={entrada.hour}
          minute={entrada.minute}
          onChange={(h, m) => setEntrada({ hour: h, minute: m })}
          accent="brass"
        />
        <div className="sched-card__arrow" aria-hidden="true">
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <path
              d="M0 7H26M26 7L20 1M26 7L20 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <ClockDial
          label="Salida"
          hour24={salida.hour}
          minute={salida.minute}
          onChange={(h, m) => setSalida({ hour: h, minute: m })}
          accent="sage"
        />
      </section>

      {error && <p className="sched-card__error">{error}</p>}

      <button type="button" className="sched-card__add" onClick={addShift}>
        Agregar turno
      </button>

      <section className="sched-card__ledger">
        <p className="sched-card__label">Turnos asignados</p>
        {shifts.length === 0 ? (
          <p className="sched-card__empty">
            Todavía no hay turnos. Selecciona días y horarios arriba.
          </p>
        ) : (
          <ul className="sched-ledger__list">
            {shifts.map((s) => (
              <li key={s.id} className="sched-ledger__item">
                <div className="sched-ledger__days">
                  {s.days.map((dk) => (
                    <span key={dk} className="sched-ledger__daytag">
                      {DAYS.find((d) => d.key === dk).label}
                    </span>
                  ))}
                </div>
                <div className="sched-ledger__time">
                  <span>{s.entrada}</span>
                  <span className="sched-ledger__sep">→</span>
                  <span>{s.salida}</span>
                  {s.overnight && (
                    <span className="sched-ledger__badge">nocturno</span>
                  )}
                </div>
                <button
                  type="button"
                  className="sched-ledger__remove"
                  onClick={() => removeShift(s.id)}
                  aria-label="Eliminar turno"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
