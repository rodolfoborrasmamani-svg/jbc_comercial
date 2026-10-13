/* =====================================================
   JBC COMERCIAL — CLIENTES
   Registro y listado de clientes (tabla `clientes`).
   Columnas esperadas: nombres, carnet, celular
   Requiere `sup` (supabase-client.js) y utilidades.js
===================================================== */

// =====================================================
// COLUMNAS DE LA TABLA `clientes`
// Si en tu base se llaman distinto, cámbialas SOLO aquí.
// =====================================================

const COL = {
  nombre: "nombres",
  carnet: "carnet",
  celular: "contacto", // columna del teléfono en tu tabla
};

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const formCliente = document.querySelector("#form-cliente");
const campoNombre = document.querySelector("#campo-nombre-cliente");
const campoCarnet = document.querySelector("#campo-carnet");
const campoCelular = document.querySelector("#campo-celular");
const mensajeCliente = document.querySelector("#mensaje-cliente");

const cuerpoClientes = document.querySelector("#cuerpo-clientes");
const contadorClientes = document.querySelector("#contador-clientes");
const buscarCliente = document.querySelector("#buscar-cliente");

// Todos los clientes cargados (el buscador filtra sobre esta lista)
let clientesCache = [];

// =====================================================
// LISTADO
// =====================================================

function renderizarClientes() {
  const texto = clave(buscarCliente.value);

  const lista = clientesCache.filter(function (c) {
    if (!texto) return true;
    return (
      clave(c[COL.nombre]).includes(texto) ||
      clave(c[COL.carnet]).includes(texto) ||
      clave(c[COL.celular]).includes(texto)
    );
  });

  if (lista.length === 0) {
    cuerpoClientes.innerHTML =
      '<tr class="estado-fila"><td colspan="3"><div class="estado-vacio">' +
      '<div class="icono">👥</div>' +
      "<h4>" +
      (texto ? "Sin resultados" : "Todavía no hay clientes registrados") +
      "</h4>" +
      "<p>" +
      (texto
        ? "Prueba con otro nombre, carnet o celular."
        : "Registra el primero con el formulario.") +
      "</p></div></td></tr>";

    contadorClientes.textContent = "0 clientes";
    return;
  }

  cuerpoClientes.innerHTML = lista
    .map(function (c) {
      return (
        '<tr class="fila-dato">' +
        '<td><span class="prod-nombre">' +
        escapeHtml(c[COL.nombre]) +
        "</span></td>" +
        "<td>" +
        escapeHtml(c[COL.carnet]) +
        "</td>" +
        "<td>" +
        escapeHtml(c[COL.celular]) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  contadorClientes.textContent =
    lista.length + (lista.length === 1 ? " cliente" : " clientes");
}

// Los datos de los clientes son privados: requieren sesión iniciada
function avisoSinSesion() {
  cuerpoClientes.innerHTML =
    '<tr class="estado-fila"><td colspan="3"><div class="estado-vacio">' +
    '<div class="icono">🔒</div>' +
    "<h4>Inicie sesión para ver los clientes</h4>" +
    '<p>Los datos de los clientes son privados. <a href="ventas.html#iniciar-sesion">Iniciar sesión</a></p>' +
    "</div></td></tr>";

  contadorClientes.textContent = "";

  formCliente.querySelectorAll("input, button").forEach(function (el) {
    el.disabled = true;
  });

  mostrarMensaje(
    mensajeCliente,
    "Inicie sesión para registrar clientes.",
    "error",
  );
}

async function cargarClientes() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    avisoSinSesion();
    return;
  }

  cuerpoClientes.innerHTML =
    '<tr class="estado-fila" aria-hidden="true">' +
    '<td><span class="skeleton"></span></td>' +
    '<td><span class="skeleton corto"></span></td>' +
    '<td><span class="skeleton corto"></span></td></tr>';
  contadorClientes.textContent = "Cargando…";

  const resultado = await sup
    .from("clientes")
    .select("*")
    .order(COL.nombre, { ascending: true });

  if (resultado.error) {
    console.error("Error al leer clientes:", resultado.error);

    cuerpoClientes.innerHTML =
      '<tr class="estado-fila"><td colspan="3"><div class="estado-vacio">' +
      '<div class="icono">⚠️</div>' +
      "<h4>No se pudo cargar el listado</h4>" +
      "<p>" +
      escapeHtml(resultado.error.message) +
      "</p>" +
      '<button type="button" data-accion="reintentar">Reintentar</button>' +
      "</div></td></tr>";
    contadorClientes.textContent = "";
    return;
  }

  clientesCache = resultado.data || [];
  renderizarClientes();
}

buscarCliente.addEventListener("input", renderizarClientes);

cuerpoClientes.addEventListener("click", function (e) {
  if (e.target.closest('[data-accion="reintentar"]')) cargarClientes();
});

// =====================================================
// REGISTRAR CLIENTE
// =====================================================

formCliente.addEventListener("submit", async function (event) {
  event.preventDefault();

  // Espacios múltiples -> uno solo
  const nombre = campoNombre.value.trim().replace(/\s+/g, " ");
  const carnet = campoCarnet.value.trim().toUpperCase().replace(/\s+/g, "");
  const celular = campoCelular.value.replace(/[\s-]/g, "");

  // Validaciones
  if (nombre.length < 3) {
    mostrarMensaje(mensajeCliente, "Ingrese el nombre completo.", "error");
    campoNombre.focus();
    return;
  }

  // Carnet boliviano: números, con complemento opcional (ej. 1234567, 1234567-1A)
  if (!/^[0-9]{5,10}(-?[0-9A-Z]{1,2})?$/.test(carnet)) {
    mostrarMensaje(
      mensajeCliente,
      "Carnet no válido. Use solo números (ej. 1234567).",
      "error",
    );
    campoCarnet.focus();
    return;
  }

  // Celular boliviano: 8 dígitos que empiezan con 6 o 7 (opcional +591)
  if (!/^(\+?591)?[67][0-9]{7}$/.test(celular)) {
    mostrarMensaje(
      mensajeCliente,
      "Celular no válido. Debe tener 8 dígitos y empezar con 6 o 7.",
      "error",
    );
    campoCelular.focus();
    return;
  }

  const boton = formCliente.querySelector('button[type="submit"]');
  boton.disabled = true;
  mostrarMensaje(mensajeCliente, "Guardando cliente...");

  try {
    // Evita registrar dos veces el mismo carnet
    const existente = await sup
      .from("clientes")
      .select(COL.nombre)
      .eq(COL.carnet, carnet)
      .maybeSingle();

    if (existente.error) throw existente.error;

    if (existente.data) {
      mostrarMensaje(
        mensajeCliente,
        "Ya existe un cliente con ese carnet: " +
          existente.data[COL.nombre] +
          ".",
        "error",
      );
      return;
    }

    const registro = {};
    registro[COL.nombre] = nombre;
    registro[COL.carnet] = carnet;
    registro[COL.celular] = celular;

    const resultado = await sup.from("clientes").insert(registro);

    if (resultado.error) throw resultado.error;

    mostrarMensaje(mensajeCliente, "Cliente registrado correctamente.", "ok");
    formCliente.reset();

    await cargarClientes();
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    mostrarMensaje(
      mensajeCliente,
      error.code === "42501"
        ? "No tiene permiso para registrar clientes. Inicie sesión."
        : "No se pudo registrar el cliente.",
      "error",
    );
  } finally {
    boton.disabled = false;
  }
});

// =====================================================
// INICIAR
// =====================================================

cargarClientes();
