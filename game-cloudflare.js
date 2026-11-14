/* Gatos y Peces - integración con Cloudflare Workers + D1.
   No usa localStorage ni caches de navegador para los datos del juego.
   Sustituye API_BASE por la URL pública de tu Worker. */
(() => {
  'use strict';

  const API_BASE = 'https://gatos-y-peces-api.lucasmaneirodelatm.workers.dev';
  const PRODUCT_INFO = {
    1: ['Alimento diario para gatos.', 'Recupera salud y felicidad al alimentar.'],
    2: ['Alimento específico para peces.', 'Recupera salud y felicidad al alimentar.'],
    3: ['Juguete interactivo para gatos.', 'Mejora la felicidad al jugar.'],
    4: ['Acuario de agua fría para 3 peces.', 'Solo admite especies de agua fría.'],
    5: ['Acuario de agua fría para 6 peces.', 'Solo admite especies de agua fría.'],
    6: ['Acuario de agua fría para 10 peces.', 'Solo admite especies de agua fría.'],
    7: ['Collar sencillo y resistente.', 'Identifica visualmente a tu gato.'],
    8: ['Collar decorativo elegante.', 'Accesorio de aspecto especial.'],
    9: ['Collar de lujo.', 'Accesorio de colección.'],
    10: ['Collar con cascabel.', 'Ayuda a identificar al gato por el sonido.'],
    11: ['Cama acolchada para gatos.', 'Accesorio de confort para el hogar.'],
    12: ['Arenero para la higiene del gato.', 'Accesorio instalable en casa.'],
    13: ['Decoración de coral.', 'Decora el acuario.'],
    14: ['Castillo para el acuario.', 'Añade un refugio visual a la pecera.'],
    15: ['Piña decorativa.', 'Decora el acuario.'],
    16: ['Cueva rocosa.', 'Añade un escondite visual.'],
    17: ['Planta acuática.', 'Decora el acuario.'],
    18: ['Vacuna completa.', 'Tratamiento doméstico para mascotas.'],
    19: ['Antibiótico.', 'Tratamiento doméstico para gatos.'],
    20: ['Vitaminas.', 'Tratamiento apto para gatos y peces.'],
    21: ['Antiparasitario.', 'Tratamiento apto para gatos y peces.'],
    22: ['Acuario de agua caliente para 3 peces.', 'Solo admite especies tropicales.'],
    23: ['Acuario de agua caliente para 6 peces.', 'Solo admite especies tropicales.'],
    24: ['Acuario de agua caliente para 10 peces.', 'Solo admite especies tropicales.'],
    25: ['Collar de cuero.', 'Accesorio resistente y decorativo.'],
    26: ['Collar inteligente con localización GPS.', 'Protege al gato contra pérdidas y permite consultar su última ubicación conocida.'],
    27: ['Rascador para gatos.', 'Accesorio de enriquecimiento ambiental.'],
    28: ['Tesoro pirata para el acuario.', 'Decoración coleccionable.'],
    29: ['Barco hundido para el acuario.', 'Decoración coleccionable.'],
    30: ['Algas decorativas.', 'Decoración para acuarios.']
  };

  const ROUTE_OPTIONS = {
    C1: ['Tienda', 'Veterinario'],
    '5A': ['Tienda'],
    '15C': ['Protectora', 'Tienda'],
    '28': ['Veterinario'],
    '9B': ['Trabajo']
  };

  let sessionToken = '';
  let busy = false;

  const original = {
    initializeGame: window.initializeGame,
    updateCatsDisplay: window.updateCatsDisplay,
    updateShelterDisplay: window.updateShelterDisplay,
    updateShopDisplay: window.updateShopDisplay,
    updateAdminDisplay: window.updateAdminDisplay,
    updateActiveJobsDisplay: window.updateActiveJobsDisplay,
    updateJobButtons: window.updateJobButtons,
    showSection: window.showSection,
    logout: window.logout
  };

  function apiUrl(path) {
    if (API_BASE.includes('REEMPLAZAR-POR-TU-WORKER')) {
      throw new Error('Falta configurar la URL del Worker en game-cloudflare.js.');
    }
    return `${API_BASE.replace(/\/$/, '')}${path}`;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
    const response = await fetch(apiUrl(path), {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      credentials: 'omit'
    });
    let data;
    try { data = await response.json(); } catch { data = { error: `Respuesta HTTP ${response.status} no válida.` }; }
    if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
    return data;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function currentUser() {
    return gameState.currentUser ? gameState.users[gameState.currentUser] : null;
  }

  function applyUser(user) {
    if (!user || !gameState.currentUser) return;
    user.activeJobs = Array.isArray(user.activeJobs) ? user.activeJobs : [];
    user.breedingProjects = Array.isArray(user.breedingProjects) ? user.breedingProjects : [];
    user.pets = Array.isArray(user.pets) ? user.pets : [];
    user.aquariums = Array.isArray(user.aquariums) ? user.aquariums : [];
    user.catAccessories = Array.isArray(user.catAccessories) ? user.catAccessories : [];
    user.inventory = user.inventory || {};
    user.automation = user.automation || { enabled: false, permissions: [], dailyBudget: 0, dailySpent: 0 };
    user.location = user.location || 'Casa';
    gameState.users[gameState.currentUser] = user;
    if (user.gameTime) gameState.gameTime = user.gameTime;
    updateDisplay();
  }

  async function refreshGame() {
    const data = await api('/api/game');
    if (data.user) applyUser(data.user);
    gameState.availablePets = Array.isArray(data.availablePets) ? data.availablePets : [];
    gameState.sharedShelters = Array.isArray(data.shelters) ? data.shelters : [];
    updateDisplay();
    return data;
  }

  function refreshVisibleSections() {
    if (!gameState.currentUser) return;
    updateDisplay();
    if (!document.getElementById('homeSection').classList.contains('hidden')) updatePetsDisplay();
    if (!document.getElementById('shelterSection').classList.contains('hidden')) updateShelterDisplay();
    if (!document.getElementById('workSection').classList.contains('hidden')) updateWorkDisplay();
    updateCaregiverPanel();
  }

  function setBusy(value) {
    busy = !!value;
    document.body.dataset.apiBusy = busy ? 'true' : 'false';
  }

  function notifyError(error) {
    console.error(error);
    alert(error instanceof Error ? error.message : 'Ha ocurrido un error.');
  }

  function requireLoggedIn() {
    if (!sessionToken || !gameState.currentUser) throw new Error('Inicia sesión para continuar.');
  }

  // Catálogo de peces separado por temperatura. Las peceras solo aceptan su categoría.
  if (gameState.breeds?.fish) {
    const cold = gameState.breeds.fish.coldWater;
    const warm = gameState.breeds.fish.warmWater;
    const addUnlessExists = (list, data) => { if (!list.some(item => item.name === data.name)) list.push(data); };
    addUnlessExists(cold, { name: 'Shubunkin', emoji: '🐠', colors: ['azul moteado', 'naranja moteado'], photo: '', temperature: 'cold' });
    addUnlessExists(cold, { name: 'Carpín dorado', emoji: '🐟', colors: ['dorado', 'rojo'], photo: '', temperature: 'cold' });
    addUnlessExists(warm, { name: 'Guppy', emoji: '🐟', colors: ['multicolor', 'azul', 'rojo'], photo: '', temperature: 'warm' });
    addUnlessExists(warm, { name: 'Betta', emoji: '🐠', colors: ['azul', 'rojo', 'blanco'], photo: '', temperature: 'warm' });
    addUnlessExists(warm, { name: 'Tetra neón', emoji: '🐠', colors: ['azul y rojo'], photo: '', temperature: 'warm' });
    addUnlessExists(warm, { name: 'Molly', emoji: '🐟', colors: ['negro', 'dorado', 'moteado'], photo: '', temperature: 'warm' });
  }

  // Sustituye el guardado local por sincronización mínima con D1.
  window.loadGameData = function () {
    gameState.users = {};
    gameState.availablePets = [];
    gameState.sharedShelters = [];
  };

  window.saveGameData = async function () {
    if (!sessionToken || !gameState.currentUser) return;
    try {
      await api('/api/game/state', {
        method: 'PUT',
        body: { gameTime: gameState.gameTime }
      });
    } catch (error) {
      console.error('No se pudo sincronizar el reloj del juego:', error);
    }
  };

  window.generateInitialPets = function () { /* Las mascotas iniciales se crean en D1 y son comunes a todas las cuentas. */ };
  window.addRandomPetToShelter = function () { /* Evita que cada navegador invente su propia protectora. */ };
  window.updatePetStats = function () { /* Las estadísticas no se degradan aleatoriamente en cada navegador. */ };
  window.startGameTime = function () {
    if (window.__gatosPecesRefreshTimer) return;
    window.__gatosPecesRefreshTimer = setInterval(async () => {
      if (!sessionToken || !gameState.currentUser || busy) return;
      try { await refreshGame(); refreshVisibleSections(); } catch (error) { console.warn('No se pudo actualizar el juego desde D1:', error); }
    }, 60000);
  };

  window.handleLogin = async function (event) {
    event.preventDefault();
    if (busy) return;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return alert('Completa el usuario y la contraseña.');
    setBusy(true);
    try {
      const result = await api('/api/login', { method: 'POST', body: { username, password } });
      sessionToken = result.token;
      gameState.currentUser = result.user.username;
      await refreshGame();
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('gameScreen').classList.remove('hidden');
      document.getElementById('adminBtn').classList.toggle('hidden', !currentUser().isAdmin);
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      showSection('home');
      updatePetsDisplay();
      updateCaregiverPanel();
    } catch (error) {
      notifyError(error);
    } finally { setBusy(false); }
  };

  window.handleCreateAccount = async function (event) {
    event.preventDefault();
    if (busy) return;
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const code = document.getElementById('adminBootstrapCode')?.value.trim() || '';
    if (!username || !password) return alert('Completa el usuario y la contraseña.');
    setBusy(true);
    try {
      const result = await api('/api/register', { method: 'POST', body: { username, password, bootstrapCode: code } });
      sessionToken = result.token;
      gameState.currentUser = result.user.username;
      await refreshGame();
      hideCreateAccountModal();
      if (document.getElementById('adminBootstrapCode')) document.getElementById('adminBootstrapCode').value = '';
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('gameScreen').classList.remove('hidden');
      document.getElementById('adminBtn').classList.toggle('hidden', !currentUser().isAdmin);
      showSection('home');
      updatePetsDisplay();
      updateCaregiverPanel();
      alert(result.message || 'Cuenta creada.');
    } catch (error) {
      notifyError(error);
    } finally { setBusy(false); }
  };

  window.logout = async function () {
    if (sessionToken) {
      try { await api('/api/logout', { method: 'POST', body: {} }); } catch (error) { console.warn(error); }
    }
    sessionToken = '';
    gameState.currentUser = null;
    gameState.users = {};
    gameState.availablePets = [];
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('adminBtn').classList.add('hidden');
  };

  window.showSection = function (section) {
    const user = currentUser();
    if (user) {
      const required = { shelter: 'Protectora', vet: 'Veterinario', work: 'Trabajo' };
      if (required[section] && user.location !== required[section]) {
        alert(`No puedes acceder todavía. Estás en ${user.location}; necesitas llegar a ${required[section]} en VITRASA.`);
        return original.showSection('transport');
      }
    }
    return original.showSection(section);
  };

  async function postAndApply(path, body) {
    requireLoggedIn();
    const result = await api(path, { method: 'POST', body });
    if (result.user) applyUser(result.user);
    return result;
  }

  window.buyItem = async function (itemId) {
    try {
      const result = await postAndApply('/api/shop/buy', { itemId: Number(itemId) });
      updateInventoryDisplay();
      alert(`Comprado: ${result.item.name}. Quedan ${currentUser().coins} monedas.`);
    } catch (error) { notifyError(error); }
  };

  window.adoptPet = async function (petId) {
    try {
      const result = await postAndApply('/api/shelter/adopt', { petId: String(petId) });
      await refreshGame();
      updateShelterDisplay();
      updatePetsDisplay();
      alert(`Has adoptado a ${result.pet.name}. La adopción se ha registrado en la red compartida de protectoras.`);
    } catch (error) { notifyError(error); }
  };

  window.takeTransport = async function (line, destination) {
    try {
      requireLoggedIn();
      const user = currentUser();
      let target = destination;
      if (!target) {
        const stops = ROUTE_OPTIONS[String(line).toUpperCase()] || [];
        if (!stops.length) throw new Error('No hay destinos configurados para esa línea.');
        let options = stops;
        if (user.location !== 'Casa') {
          if (!stops.includes(user.location)) throw new Error(`La línea ${line} no pasa por ${user.location}.`);
          options = [...stops.filter(stop => stop !== user.location), 'Casa'];
        }
        const selection = prompt(`Línea ${line}. Elige destino:\n${options.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nEscribe el número del destino:`);
        if (selection === null) return;
        const index = Number(selection) - 1;
        if (!Number.isInteger(index) || !options[index]) throw new Error('Destino no válido.');
        target = options[index];
      }
      const result = await postAndApply('/api/transport', { line, destination: target });
      alert(`VITRASA ${line}: ${result.from} → ${result.destination}. Billete: ${result.fare} monedas.`);
      const sections = { Casa: 'home', Tienda: 'shop', Protectora: 'shelter', Veterinario: 'vet', Trabajo: 'work' };
      showSection(sections[result.destination] || 'home');
      refreshVisibleSections();
    } catch (error) { notifyError(error); }
  };

  window.treatPet = async function (petId) {
    try {
      await postAndApply('/api/pets/treat-vet', { petId: String(petId) });
      updateDisplay(); updateVetDisplay(); updatePetsDisplay();
      alert('Tratamiento veterinario completado. Se han descontado 50 monedas.');
    } catch (error) { notifyError(error); }
  };

  window.feedAllPets = async function () {
    try {
      await postAndApply('/api/pets/feed-all', {});
      updateInventoryDisplay(); updatePetsDisplay();
      alert('Todas las mascotas que tienes han sido alimentadas.');
    } catch (error) { notifyError(error); }
  };

  window.feedPet = async function (petId) {
    try {
      await postAndApply('/api/pets/feed', { petId: String(petId) });
      updateInventoryDisplay(); updatePetsDisplay();
      showPetDetails(String(petId));
    } catch (error) { notifyError(error); }
  };

  window.playWithPet = async function (petId) {
    try {
      await postAndApply('/api/pets/play', { petId: String(petId) });
      updatePetsDisplay();
      showPetDetails(String(petId));
    } catch (error) { notifyError(error); }
  };

  window.treatPetAtHome = async function (petId, medicineName) {
    try {
      await postAndApply('/api/pets/treat-home', { petId: String(petId), medicineName });
      updateInventoryDisplay(); updatePetsDisplay();
      showPetDetails(String(petId));
    } catch (error) { notifyError(error); }
  };

  window.putCollar = async function (petId, collarName) {
    try {
      const result = await postAndApply('/api/pets/collar', { petId: String(petId), collarName });
      updateInventoryDisplay(); updatePetsDisplay();
      showPetDetails(String(petId));
      if (result.effect === 'GPS_ACTIVATED') alert('📍 GPS activado. Este gato queda protegido contra pérdidas y podrás consultar su última ubicación conocida.');
    } catch (error) { notifyError(error); }
  };

  window.trackPet = async function (petId) {
    try {
      const result = await api('/api/pets/track', { method: 'POST', body: { petId: String(petId) } });
      alert(`📍 GPS de ${result.petName}\nUbicación conocida: ${result.location}\nEstado: ${result.message}`);
    } catch (error) { notifyError(error); }
  };

  window.installAquarium = async function (name) {
    try {
      await postAndApply('/api/aquariums/install', { name });
      updateInventoryDisplay(); updatePetsDisplay(); closeModal();
      alert(`Pecera ${name} instalada. Solo acepta peces de su temperatura de agua.`);
    } catch (error) { notifyError(error); }
  };

  window.removeAquarium = async function (aquariumId) {
    if (!confirm('¿Quieres retirar esta pecera? Debe estar vacía.')) return;
    try {
      await postAndApply('/api/aquariums/remove', { aquariumId: String(aquariumId) });
      updateInventoryDisplay(); updatePetsDisplay();
    } catch (error) { notifyError(error); }
  };

  window.addDecoration = async function (aquariumId, name) {
    try {
      await postAndApply('/api/aquariums/decorate', { aquariumId: String(aquariumId), name });
      updateInventoryDisplay(); updatePetsDisplay(); closeModal();
    } catch (error) { notifyError(error); }
  };

  window.removeDecoration = async function (aquariumId, name) {
    try {
      await postAndApply('/api/aquariums/undecorate', { aquariumId: String(aquariumId), name });
      updateInventoryDisplay(); updatePetsDisplay(); decorateAquarium(String(aquariumId));
    } catch (error) { notifyError(error); }
  };

  window.installCatAccessory = async function (name) {
    try {
      await postAndApply('/api/accessories/install', { name });
      updateInventoryDisplay(); updatePetsDisplay(); closeModal();
    } catch (error) { notifyError(error); }
  };

  window.removeCatAccessory = async function (id) {
    const accessory = currentUser()?.catAccessories.find(item => item.id === String(id));
    if (!accessory) return;
    try {
      await postAndApply('/api/accessories/remove', { id: String(id), name: accessory.name });
      updateInventoryDisplay(); updatePetsDisplay();
    } catch (error) { notifyError(error); }
  };

  window.startBreeding = async function (type) {
    try {
      const result = await postAndApply('/api/breeding/start', { type });
      updateDisplay(); updateWorkDisplay();
      alert(`Cría iniciada. Se completará cuando finalice el tiempo del proyecto (${result.project.expectedOffspring} crías previstas). En peces, padres y pecera deben coincidir en especie y temperatura.`);
    } catch (error) { notifyError(error); }
  };

  window.startJob = async function (jobType) {
    try {
      const result = await postAndApply('/api/jobs/start', { type: jobType });
      updateWorkDisplay();
      alert(`Has empezado ${getJobName(jobType)}. El trabajo no se cobra por esperar: debes completar sus tres tareas.`);
    } catch (error) { notifyError(error); }
  };

  window.doJobTask = async function (jobId, taskId) {
    try {
      const result = await postAndApply('/api/jobs/task', { jobId: String(jobId), taskId: Number(taskId) });
      updateWorkDisplay(); updateDisplay();
      if (result.completed) alert(`Trabajo realizado. Has cobrado ${result.paid} monedas.`);
    } catch (error) { notifyError(error); }
  };

  window.completeJob = function () {
    alert('Para cobrar tienes que completar las tres tareas que aparecen en el trabajo activo.');
  };

  window.cancelJob = async function (jobId) {
    if (!confirm('¿Cancelar el trabajo? No recibirás el pago.')) return;
    try {
      await postAndApply('/api/jobs/cancel', { jobId: String(jobId) });
      updateWorkDisplay();
    } catch (error) { notifyError(error); }
  };

  window.updateActiveJobsDisplay = function () {
    const user = currentUser();
    const container = document.getElementById('activeJobsList');
    const empty = document.getElementById('noActiveJobs');
    if (!user || !container || !empty) return;
    if (!user.activeJobs.length) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    container.innerHTML = user.activeJobs.map(job => `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <div><h4 class="font-semibold text-gray-800">${getJobEmoji(job.type)} ${esc(getJobName(job.type))}</h4>
          <p class="text-sm text-gray-600">Pago al terminar: ${Number(job.payment) || 0} monedas</p></div>
          <button onclick="cancelJob('${esc(job.id)}')" class="bg-red-500 text-white px-3 py-2 rounded-lg">Cancelar</button>
        </div>
        <div class="space-y-2">${(job.tasks || []).map(task => `
          <div class="flex items-center justify-between bg-white rounded p-2">
            <span class="text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}">${task.done ? '✅' : '⬜'} ${esc(task.label)}</span>
            ${task.done ? '<span class="text-xs text-green-700">Hecha</span>' : `<button onclick="doJobTask('${esc(job.id)}',${Number(task.id)})" class="bg-green-600 text-white px-3 py-1 rounded text-sm">Realizar</button>`}
          </div>`).join('')}</div>
        <p class="text-xs text-gray-500 mt-2">El pago se ingresa al completar todas las tareas.</p>
      </div>`).join('');
  };

  window.updateJobButtons = function () {
    const user = currentUser();
    if (!user) return;
    const rules = {
      petCare: user.pets.length >= 1,
      vetAssistant: Object.entries(user.inventory).some(([name, count]) => gameState.shopItems.find(item => item.name === name && item.category === 'medicine') && count > 0),
      trainer: user.pets.filter(pet => Number(pet.happiness) > 70).length >= 3,
      beautyContest: user.pets.some(pet => !!pet.collar)
    };
    for (const [id, allowed] of Object.entries(rules)) {
      const button = document.querySelector(`[onclick="startJob('${id}')"]`);
      if (button) {
        const canStart = allowed && user.location === 'Trabajo';
        button.disabled = !canStart;
        button.classList.toggle('opacity-50', !canStart);
      }
    }
  };

  window.updateShopDisplay = function () {
    const container = document.getElementById('shopSection');
    const itemsGrid = container.querySelector('.grid');
    itemsGrid.innerHTML = gameState.shopItems.map(item => {
      const info = PRODUCT_INFO[item.id] || ['Artículo para mascotas.', 'Consulta sus características antes de comprar.'];
      return `<div class="shop-item bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-4xl mb-4">${esc(item.emoji)}</div>
        <h3 class="font-semibold text-gray-800 mb-2">${esc(item.name)}</h3>
        <p class="text-sm text-gray-600 mb-2">${esc(info[0])}</p>
        <p class="text-xs text-blue-700 mb-4">⭐ ${esc(info[1])}</p>
        <p class="text-2xl font-bold text-green-600 mb-4">${Number(item.price)} 🪙</p>
        <button onclick="buyItem(${Number(item.id)})" class="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition duration-200">Comprar</button>
      </div>`;
    }).join('');
  };

  window.updateShelterDisplay = function () {
    if (original.updateShelterDisplay) original.updateShelterDisplay();
    const grid = document.querySelector('#shelterSection .grid');
    if (!grid) return;
    [...grid.children].forEach((card, index) => {
      const pet = gameState.availablePets[index];
      if (!pet || !pet.shelterName) return;
      const label = document.createElement('p');
      label.className = 'text-xs text-purple-700 mb-2';
      label.textContent = `🏠 ${pet.shelterName}`;
      const button = card.querySelector('button');
      if (button) button.before(label);
    });
  };

  window.updateCatsDisplay = function () {
    if (original.updateCatsDisplay) original.updateCatsDisplay();
    const container = document.getElementById('catsContainer');
    if (!container) return;
    const cats = currentUser()?.pets.filter(p => p.type === 'cat') || [];
    [...container.children].forEach((card, index) => {
      const pet = cats[index];
      if (!pet) return;
      if (pet.gpsProtected) {
        const mark = document.createElement('p');
        mark.className = 'text-xs text-green-700 mt-1';
        mark.textContent = '📍 GPS activo · protegido contra pérdidas';
        card.querySelector('h3')?.after(mark);
        const track = document.createElement('button');
        track.type = 'button';
        track.className = 'mt-2 bg-blue-600 text-white text-xs px-3 py-1 rounded';
        track.textContent = 'Localizar GPS';
        track.onclick = event => { event.stopPropagation(); trackPet(pet.id); };
        card.querySelector('.text-center')?.append(track);
      }
    });
  };

  window.updateAdminDisplay = async function () {
    const user = currentUser();
    if (!user?.isAdmin) return;
    try {
      const result = await api('/api/admin/summary');
      const list = document.getElementById('breedsList');
      if (list) list.innerHTML = `<div class="p-3 bg-gray-50 rounded-lg"><h4 class="font-semibold">Estado general</h4><p class="text-sm">Cuentas: ${result.users}</p><p class="text-sm">Mascotas disponibles en protectoras: ${result.availableShelterPets}</p><p class="text-sm">Adopciones realizadas: ${result.adoptions}</p></div>`;
      const items = document.getElementById('shopItemsList');
      if (items) items.innerHTML = '<p class="text-sm text-gray-600">El catálogo y sus precios se validan en el Worker para evitar compras manipuladas desde el navegador.</p>';
    } catch (error) { notifyError(error); }
  };

  window.saveCaregiverSettings = async function () {
    try {
      requireLoggedIn();
      const enabled = document.getElementById('caregiverEnabled').checked;
      const permissions = [...document.querySelectorAll('[data-care-permission]:checked')].map(input => input.dataset.carePermission);
      const dailyBudget = Number(document.getElementById('caregiverBudget').value || 0);
      const result = await api('/api/automation/settings', { method: 'PUT', body: { enabled, permissions, dailyBudget } });
      applyUser(result.user);
      updateCaregiverPanel();
      alert('Permisos y límite diario del cuidador guardados en Cloudflare.');
    } catch (error) { notifyError(error); }
  };

  window.runCaregiverNow = async function () {
    try {
      const result = await api('/api/automation/run', { method: 'POST', body: {} });
      await refreshGame();
      updateCaregiverPanel();
      alert(result.report?.length ? result.report.join('\n') : `El cuidador no tenía ninguna tarea autorizada o necesaria. Gasto hoy: ${result.spentToday || 0}/${result.dailyBudget || 0} monedas.`);
    } catch (error) { notifyError(error); }
  };

  function updateCaregiverPanel() {
    const user = currentUser();
    const panel = document.getElementById('caregiverPanel');
    if (!user || !panel) return;
    const config = user.automation || {};
    const enabled = document.getElementById('caregiverEnabled');
    const budget = document.getElementById('caregiverBudget');
    if (enabled) enabled.checked = !!config.enabled;
    if (budget) budget.value = Number(config.dailyBudget || 0);
    document.querySelectorAll('[data-care-permission]').forEach(input => {
      input.checked = (config.permissions || []).includes(input.dataset.carePermission);
    });
    const status = document.getElementById('caregiverStatus');
    if (status) status.textContent = `Gasto automático hoy: ${Number(config.dailySpent || 0)} / ${Number(config.dailyBudget || 0)} monedas. Límite máximo configurable: 500 monedas/día.`;
  }

  // Corregir detalles de compatibilidad en las pantallas heredadas.
  window.showPetDetails = function (petId) {
    const user = currentUser();
    const pet = user?.pets.find(item => String(item.id) === String(petId));
    if (!pet) return;
    const allFish = [...gameState.breeds.fish.coldWater, ...gameState.breeds.fish.warmWater];
    const breedData = pet.type === 'cat' ? gameState.breeds.cat.find(b => b.name === pet.breed) : allFish.find(b => b.name === pet.breed);
    const collars = gameState.shopItems.filter(item => item.category === 'collar' && Number(user.inventory[item.name] || 0) > 0);
    const medicines = gameState.shopItems.filter(item => item.category === 'medicine' && Number(user.inventory[item.name] || 0) > 0 && (pet.type === 'cat' || ['Vitaminas', 'Antiparasitario'].includes(item.name)));
    const modal = document.getElementById('petModal');
    const content = document.getElementById('petModalContent');
    content.innerHTML = `<div class="text-center">
      <div class="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden bg-gray-200 border-4 border-blue-300"><img src="${esc(breedData?.photo || '')}" alt="${esc(pet.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="text-8xl pt-8 hidden">${esc(pet.emoji)}</div></div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">${esc(pet.name)}</h2>
      <p class="text-gray-600 mb-1">${pet.gender === 'male' ? '♂️ Macho' : '♀️ Hembra'} · ${esc(pet.breed)}</p>
      <p class="text-gray-500 mb-3">${esc(pet.color)} · ${Number(pet.age).toFixed(1)} meses</p>
      ${pet.type === 'fish' ? `<p class="text-blue-700 text-sm mb-3">${pet.temperature === 'warm' ? '🌡️ Agua caliente' : '❄️ Agua fría'} · Solo compatible con peceras de la misma temperatura</p>` : ''}
      ${pet.collar ? `<p class="text-purple-700 text-sm mb-2">🎀 ${esc(pet.collar)}</p>` : ''}
      ${pet.gpsProtected ? `<p class="text-green-700 text-sm mb-3">📍 GPS activo: protegido contra pérdidas</p><button onclick="trackPet('${esc(pet.id)}')" class="bg-blue-600 text-white px-4 py-2 rounded mb-4">Localizar con GPS</button>` : ''}
      <div class="grid grid-cols-2 gap-3 mb-4"><div class="bg-gray-50 p-2 rounded"><b>Salud</b><p>${Math.round(pet.health)}%</p></div><div class="bg-gray-50 p-2 rounded"><b>Felicidad</b><p>${Math.round(pet.happiness)}%</p></div></div>
      <div class="grid grid-cols-2 gap-2 mb-4"><button onclick="feedPet('${esc(pet.id)}')" class="bg-green-500 text-white py-2 rounded">🥫 Alimentar</button><button onclick="playWithPet('${esc(pet.id)}')" class="bg-blue-500 text-white py-2 rounded">🎾 Jugar</button></div>
      ${pet.type === 'cat' && collars.length ? `<h4 class="font-medium mb-2">Poner collar</h4><div class="grid grid-cols-2 gap-2 mb-4">${collars.map(item => `<button onclick="putCollar('${esc(pet.id)}','${esc(item.name)}')" class="bg-purple-500 text-white py-2 rounded text-sm">${esc(item.emoji)} ${esc(item.name)}</button>`).join('')}</div>` : ''}
      ${medicines.length ? `<h4 class="font-medium mb-2">Tratar en casa</h4><div class="grid grid-cols-2 gap-2 mb-4">${medicines.map(item => `<button onclick="treatPetAtHome('${esc(pet.id)}','${esc(item.name)}')" class="bg-red-500 text-white py-2 rounded text-sm">${esc(item.emoji)} ${esc(item.name)}</button>`).join('')}</div>` : ''}
      <button onclick="closeModal()" class="w-full bg-gray-500 text-white py-2 rounded">Cerrar</button>
    </div>`;
    modal.classList.remove('hidden');
  };

  // Evita que funciones de administración del navegador alteren el catálogo local solamente.
  window.addBreed = function () { alert('La gestión compartida de razas se añadirá en el siguiente bloque del panel de administración.'); };
  window.addShopItem = function () { alert('El catálogo oficial y sus precios se controlan en el Worker para proteger la economía del juego.'); };
  window.removeShopItem = function () { alert('No se permite eliminar productos desde el navegador.'); };

  // Inicialización del panel de automatización; el resto de los botones originales se conservan.
  const caregiverPanel = `
    <div id="caregiverPanel" class="bg-white rounded-xl shadow-sm p-6 mt-6">
      <h3 class="text-xl font-semibold text-gray-800 mb-3">🤖 Cuidador automático</h3>
      <p class="text-sm text-gray-600 mb-4">La IA aplica reglas de cuidado. Solo puede gastar con tus permisos y nunca superar el límite diario.</p>
      <label class="flex items-center gap-2 mb-3"><input id="caregiverEnabled" type="checkbox" class="w-4 h-4"> Activar cuidador automático</label>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-sm">
        <label class="flex items-center gap-2"><input type="checkbox" data-care-permission="feed" class="w-4 h-4"> Alimentar con comida del inventario</label>
        <label class="flex items-center gap-2"><input type="checkbox" data-care-permission="buy_food" class="w-4 h-4"> Comprar comida si se agota</label>
        <label class="flex items-center gap-2"><input type="checkbox" data-care-permission="vet" class="w-4 h-4"> Autorizar tratamiento veterinario</label>
        <label class="flex items-center gap-2"><input type="checkbox" data-care-permission="travel_vet" class="w-4 h-4"> Autorizar viajes VITRASA al veterinario</label>
      </div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Límite de gasto diario (0–500 monedas)</label>
      <input id="caregiverBudget" type="number" min="0" max="500" step="5" value="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3">
      <p id="caregiverStatus" class="text-xs text-gray-600 mb-3"></p>
      <div class="flex flex-wrap gap-2">
        <button onclick="saveCaregiverSettings()" class="bg-blue-600 text-white px-4 py-2 rounded-lg">Guardar permisos</button>
        <button onclick="runCaregiverNow()" class="bg-green-600 text-white px-4 py-2 rounded-lg">Ejecutar ahora</button>
      </div>
    </div>`;

  document.addEventListener('DOMContentLoaded', () => {
    const home = document.getElementById('homeSection');
    if (home && !document.getElementById('caregiverPanel')) {
      const quickActions = [...home.querySelectorAll('.bg-white.rounded-xl')].find(el => el.textContent.includes('Acciones Rápidas'));
      if (quickActions?.parentElement) quickActions.insertAdjacentHTML('afterend', caregiverPanel);
    }
    // La línea de trabajo no existía en la maqueta original.
    const transportGrid = document.querySelector('#transportSection .grid');
    if (transportGrid && !document.getElementById('workBusRoute')) {
      const card = document.createElement('div');
      card.id = 'workBusRoute';
      card.className = 'bg-white rounded-xl shadow-sm p-6 text-center';
      card.innerHTML = '<div class="text-4xl mb-4">🚌</div><h3 class="font-semibold text-gray-800 mb-2">Línea 9B</h3><p class="text-sm text-gray-600 mb-4">Casa → Centro de trabajo → Casa</p><button onclick="takeTransport(\'9B\')" class="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600">15 monedas</button>';
      transportGrid.append(card);
    }
  });

  window.updateCaregiverPanel = updateCaregiverPanel;
})();
