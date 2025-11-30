// scripts/loader.js
const app = document.getElementById('app');

async function loadSection(name){
  try{
    const res = await fetch(`sections/${name}.html`);
    if(!res.ok) {
      app.innerHTML = `<div class="card"><h2>Error cargando ${name}</h2></div>`;
      return;
    }
    const html = await res.text();
    app.innerHTML = html;
    // después de inyectar la sección, llama a cualquier inicializador local si existe
    if (window.onSectionLoaded) window.onSectionLoaded(name);
  } catch (e) {
    app.innerHTML = `<div class="card"><h2>Error de red</h2><pre>${e.message}</pre></div>`;
  }
}

// manejador de botones de navegación
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.nav-btn');
  if (btn && btn.dataset.section) {
    loadSection(btn.dataset.section);
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (window.logout) window.logout(); // usa la función logout de game.js
  // volver a la sección login si existe
  loadSection('login');
});

// carga inicial: home (o login si deseas)
loadSection('home');
