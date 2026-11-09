/* =====================================================
   JBC COMERCIAL — COTIZACIONES / PROFORMAS
   Permite a vendedores y administrador armar una cotización para
   un cliente o empresa, guardarla, verla como proforma e imprimirla.
   Una cotización NO descuenta existencia ni es una venta.
   Los precios los toma la base de datos (registrar_cotizacion);
   un vendedor ve solo sus cotizaciones y el administrador todas
   (RLS en sql/cotizaciones.sql).
   Requiere `sup`, utilidades.js, carrito.js (descuento) y factura.js
===================================================== */

const LIMITE_COTIZACIONES = 100;
const ESTADOS_COTIZACION = ["pendiente", "aceptada", "rechazada"];

const cotForm = document.querySelector("#form-cotizacion");
const cotBuscar = document.querySelector("#cot-buscar");
const cotResultados = document.querySelector("#cot-resultados");
const cotLista = document.querySelector("#cot-lista");
const cotTotal = document.querySelector("#cot-total");
const cotMensaje = document.querySelector("#mensaje-cotizacion");
const cotGuardar = document.querySelector("#cot-guardar");
const cotDescValor = document.querySelector("#cot-descuento-valor");
const cotDescTipo = document.querySelector("#cot-descuento-tipo");
const cotDescResumen = document.querySelector("#cot-descuento-resumen");

const cuerpoCotizaciones = document.querySelector("#cuerpo-cotizaciones");
const mensajeCotizaciones = document.querySelector("#mensaje-cotizaciones");
const panelProforma = document.querySelector("#proforma-panel");
const contenidoProforma = document.querySelector("#proforma-contenido");
const mensajeProforma = document.querySelector("#mensaje-proforma");
const selectEstado = document.querySelector("#proforma-estado");

let cotItems = []; // { id, nombre, marca, precio, cantidad }
let cotBusquedaId = 0; // descarta respuestas viejas del buscador
let cotTemporizador = null;
let proformaPeticion = 0;
let proformaActual = null;

// =====================================================
// PRODUCTOS DE LA COTIZACIÓN
// =====================================================

function cotSubtotal() {
  return cotItems.reduce(function (s, i) {
    return s + i.precio * i.cantidad;
  }, 0);
}

function cotActualizarTotales() {
  return pintarTotalesConDescuento(cotSubtotal(), {
    valor: cotDescValor,
    tipo: cotDescTipo,
    resumen: cotDescResumen,
    total: cotTotal,
  });
}

cotDescValor.addEventListener("input", cotActualizarTotales);
cotDescTipo.addEventListener("change", cotActualizarTotales);

function cotPintarLista() {
  if (cotItems.length === 0) {
    cotLista.innerHTML =
      '<p class="lista-vacia">Busque un producto y añádalo a la cotización.</p>';
  } else {
    cotLista.innerHTML = cotItems
      .map(function (i) {
        return (
          '<div class="producto-venta" data-fila="' +
          escapeHtml(i.id) +
          '">' +
          '<div class="producto-venta-info"><strong>' +
          escapeHtml(i.nombre) +
          "</strong>" +
          "<span>" +
          (i.marca ? escapeHtml(i.marca) + " · " : "") +
          formatearBs(i.precio) +
          " c/u</span></div>" +
          '<div class="cantidad-control">' +
          '<button type="button" class="btn-cant" data-id="' +
          escapeHtml(i.id) +
          '" data-cambio="-1" aria-label="Menos">−</button>' +
          "<span>" +
          escapeHtml(i.cantidad) +
          "</span>" +
          '<button type="button" class="btn-cant" data-id="' +
          escapeHtml(i.id) +
          '" data-cambio="1" aria-label="Más">+</button>' +
          "</div>" +
          '<strong class="producto-venta-subtotal">' +
          formatearBs(i.precio * i.cantidad) +
          "</strong>" +
          '<button type="button" class="btn-quitar" data-id="' +
          escapeHtml(i.id) +
          '" aria-label="Quitar">✕</button>' +
          "</div>"
        );
      })
      .join("");
  }

  cotActualizarTotales();
  cotGuardar.disabled = cotItems.length === 0;
}

function cotAgregar(producto) {
  const existente = cotItems.find(function (i) {
    return String(i.id) === String(producto.id_productos);
  });

  if (existente) {
    existente.cantidad += 1;
  } else {
    cotItems.push({
      id: producto.id_productos,
      nombre: producto.nombre,
      marca: producto.marca || "",
      precio: Number(producto.precio) || 0,
      cantidad: 1,
    });
  }

  cotPintarLista();
}

cotLista.addEventListener("click", function (e) {
  const mas = e.target.closest(".btn-cant");
  const quitar = e.target.closest(".btn-quitar");
  const id = (mas || quitar) && (mas || quitar).dataset.id;

  if (!id) return;

  const pos = cotItems.findIndex(function (i) {
    return String(i.id) === id;
  });

  if (pos < 0) return;

  if (quitar) {
    cotItems.splice(pos, 1);
  } else {
    cotItems[pos].cantidad += Number(mas.dataset.cambio);
    if (cotItems[pos].cantidad < 1) cotItems.splice(pos, 1);
  }

  cotPintarLista();
});

// =====================================================
// BUSCADOR DE PRODUCTOS (en la base, por nombre o marca)
// =====================================================

let cotEncontrados = [];

async function cotBuscarProductos() {
  // se quitan los símbolos que tienen significado en el filtro .or()
  const texto = cotBuscar.value.replace(/[,()*%\\]/g, " ").trim();
  const id = ++cotBusquedaId;

  if (texto.length < 2) {
    cotResultados.hidden = true;
    cotResultados.innerHTML = "";
    return;
  }

  const r = await sup
    .from("productos")
    .select("id_productos, nombre, marca, precio, existencia")
    .eq("activo", true)
    .or("nombre.ilike.%" + texto + "%,marca.ilike.%" + texto + "%")
    .order("nombre", { ascending: true })
    .limit(12);

  if (id !== cotBusquedaId) return;

  cotResultados.hidden = false;

  if (r.error) {
    console.error("Error al buscar productos:", r.error);
    cotResultados.innerHTML =
      '<p class="lista-vacia">No se pudo buscar. Revise su conexión.</p>';
    return;
  }

  cotEncontrados = r.data || [];

  cotResultados.innerHTML = cotEncontrados.length
    ? cotEncontrados
        .map(function (p, n) {
          return (
            '<button type="button" class="cot-resultado" data-n="' +
            n +
            '">' +
            "<span><strong>" +
            escapeHtml(p.nombre) +
            "</strong>" +
            (p.marca ? " · " + escapeHtml(p.marca) : "") +
            "</span>" +
            "<span>" +
            formatearBs(p.precio) +
            "</span></button>"
          );
        })
        .join("")
    : '<p class="lista-vacia">Sin resultados para «' +
      escapeHtml(texto) +
      "».</p>";
}

cotBuscar.addEventListener("input", function () {
  clearTimeout(cotTemporizador);
  cotTemporizador = setTimeout(cotBuscarProductos, 250);
});

// Enter en el buscador no debe enviar el formulario
cotBuscar.addEventListener("keydown", function (e) {
  if (e.key === "Enter") e.preventDefault();
});

cotResultados.addEventListener("click", function (e) {
  const b = e.target.closest(".cot-resultado");

  if (!b) return;

  const producto = cotEncontrados[Number(b.dataset.n)];

  if (producto) cotAgregar(producto);
});

// =====================================================
// GUARDAR
// =====================================================

function cotLimpiar() {
  cotForm.reset();
  cotItems = [];
  cotDescValor.value = "";
  cotDescTipo.value = "monto";
  cotResultados.hidden = true;
  cotResultados.innerHTML = "";
  cotPintarLista();
}

document.querySelector("#cot-limpiar").addEventListener("click", function () {
  cotLimpiar();
  mostrarMensaje(cotMensaje, "");
});

cotForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const cliente = document.querySelector("#cot-cliente").value.trim();

  if (!cliente) {
    mostrarMensaje(
      cotMensaje,
      "Escriba el nombre del cliente o empresa.",
      "error",
    );
    return;
  }

  if (cotItems.length === 0) {
    mostrarMensaje(cotMensaje, "Añada al menos un producto.", "error");
    return;
  }

  const validez = Number(document.querySelector("#cot-validez").value);

  if (!Number.isInteger(validez) || validez < 1 || validez > 365) {
    mostrarMensaje(
      cotMensaje,
      "La validez debe estar entre 1 y 365 días.",
      "error",
    );
    return;
  }

  const descuento = cotActualizarTotales();

  if (descuento.error) {
    mostrarMensaje(cotMensaje, descuento.error, "error");
    return;
  }

  cotGuardar.disabled = true;
  mostrarMensaje(cotMensaje, "Guardando cotización...");

  try {
    const r = await sup.rpc(
      "registrar_cotizacion",
      Object.assign(
        {
          p_cliente_nombre: cliente,
          p_cliente_documento:
            document.querySelector("#cot-documento").value.trim() || null,
          p_cliente_contacto:
            document.querySelector("#cot-contacto").value.trim() || null,
          p_validez_dias: validez,
          p_observaciones:
            document.querySelector("#cot-observaciones").value.trim() || null,
          p_items: cotItems.map(function (i) {
            return { id_productos: i.id, cantidad: i.cantidad };
          }),
        },
        parametrosDescuento(descuento, cotDescTipo.value),
      ),
    );

    if (r.error) {
      console.error("Error al guardar la cotización:", r.error);
      mostrarMensaje(
        cotMensaje,
        r.error.code === "PGRST202"
          ? "Falta crear las funciones de cotizaciones en Supabase (sql/cotizaciones.sql)."
          : r.error.message || "No se pudo guardar la cotización.",
        "error",
      );
      cotGuardar.disabled = false;
      return;
    }

    cotLimpiar();
    mostrarMensaje(cotMensaje, "Cotización N.º " + r.data + " guardada.", "ok");
    abrirProforma(r.data);
    cargarCotizaciones(await esAdminActual());
  } catch (error) {
    console.error("Error de red al guardar la cotización:", error);
    mostrarMensaje(
      cotMensaje,
      "No se pudo guardar. Revise su conexión.",
      "error",
    );
    cotGuardar.disabled = cotItems.length === 0;
  }
});

// =====================================================
// PROFORMA (vista e impresión)
// =====================================================

async function obtenerCotizacion(id) {
  const r = await sup.rpc("obtener_cotizacion", { p_cotizacion: Number(id) });

  if (r.error) throw r.error;

  const filas = r.data || [];

  if (filas.length === 0) return null; // no existe o no tiene permiso

  const c = filas[0];

  return {
    id: c.id_cotizaciones,
    fecha: c.created_at,
    validez: Number(c.validez_dias),
    estado: c.estado,
    cliente: c.cliente_nombre,
    documento: c.cliente_documento || "",
    contacto: c.cliente_contacto || "",
    observaciones: c.observaciones || "",
    descuento: Number(c.descuento) || 0,
    total: Number(c.total),
    vendedor: c.vendedor || "—",
    items: filas
      .filter(function (f) {
        return f.producto !== null && f.producto !== undefined;
      })
      .map(function (f) {
        return {
          producto: f.producto,
          marca: f.marca || "",
          cantidad: Number(f.cantidad),
          precio: Number(f.precio_unitario),
          subtotal: Number(f.subtotal),
        };
      }),
  };
}

// "válida hasta" en hora de Bolivia
function fechaValidez(fecha, dias) {
  const f = new Date(new Date(fecha).getTime() + dias * 86400000);

  return f.toLocaleDateString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function htmlProforma(c) {
  const filas = c.items
    .map(function (i) {
      return (
        "<tr><td>" +
        escapeHtml(i.producto) +
        (i.marca
          ? '<span class="prod-codigo">' + escapeHtml(i.marca) + "</span>"
          : "") +
        "</td>" +
        '<td class="num">' +
        escapeHtml(i.cantidad) +
        "</td>" +
        '<td class="num">' +
        formatearBs(i.precio) +
        "</td>" +
        '<td class="num">' +
        formatearBs(i.subtotal) +
        "</td></tr>"
      );
    })
    .join("");

  return (
    '<article class="factura">' +
    '<header class="factura-cabecera">' +
    '<div><strong class="factura-marca">JBC Comercial</strong>' +
    "<span>Equipos de audio y tecnología</span></div>" +
    '<div class="factura-numero"><span>Proforma / Cotización</span><strong>N.º ' +
    escapeHtml(c.id) +
    "</strong></div></header>" +
    '<dl class="factura-datos">' +
    "<div><dt>Fecha</dt><dd>" +
    escapeHtml(fechaHoraFactura(c.fecha)) +
    "</dd></div>" +
    "<div><dt>Válida hasta</dt><dd>" +
    escapeHtml(fechaValidez(c.fecha, c.validez)) +
    " (" +
    escapeHtml(c.validez) +
    " días)</dd></div>" +
    "<div><dt>Cliente / Empresa</dt><dd>" +
    escapeHtml(c.cliente) +
    "</dd></div>" +
    "<div><dt>NIT / CI</dt><dd>" +
    escapeHtml(c.documento || "—") +
    "</dd></div>" +
    "<div><dt>Contacto</dt><dd>" +
    escapeHtml(c.contacto || "—") +
    "</dd></div>" +
    "<div><dt>Atendido por</dt><dd>" +
    escapeHtml(c.vendedor) +
    "</dd></div>" +
    "</dl>" +
    '<div class="tabla-contenedor"><table class="factura-tabla">' +
    '<thead><tr><th>Producto</th><th class="num">Cant.</th>' +
    '<th class="num">P. unitario</th><th class="num">Subtotal</th></tr></thead>' +
    "<tbody>" +
    filas +
    "</tbody></table></div>" +
    (c.descuento > 0
      ? '<dl class="factura-subtotales">' +
        "<div><dt>Subtotal</dt><dd>" +
        formatearBs(c.total + c.descuento) +
        "</dd></div>" +
        "<div><dt>Descuento</dt><dd>− " +
        formatearBs(c.descuento) +
        "</dd></div></dl>"
      : "") +
    '<div class="factura-total"><span>TOTAL</span><strong>' +
    formatearBs(c.total) +
    "</strong></div>" +
    (c.observaciones
      ? '<p class="proforma-obs"><strong>Observaciones:</strong> ' +
        escapeHtml(c.observaciones) +
        "</p>"
      : "") +
    '<p class="proforma-nota">Esta proforma es una cotización y no constituye una factura ni una reserva de productos. ' +
    "Precios en bolivianos (Bs), sujetos a disponibilidad de stock.</p>" +
    "</article>"
  );
}

async function abrirProforma(id) {
  const n = ++proformaPeticion;

  panelProforma.hidden = false;
  mostrarMensaje(mensajeProforma, "");
  contenidoProforma.innerHTML = '<p class="lista-vacia">Cargando proforma…</p>';

  try {
    const c = await obtenerCotizacion(id);

    if (n !== proformaPeticion) return;

    if (!c) {
      contenidoProforma.innerHTML = "";
      proformaActual = null;
      mostrarMensaje(
        mensajeProforma,
        "No se encontró la cotización N.º " +
          id +
          " o no tiene permiso para verla.",
        "error",
      );
      return;
    }

    proformaActual = c;
    contenidoProforma.innerHTML = htmlProforma(c);
    selectEstado.value = c.estado;
    panelProforma.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (n !== proformaPeticion) return;

    console.error("Error al leer la cotización:", error);
    contenidoProforma.innerHTML = "";
    mostrarMensaje(
      mensajeProforma,
      error && error.code === "PGRST202"
        ? "Falta crear las funciones de cotizaciones en Supabase (sql/cotizaciones.sql)."
        : "No se pudo cargar la cotización. Revise su conexión.",
      "error",
    );
  }
}

function cerrarProforma() {
  proformaPeticion++;
  panelProforma.hidden = true;
  contenidoProforma.innerHTML = "";
  proformaActual = null;

  try {
    history.replaceState(null, "", window.location.pathname);
  } catch (e) {
    /* sin historial: no importa */
  }
}

document
  .querySelector("#btn-cerrar-proforma")
  .addEventListener("click", cerrarProforma);

document
  .querySelector("#btn-imprimir-proforma")
  .addEventListener("click", function () {
    if (!proformaActual) return;

    const estilo = document.createElement("style");
    estilo.textContent = "@page { margin: 12mm; }";
    document.head.appendChild(estilo);

    function limpiar() {
      estilo.remove();
      window.removeEventListener("afterprint", limpiar);
    }

    window.addEventListener("afterprint", limpiar);
    window.print();
  });

selectEstado.addEventListener("change", async function () {
  if (!proformaActual) return;

  const nuevo = selectEstado.value;
  const id = proformaActual.id;

  const r = await sup.rpc("cambiar_estado_cotizacion", {
    p_cotizacion: id,
    p_estado: nuevo,
  });

  if (r.error) {
    console.error("Error al cambiar el estado:", r.error);
    selectEstado.value = proformaActual.estado;
    mostrarMensaje(
      mensajeProforma,
      r.error.message || "No se pudo cambiar el estado.",
      "error",
    );
    return;
  }

  proformaActual.estado = nuevo;
  mostrarMensaje(mensajeProforma, "Estado actualizado: " + nuevo + ".", "ok");
  cargarCotizaciones(await esAdminActual());
});

// =====================================================
// LISTA DE COTIZACIONES
// =====================================================

let adminCache = null;

async function esAdminActual() {
  if (adminCache === null)
    adminCache = esAdministrador(await obtenerPerfilActual());
  return adminCache;
}

function filaVaciaCotizaciones(texto) {
  cuerpoCotizaciones.innerHTML =
    '<tr class="estado-fila"><td colspan="7"><div class="estado-vacio"><div class="icono">📋</div><h4>' +
    escapeHtml(texto) +
    "</h4></div></td></tr>";
}

async function cargarCotizaciones(admin) {
  const r = await sup
    .from("cotizaciones")
    .select(
      "id_cotizaciones, created_at, id_usuarios, cliente_nombre, total, estado, validez_dias",
    )
    .order("created_at", { ascending: false })
    .order("id_cotizaciones", { ascending: false })
    .limit(LIMITE_COTIZACIONES);

  if (r.error) {
    console.error("Error al leer las cotizaciones:", r.error);
    filaVaciaCotizaciones(
      r.error.code === "42P01" || r.error.code === "PGRST205"
        ? "Falta crear las tablas (sql/cotizaciones.sql)"
        : "No se pudieron cargar las cotizaciones",
    );
    return;
  }

  const lista = r.data || [];

  document.querySelector("#cotizaciones-subtitulo").textContent = admin
    ? "Las últimas " +
      LIMITE_COTIZACIONES +
      " cotizaciones de todos los vendedores"
    : "Sus últimas " + LIMITE_COTIZACIONES + " cotizaciones";

  if (lista.length === 0) {
    filaVaciaCotizaciones("Aún no hay cotizaciones");
    return;
  }

  const ru = await sup.from("usuarios").select("id_usuarios, nombres");
  const usuarios = new Map();

  (ru.data || []).forEach(function (u) {
    usuarios.set(String(u.id_usuarios), u.nombres);
  });

  cuerpoCotizaciones.innerHTML = lista
    .map(function (c) {
      return (
        '<tr class="fila-dato">' +
        "<td>N.º " +
        escapeHtml(c.id_cotizaciones) +
        "</td>" +
        "<td>" +
        escapeHtml(fechaHoraFactura(c.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(c.cliente_nombre) +
        "</td>" +
        "<td>" +
        escapeHtml(
          usuarios.get(String(c.id_usuarios)) || "Usuario " + c.id_usuarios,
        ) +
        "</td>" +
        '<td><span class="estado-cot estado-' +
        escapeHtml(c.estado) +
        '">' +
        escapeHtml(c.estado) +
        "</span></td>" +
        '<td class="num"><strong>' +
        formatearBs(c.total) +
        "</strong></td>" +
        '<td class="acciones"><button type="button" class="btn-tabla" data-cot="' +
        escapeHtml(c.id_cotizaciones) +
        '">Ver proforma</button></td></tr>'
      );
    })
    .join("");
}

cuerpoCotizaciones.addEventListener("click", function (e) {
  const b = e.target.closest("[data-cot]");

  if (!b) return;

  try {
    history.replaceState(
      null,
      "",
      "?cotizacion=" + encodeURIComponent(b.dataset.cot),
    );
  } catch (err) {
    /* sin historial: no importa */
  }

  abrirProforma(b.dataset.cot);
});

// =====================================================
// INICIAR
// =====================================================

async function iniciarCotizaciones() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) return; // el visitante solo ve el aviso de iniciar sesión

  cotPintarLista();

  const idUrl = new URLSearchParams(window.location.search).get("cotizacion");

  if (idUrl && /^[0-9]+$/.test(idUrl)) abrirProforma(idUrl);

  await cargarCotizaciones(esAdministrador(perfil));
}

iniciarCotizaciones();
