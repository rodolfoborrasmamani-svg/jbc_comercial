/* =====================================================
   JBC COMERCIAL
   UTILIDADES COMPARTIDAS (se carga antes que el JS de cada página)
===================================================== */

// Evita inyección de HTML al pintar datos de la base
function escapeHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// "Micrófonos" y "microfonos" -> "microfonos"
function clave(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// 1250 -> "1.250,00"
function numeroBs(valor) {
  return (Number(valor) || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// 1250 -> "Bs 1.250,00"
function formatearBs(valor) {
  return "Bs " + numeroBs(valor);
}

// Muestra un mensaje en un <p class="mensaje-formulario">
// tipo: "ok" (verde), "error" (rojo) o undefined (neutro)
function mostrarMensaje(elemento, texto, tipo) {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.classList.remove("ok", "error");
  if (tipo) elemento.classList.add(tipo);
}

// =====================================================
// SESIÓN (Supabase Auth) Y ROL DE ADMINISTRADOR
// El login se hace en ventas.html con correo y contraseña.
// Supabase guarda la sesión del navegador y la renueva sola.
// Cada cuenta de Auth se vincula a una fila de `usuarios`
// mediante la columna usuarios.auth_id (= auth.users.id).
// =====================================================

// id_roles que cuentan como administrador (tabla usuarios).
// Cámbialo según tu base, por ejemplo [1, 2].
const ROLES_ADMIN = [1];

// Devuelve el perfil del usuario conectado, o null si no hay sesión
// o su cuenta no está vinculada a un usuario del sistema:
// { id_usuarios, nombres, id_roles, email }
async function obtenerPerfilActual() {
  const sesion = await sup.auth.getSession();
  const actual = sesion.data && sesion.data.session;

  if (!actual) return null;

  const resultado = await sup
    .from("usuarios")
    .select("id_usuarios, nombres, id_roles")
    .eq("auth_id", actual.user.id)
    .maybeSingle();

  if (resultado.error) {
    console.error("Error al leer el perfil del usuario:", resultado.error);
    return null;
  }

  if (!resultado.data) return null;

  return {
    id_usuarios: resultado.data.id_usuarios,
    nombres: resultado.data.nombres,
    id_roles: resultado.data.id_roles,
    email: actual.user.email,
  };
}

function esAdministrador(perfil) {
  return !!perfil && ROLES_ADMIN.includes(Number(perfil.id_roles));
}
