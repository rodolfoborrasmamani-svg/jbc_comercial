/* =====================================================
   JBC COMERCIAL — FACTURACIÓN
   Lista las ventas realizadas y muestra la factura de cada una.
   Un vendedor ve solo sus ventas; el administrador ve todas
   (lo decide la base de datos con RLS y la función factura_venta).
   Después de confirmar una venta se llega aquí con ?venta=N.
   Requiere `sup`, utilidades.js y factura.js
===================================================== */

const LIMITE_FACTURAS = 100;

const cuerpoFacturas = document.querySelector("#cuerpo-facturas");
const mensajeFacturas = document.querySelector("#mensaje-facturas");
const mensajeFactura = document.querySelector("#mensaje-factura");
const panelFactura = document.querySelector("#factura-panel");
const contenidoFactura = document.querySelector("#factura-contenido");
const subtituloFactura = document.querySelector("#factura-subtitulo");
const subtituloLista = document.querySelector("#facturas-subtitulo");

let facturaPeticion = 0; // descarta respuestas viejas si se abren varias seguidas

// =====================================================
// FACTURA SELECCIONADA
// =====================================================

async function mostrarFactura(idVenta, opciones) {
  const id = ++facturaPeticion;

  panelFactura.hidden = false;
  mostrarMensaje(mensajeFactura, "");
  subtituloFactura.textContent = "Venta N.º " + idVenta;
  contenidoFactura.innerHTML = '<p class="lista-vacia">Cargando factura…</p>';

  try {
    const factura = await obtenerFactura(idVenta);

    if (id !== facturaPeticion) return;

    if (!factura) {
      contenidoFactura.innerHTML = "";
      mostrarMensaje(
        mensajeFactura,
        "No se encontró la venta N.º " +
          idVenta +
          " o no tiene permiso para verla.",
        "error",
      );
      return;
    }

    contenidoFactura.innerHTML = htmlFactura(factura);

    if (opciones && opciones.nueva) {
      mostrarMensaje(mensajeFactura, "Venta registrada correctamente.", "ok");
    }

    panelFactura.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (id !== facturaPeticion) return;

    console.error("Error al leer la factura:", error);
    contenidoFactura.innerHTML = "";
    mostrarMensaje(
      mensajeFactura,
      error && error.code === "PGRST202"
        ? "Falta crear la función factura_venta en Supabase (sql/facturacion.sql)."
        : "No se pudo cargar la factura. Revise su conexión.",
      "error",
    );
  }
}

function cerrarFactura() {
  facturaPeticion++;
  panelFactura.hidden = true;
  contenidoFactura.innerHTML = "";

  // Quita ?venta=N de la dirección sin recargar
  try {
    history.replaceState(null, "", window.location.pathname);
  } catch (e) {
    /* sin historial: no importa */
  }
}

function abrirDesdeLista(idVenta) {
  try {
    history.replaceState(null, "", "?venta=" + encodeURIComponent(idVenta));
  } catch (e) {
    /* sin historial: no importa */
  }

  mostrarFactura(idVenta);
}

document
  .querySelector("#btn-cerrar-factura")
  .addEventListener("click", cerrarFactura);
document.querySelector("#btn-imprimir").addEventListener("click", function () {
  window.print();
});

// =====================================================
// LISTA DE VENTAS
// =====================================================

function pintarFilaVacia(texto) {
  cuerpoFacturas.innerHTML =
    '<tr class="estado-fila"><td colspan="6"><div class="estado-vacio"><div class="icono">🧾</div><h4>' +
    escapeHtml(texto) +
    "</h4></div></td></tr>";
}

async function cargarListaFacturas(admin) {
  pintarFilaVacia("Cargando ventas…");

  // El orden por id desempata ventas registradas en el mismo instante
  const r = await sup
    .from("ventas")
    .select("id_ventas, created_at, id_usuarios, id_cliente, total")
    .order("created_at", { ascending: false })
    .order("id_ventas", { ascending: false })
    .limit(LIMITE_FACTURAS);

  if (r.error) {
    console.error("Error al leer las ventas:", r.error);
    pintarFilaVacia("No se pudieron cargar las ventas");
    return;
  }

  const ventas = r.data || [];

  if (ventas.length === 0) {
    pintarFilaVacia("Aún no hay ventas registradas");
    return;
  }

  // Nombres de clientes y vendedores
  const [rc, ru] = await Promise.all([
    sup.from("clientes").select("*"),
    sup.from("usuarios").select("id_usuarios, nombres"),
  ]);

  const clientes = new Map();
  const usuarios = new Map();

  (rc.data || []).forEach(function (c) {
    clientes.set(String(c.id_cliente ?? c.id_clientes ?? c.id), c.nombres);
  });

  (ru.data || []).forEach(function (u) {
    usuarios.set(String(u.id_usuarios), u.nombres);
  });

  subtituloLista.textContent = admin
    ? "Las últimas " + LIMITE_FACTURAS + " ventas de todos los vendedores"
    : "Sus últimas " + LIMITE_FACTURAS + " ventas";

  cuerpoFacturas.innerHTML = ventas
    .map(function (v) {
      return (
        '<tr class="fila-dato">' +
        "<td>N.º " +
        escapeHtml(v.id_ventas) +
        "</td>" +
        "<td>" +
        escapeHtml(fechaHoraFactura(v.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(
          usuarios.get(String(v.id_usuarios)) || "Usuario " + v.id_usuarios,
        ) +
        "</td>" +
        "<td>" +
        escapeHtml(
          clientes.get(String(v.id_cliente)) || "Cliente " + v.id_cliente,
        ) +
        "</td>" +
        '<td class="num"><strong>' +
        formatearBs(v.total) +
        "</strong></td>" +
        '<td class="acciones"><button type="button" class="btn-tabla" data-venta="' +
        escapeHtml(v.id_ventas) +
        '">Ver factura</button></td>' +
        "</tr>"
      );
    })
    .join("");
}

cuerpoFacturas.addEventListener("click", function (e) {
  const boton = e.target.closest("[data-venta]");
  if (boton) abrirDesdeLista(boton.dataset.venta);
});

// =====================================================
// INICIAR
// =====================================================

async function iniciarFacturacion() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) return; // el visitante solo ve el aviso de iniciar sesión

  const params = new URLSearchParams(window.location.search);
  const idUrl = params.get("venta");

  if (idUrl && /^[0-9]+$/.test(idUrl)) {
    // nueva=1 lo agrega la página que acaba de registrar la venta
    mostrarFactura(idUrl, { nueva: params.get("nueva") === "1" });
  }

  await cargarListaFacturas(esAdministrador(perfil));
}

iniciarFacturacion();
