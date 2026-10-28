async function check() {
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const listData = await listRes.json();
  const page = listData.find(t => t.type === 'page' && t.url.includes('5173'));
  if (!page) { console.log('No page found on 5173'); return; }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p={}) => new Promise(res => {
    const cur = id++;
    const fn = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === cur) { ws.removeEventListener('message', fn); res(msg); }
    };
    ws.addEventListener('message', fn);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        petAuth: localStorage.getItem('pet_auth'),
        activeUser: localStorage.getItem('petcare_active_user'),
        currentUser: localStorage.getItem('petcare_current_user'),
        canonicalAppointments: localStorage.getItem('petcare_canonical_appointments'),
        legacyAppointments: localStorage.getItem('petcare_appointments'),
        activeAppointments: localStorage.getItem('petcare_active_appointments')
      };
    })()`,
    returnByValue: true
  });
  console.log('Browser LocalStorage Info:');
  const val = evalRes.result?.result?.value;
  console.log('petAuth:', val?.petAuth);
  console.log('activeUser:', val?.activeUser);
  console.log('currentUser:', val?.currentUser);
  console.log('canonicalAppointments length:', val?.canonicalAppointments ? JSON.parse(val.canonicalAppointments).length : 'null');
  console.log('legacyAppointments length:', val?.legacyAppointments ? JSON.parse(val.legacyAppointments).length : 'null');
  if (val?.canonicalAppointments) {
    const apps = JSON.parse(val.canonicalAppointments);
    console.log('Canonical appointments summary:', apps.map(a => ({ id: a.id, date: a.date, status: a.status, assignedVetId: a.assignedVetId, assignedVet: a.assignedVet })));
  }
  ws.close();
}
check().catch(console.error);
