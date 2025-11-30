// storage.js — capa segura de localStorage

const DB = {
  load(){
    const raw = localStorage.getItem("TAMAGOCHI");
    if (!raw) return { user:null, pets:[], coins:100, items:[] };
    return JSON.parse(raw);
  },

  save(data){
    localStorage.setItem("TAMAGOCHI", JSON.stringify(data));
  }
};
