// "Now" is the time of the machine running the Node server.
const pad = (n) => String(n).padStart(2, "0");

const nowLocal = () => {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
};

// Is the slot's start already in the past?
const isPastSlot = (date, time) => {
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}`).getTime() <= Date.now();
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`;

module.exports = { nowLocal, isPastSlot, toMinutes, fromMinutes };
