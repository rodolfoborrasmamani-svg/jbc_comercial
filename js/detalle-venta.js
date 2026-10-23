/* =====================================================
   JBC COMERCIAL — DETALLE DE UNA VENTA (solo administrador)
   Al hacer clic en una fila del resumen de ventas se abre una
   ventana con los productos de esa venta.
   Requiere resumen.js (resCuerpo, resEsAdmin) y factura.js.
   La seguridad real está en la función SQL factura_venta.
===================================================== */

const modalDetalle = document.querySelector("#modal-detalle-venta");
const contenidoDetalle = document.querySelector("#contenido-detalle-venta");
const enlaceFactura = document.querySelector("#enlace-factura");

let detallePeticion = 0; // descarta respuestas viejas si se abren varias seguidas

function cerrarDetalle() {
  modalDetalle.hidden = true;
  document.body.classList.remove("modal-abierto");
  detallePeticion++;
}

async function abrirDetalle(idVenta) {
  const id = ++detallePeticion;

  enlaceFactura.href = "facturacion.html?venta=" + encodeURIComponent(idVenta);
  contenidoDetalle.innerHTML = '<p class="lista-vacia">Cargando detalle…</p>';
  modalDetalle.hidden = false;
  document.body.classList.add("modal-abierto");

  try {
    const factura = await obtenerFactura(idVenta);

    if (id !== detallePeticion) return;

    contenidoDetalle.innerHTML = factura
      ? htmlFactura(factura)
      : '<p class="mensaje-formulario error">No se encontró la venta o no tiene permiso para verla.</p>';
  } catch (error) {
    if (id !== detallePeticion) return;

    console.error("Error al leer el detalle de la venta:", error);

    contenidoDetalle.innerHTML =
      error && error.code === "PGRST202"
        ? '<p class="mensaje-formulario error">Falta crear la función factura_venta en Supabase (sql/facturacion.sql).</p>'
        : '<p class="mensaje-formulario error">No se pudo cargar el detalle. Revise su conexión.</p>';
  }
}

resCuerpo.addEventListener("click", function (e) {
  if (!resEsAdmin) return;

  const fila = e.target.closest("tr[data-venta]");
  if (fila) abrirDetalle(fila.dataset.venta);
});

// Con teclado: Enter o espacio sobre la fila
resCuerpo.addEventListener("keydown", function (e) {
  if (!resEsAdmin || (e.key !== "Enter" && e.key !== " ")) return;

  const fila = e.target.closest("tr[data-venta]");

  if (fila) {
    e.preventDefault();
    abrirDetalle(fila.dataset.venta);
  }
});

document
  .querySelector("#btn-cerrar-detalle")
  .addEventListener("click", cerrarDetalle);

modalDetalle.addEventListener("click", function (e) {
  if (e.target === modalDetalle) cerrarDetalle();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !modalDetalle.hidden) cerrarDetalle();
});
