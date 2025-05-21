const socket = io();
socket.emit('get history');
let username = prompt("Enter your name") || "Anonymous";

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

function formatTimestamp(date) {
  const now = new Date();
  const msgDate = new Date(date);
  const diffMs = now - msgDate;
  const diffMins = Math.floor(diffMs / 60000);

  const isToday = now.toDateString() === msgDate.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === msgDate.toDateString();

  let hours = msgDate.getHours();
  const minutes = msgDate.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  if (diffMins < 1) return "Now";
  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  const day = msgDate.getDate().toString().padStart(2, '0');
  const month = msgDate.toLocaleString('default', { month: 'short' });
  const year = msgDate.getFullYear();
  return `${day} ${month} ${year} at ${timeStr}`;
}


form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', {
      user: username,
      text: input.value,
      time:  new Date().toISOString(),
    });
    input.value = '';
  }
});

socket.on('chat message', (msg) => {
  const item = document.createElement('li');
  item.classList.add('message');
  item.classList.add(msg.user === username ? 'sent' : 'received');

  const displayTime = formatTimestamp(msg.time);

  item.innerHTML = `
    <div>
      <strong>${msg.user}</strong>
      <small style="font-size: 0.8em; color: gray;">${displayTime}</small>
    </div>
    <div>${msg.text}</div>
  `;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});


socket.on('chat history', (msgs) => {
  msgs.forEach((msg) => {
    const item = document.createElement('li');
    item.classList.add('message');
    item.classList.add(msg.user === username ? 'sent' : 'received');

    const displayTime = formatTimestamp(msg.time);
    item.innerHTML = `
      <div>
        <strong>${msg.user}</strong>
        <small style="font-size: 0.8em; color: gray;">${displayTime}</small>
      </div>
      <div>${msg.text}</div>
    `;
    messages.appendChild(item);
  });
  messages.scrollTop = messages.scrollHeight;
});
