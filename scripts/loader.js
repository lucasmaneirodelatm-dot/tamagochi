// loader.js — Carga secciones sin romper jamás

const app = document.getElementById("app");

// Carga segura de secciones
async function loadSection(name){
    try {
        const path = `sections/${name}.html`;
        const res = await fetch(path);

        if (!res.ok){
            app.innerHTML = `
                <div class="card">
                    <h2>Error 404</h2>
                    <p>No se encontró: <b>${name}.html</b></p>
                </div>`;
            return;
        }

        const html = await res.text();
        app.innerHTML = html;

        if (window.onSectionLoaded){
            window.onSectionLoaded(name);
        }

    } catch (err){
        app.innerHTML = `
            <div class="card">
                <h2>Error de carga</h2>
                <p>${err.message}</p>
            </div>`;
    }
}

// Cargar la primera sección
loadSection("login");

// Delegación de eventos para botones nav-btn
document.addEventListener("click", (ev)=>{
    const btn = ev.target.closest("[data-section]");
    if (btn){
        loadSection(btn.dataset.section);
    }
});
