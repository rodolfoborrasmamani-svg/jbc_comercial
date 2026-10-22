/* =====================================================
   JBC COMERCIAL — NUEVO VENDEDOR (solo administrador)
   Abre una ventana, valida los datos y llama a la Edge Function
   `crear-vendedor`, que crea la cuenta y el usuario en el servidor.
   Requiere `sup`, utilidades.js y la función publicada en Supabase.
===================================================== */

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const btnNuevoVendedor = document.querySelector("#btn-nuevo-vendedor");
const modalVendedor = document.querySelector("#modal-vendedor");
const formVendedor = document.querySelector("#form-vendedor");
const mensajeVendedor = document.querySelector("#mensaje-vendedor");
const mensajeAdminVentas = document.querySelector("#mensaje-admin-ventas");

const vNombre = document.querySelector("#vendedor-nombre");
const vEmail = document.querySelector("#vendedor-email");
const vPassword = document.querySelector("#vendedor-password");
const vPassword2 = document.querySelector("#vendedor-password2");
const vMostrar = document.querySelector("#vendedor-mostrar");

// =====================================================
// VENTANA
// =====================================================

function abrirVendedor() {
  formVendedor.reset();
  vPassword.type = "password";
  vPassword2.type = "password";
  mostrarMensaje(mensajeVendedor, "");
  mostrarMensaje(mensajeAdminVentas, "");

  modalVendedor.hidden = false;
  document.body.classList.add("modal-abierto");
  vNombre.focus();
}

function cerrarVendedor() {
  // reset() borra también las contraseñas escritas
  formVendedor.reset();
  modalVendedor.hidden = true;
  document.body.classList.remove("modal-abierto");
}

btnNuevoVendedor.addEventListener("click", abrirVendedor);

document
  .querySelector("#btn-cancelar-vendedor")
  .addEventListener("click", cerrarVendedor);

// Clic fuera de la caja o Esc cierran la ventana
modalVendedor.addEventListener("click", function (e) {
  if (e.target === modalVendedor) cerrarVendedor();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !modalVendedor.hidden) cerrarVendedor();
});

vMostrar.addEventListener("change", function () {
  const tipo = vMostrar.checked ? "text" : "password";
  vPassword.type = tipo;
  vPassword2.type = tipo;
});

// =====================================================
// VALIDACIÓN (el servidor la repite: esta es solo para avisar rápido)
// =====================================================

function validarVendedor(d) {
  if (d.nombres.length < 3) return "Ingrese el nombre completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
    return "Ingrese un correo electrónico válido.";
  }
  if (d.password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (d.password !== d.password2) return "Las contraseñas no coinciden.";
  return null;
}

// Convierte el error de la Edge Function en un mensaje claro
async function textoErrorFuncion(error) {
  const respuesta = error && error.context;

  // La función respondió con un error: trae un mensaje en JSON
  if (respuesta && typeof respuesta.json === "function") {
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo && cuerpo.error) return cuerpo.error;
    } catch (e) {
      /* el cuerpo no era JSON: se usa el estado */
    }

    if (respuesta.status === 404) {
      return "La función crear-vendedor no está publicada en Supabase.";
    }
    if (respuesta.status === 401) {
      return "Su sesión venció. Vuelva a iniciar sesión.";
    }
  }

  if (error && error.name === "FunctionsFetchError") {
    return "No se pudo conectar con el servidor. Revise su conexión.";
  }

  return "No se pudo crear el vendedor.";
}

// =====================================================
// CREAR
// =====================================================

formVendedor.addEventListener("submit", async function (event) {
  event.preventDefault();

  const datos = {
    nombres: vNombre.value.trim().replace(/\s+/g, " "),
    email: vEmail.value.trim().toLowerCase(),
    password: vPassword.value,
    password2: vPassword2.value,
  };

  const problema = validarVendedor(datos);

  if (problema) {
    mostrarMensaje(mensajeVendedor, problema, "error");
    return;
  }

  const boton = formVendedor.querySelector('button[type="submit"]');
  boton.disabled = true;
  mostrarMensaje(mensajeVendedor, "Creando vendedor...");

  try {
    const r = await sup.functions.invoke("crear-vendedor", {
      body: {
        nombres: datos.nombres,
        email: datos.email,
        password: datos.password,
      },
    });

    if (r.error) {
      console.error("Error al crear el vendedor:", r.error);
      mostrarMensaje(
        mensajeVendedor,
        await textoErrorFuncion(r.error),
        "error",
      );
      return;
    }

    const vendedor = r.data && r.data.vendedor;

    cerrarVendedor();

    mostrarMensaje(
      mensajeAdminVentas,
      "Vendedor «" +
        (vendedor ? vendedor.nombres : datos.nombres) +
        "» creado. Ya puede iniciar sesión con " +
        datos.email +
        ".",
      "ok",
    );

    // El selector de vendedores del resumen debe incluir al nuevo
    if (typeof recargarVendedores === "function") recargarVendedores();
  } finally {
    boton.disabled = false;
  }
});
