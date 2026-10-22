/* =====================================================
   JBC COMERCIAL — ACCESO SEGÚN LA SESIÓN
   Muestra u oculta el menú y las secciones de cada página
   según quién esté conectado. Se carga en TODAS las páginas,
   después de supabase-client.js y utilidades.js.

   Se controla con el atributo data-acceso en el HTML:

     data-acceso="visitante"  solo sin sesión       (ej. «Iniciar sesión»)
     data-acceso="sesion"     cualquier usuario con sesión (vendedor o admin)
     data-acceso="admin"      solo administradores
     (sin atributo)           siempre visible

   Los elementos con data-acceso empiezan ocultos (atributo hidden)
   y este script los muestra cuando corresponde. Así no se ve un
   parpadeo de opciones que la persona no puede usar.

   IMPORTANTE: esto solo cambia lo que se VE. La protección real de
   los datos son las políticas RLS de Supabase (sql/rls_politicas.sql).
===================================================== */

let accesoPeticion = 0; // descarta respuestas viejas si hay cambios seguidos

function visibleSegunAcceso(tipo, perfil) {
  if (tipo === "visitante") return !perfil;
  if (tipo === "sesion") return !!perfil;
  if (tipo === "admin") return esAdministrador(perfil);
  return true; // valor desconocido: no se oculta
}

// Aplica los permisos a la página y devuelve el perfil conectado (o null)
async function aplicarAcceso() {
  const id = ++accesoPeticion;
  const perfil = await obtenerPerfilActual();

  if (id !== accesoPeticion) return perfil;

  document.querySelectorAll("[data-acceso]").forEach(function (el) {
    el.hidden = !visibleSegunAcceso(el.dataset.acceso, perfil);
  });

  const salir = document.querySelector("#menu-cerrar-sesion");
  if (salir && perfil) salir.title = "Sesión de " + perfil.nombres;

  return perfil;
}

// «Cerrar sesión» del menú
const menuSalir = document.querySelector("#menu-cerrar-sesion");

if (menuSalir) {
  menuSalir.addEventListener("click", async function (e) {
    e.preventDefault();
    await sup.auth.signOut();
    window.location.reload();
  });
}

// Si se inicia o cierra sesión en esta página, se actualiza el menú.
// Se difiere con setTimeout: dentro de este evento no se deben hacer
// otras consultas a Supabase (podría bloquearse).
sup.auth.onAuthStateChange(function (evento) {
  if (
    evento === "SIGNED_IN" ||
    evento === "SIGNED_OUT" ||
    evento === "USER_UPDATED"
  ) {
    setTimeout(aplicarAcceso, 0);
  }
});

// La primera vez, si la dirección trae #seccion (p. ej. #ingresar-producto),
// se baja hasta ella: estaba oculta cuando el navegador intentó ir a ese punto.
aplicarAcceso().then(function () {
  try {
    if (location.hash.length > 1) {
      const destino = document.querySelector(location.hash);
      if (destino && !destino.hidden) destino.scrollIntoView();
    }
  } catch (e) {
    /* hash no válido como selector: se ignora */
  }
});
