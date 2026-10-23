/* =====================================================
   JBC COMERCIAL — FACTURA / DETALLE DE UNA VENTA
   Obtiene una venta con sus productos (función SQL factura_venta)
   y arma el HTML de la factura. Lo usan Facturación y el detalle
   que abre el administrador en el resumen de ventas.
   Requiere `sup`, utilidades.js y sql/facturacion.sql
===================================================== */

// "2026-10-23T19:53:00+00:00" -> "23/10/2026 03:53 p. m." (hora de Bolivia)
function fechaHoraFactura(valor) {
  const f = new Date(valor);

  if (Number.isNaN(f.getTime())) return "";

  return f.toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Busca un cliente por su id (la clave primaria puede llamarse distinto)
async function buscarClientePorId(id) {
  for (const col of ["id_cliente", "id_clientes", "id"]) {
    const r = await sup.from("clientes").select("*").eq(col, id).maybeSingle();

    if (r.error && r.error.code === "42703") continue; // esa columna no existe
    if (r.error) return null;

    return r.data;
  }

  return null;
}

// Devuelve { id, fecha, total, vendedor, cliente, carnet, items[] } o null
async function obtenerFactura(idVenta) {
  const r = await sup.rpc("factura_venta", { p_venta: Number(idVenta) });

  if (r.error) throw r.error;

  const filas = r.data || [];

  if (filas.length === 0) return null; // no existe o no tiene permiso

  const cab = filas[0];
  const cliente = await buscarClientePorId(cab.id_cliente);

  const items = filas
    .filter(function (f) {
      return f.id_productos !== null && f.id_productos !== undefined;
    })
    .map(function (f) {
      return {
        codigo: f.id_productos,
        producto: f.producto || "Producto " + f.id_productos,
        marca: f.marca || "",
        cantidad: Number(f.cantidad),
        precio: Number(f.precio_unitario),
        subtotal: Number(f.subtotal),
      };
    });

  return {
    id: cab.id_ventas,
    fecha: cab.created_at,
    total: Number(cab.total),
    vendedor: cab.vendedor || "—",
    cliente: cliente ? cliente.nombres : "Cliente " + cab.id_cliente,
    carnet: cliente && cliente.carnet ? cliente.carnet : "",
    items: items,
  };
}

// HTML de la factura (todo el texto se escapa una sola vez, aquí)
function htmlFactura(f) {
  const suma = f.items.reduce(function (s, i) {
    return s + Math.round(i.subtotal * 100);
  }, 0);

  const descuadre = Math.round(f.total * 100) !== suma;

  const filas = f.items.length
    ? f.items
        .map(function (i) {
          return (
            "<tr>" +
            "<td>" +
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
            "</td>" +
            "</tr>"
          );
        })
        .join("")
    : '<tr><td colspan="4" class="lista-vacia">Esta venta no tiene productos registrados.</td></tr>';

  return (
    '<article class="factura">' +
    '<header class="factura-cabecera">' +
    '<div><strong class="factura-marca">JBC Comercial</strong>' +
    "<span>Equipos de audio y tecnología</span></div>" +
    '<div class="factura-numero"><span>Venta</span><strong>N.º ' +
    escapeHtml(f.id) +
    "</strong></div>" +
    "</header>" +
    '<dl class="factura-datos">' +
    "<div><dt>Fecha</dt><dd>" +
    escapeHtml(fechaHoraFactura(f.fecha)) +
    "</dd></div>" +
    "<div><dt>Vendedor</dt><dd>" +
    escapeHtml(f.vendedor) +
    "</dd></div>" +
    "<div><dt>Cliente</dt><dd>" +
    escapeHtml(f.cliente) +
    "</dd></div>" +
    "<div><dt>CI / NIT</dt><dd>" +
    escapeHtml(f.carnet || "—") +
    "</dd></div>" +
    "</dl>" +
    '<div class="tabla-contenedor"><table class="factura-tabla">' +
    "<thead><tr><th>Producto</th>" +
    '<th class="num">Cant.</th><th class="num">P. unitario</th>' +
    '<th class="num">Subtotal</th></tr></thead>' +
    "<tbody>" +
    filas +
    "</tbody></table></div>" +
    '<div class="factura-total"><span>TOTAL</span><strong>' +
    formatearBs(f.total) +
    "</strong></div>" +
    (descuadre
      ? '<p class="mensaje-formulario error">Atención: el total de la venta no coincide con la suma de su detalle (' +
        formatearBs(suma / 100) +
        ").</p>"
      : "") +
    "</article>"
  );
}
