// game.js — Lógica general del Tamagochi

let db = DB.load();

function login(){
  const name = document.getElementById("loginName").value.trim();
  if (!name) return;

  db.user = name;
  DB.save(db);
  loadSection("home");
}

// ---------------------------------------
// Mascotas
// ---------------------------------------

function renderPets(){
  const cont = document.getElementById("petsList");
  if (!cont) return;

  if (db.pets.length === 0){
    cont.innerHTML = `<p>No tienes mascotas.</p>`;
    return;
  }

  cont.innerHTML = db.pets.map(pet => `
    <div class="card">
      <h3 class="text-xl">${pet.name}</h3>
      <p>❤️ ${pet.happiness}</p>
      <p>🍗 ${pet.hunger}</p>
    </div>
  `).join("");
}

function adoptPet(name){
  db.pets.push({
    name,
    hunger: 100,
    happiness: 100
  });
  DB.save(db);
  loadSection("home");
}

// ---------------------------------------
// Protectora
// ---------------------------------------

function renderShelter(){
  const list = document.getElementById("shelterList");
  if (!list) return;

  const adoptables = ["Gato gris", "Gato negro", "Gato siames"];

  list.innerHTML = adoptables.map(n => `
    <div class="card">
      <h3>${n}</h3>
      <button class="btn" onclick="adoptPet('${n}')">Adoptar</button>
    </div>
  `).join("");
}

// ---------------------------------------
// Tienda
// ---------------------------------------

const shopItems = [
  { id:1, name:"Comida", price:20 },
  { id:2, name:"Juguete", price:35 },
  { id:3, name:"Agua", price:5 }
];

function renderShop(){
  const list = document.getElementById("shopList");
  if (!list) return;

  list.innerHTML = shopItems.map(item => `
    <div class="card">
      <h3 class="text-lg">${item.name}</h3>
      <p>${item.price} 🪙</p>
      <button class="btn mt-2" onclick="buyItem(${item.id})">Comprar</button>
    </div>
  `).join("");
}

function buyItem(id){
  const item = shopItems.find(i => i.id === id);
  if (!item) return;

  if (db.coins < item.price){
    alert("No tienes suficientes monedas");
    return;
  }

  db.coins -= item.price;
  db.items.push(item);
  DB.save(db);

  alert(`Compraste ${item.name}`);
}

// ---------------------------------------
// Trabajos
// ---------------------------------------

function workEarn(){
  const gained = Math.floor(Math.random()*20)+5;
  db.coins += gained;
  DB.save(db);

  document.getElementById("workMsg").textContent =
    `Ganaste ${gained} monedas`;
}
