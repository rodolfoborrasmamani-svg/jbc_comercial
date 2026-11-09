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

// Nombre de la clave primaria de clientes (se detecta una sola vez, leyendo
// una fila: así no se hacen consultas con columnas que no existen)
const CLAVES_CLIENTE = ["id_cliente", "id_clientes", "id"];
let claveClientes = null;

// Busca un cliente por su id (la clave primaria puede llamarse distinto)
async function buscarClientePorId(id) {
  if (!claveClientes) {
    const muestra = await sup.from("clientes").select("*").limit(1);

    if (muestra.error || !muestra.data || muestra.data.length === 0)
      return null;

    claveClientes = CLAVES_CLIENTE.find(function (c) {
      return c in muestra.data[0];
    });

    if (!claveClientes) return null;
  }

  const r = await sup
    .from("clientes")
    .select("*")
    .eq(claveClientes, id)
    .maybeSingle();

  return r.error ? null : r.data;
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
    descuento: Number(cab.descuento) || 0, // 0 en ventas sin descuento
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

  // total cobrado + descuento debe ser igual a la suma de los productos
  const descuadre = Math.round((f.total + f.descuento) * 100) !== suma;

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
    (f.descuento > 0
      ? '<dl class="factura-subtotales">' +
        "<div><dt>Subtotal</dt><dd>" +
        formatearBs(f.total + f.descuento) +
        "</dd></div>" +
        "<div><dt>Descuento</dt><dd>− " +
        formatearBs(f.descuento) +
        "</dd></div>" +
        "</dl>"
      : "") +
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

// =====================================================
// TICKET PARA IMPRESORA TÉRMICA (papel de 58 mm)
// Texto en una sola columna: el nombre del producto ocupa toda la
// línea y debajo van «cantidad x precio» y el subtotal.
// =====================================================
function htmlTicket(f) {
  const linea = '<div class="tk-sep"></div>';

  const filas = f.items.length
    ? f.items
        .map(function (i) {
          return (
            '<div class="tk-prod">' +
            escapeHtml(i.producto) +
            "</div>" +
            '<div class="tk-fila"><span>' +
            escapeHtml(i.cantidad) +
            " x " +
            numeroBs(i.precio) +
            "</span><span>" +
            numeroBs(i.subtotal) +
            "</span></div>"
          );
        })
        .join("")
    : '<div class="tk-centro">(sin productos)</div>';

  return (
    '<div class="tk-centro tk-titulo">JBC COMERCIAL</div>' +
    '<div class="tk-centro">Equipos de audio y tecnologia</div>' +
    linea +
    '<div class="tk-fila"><span>Venta N.º ' +
    escapeHtml(f.id) +
    "</span></div>" +
    "<div>" +
    escapeHtml(fechaHoraFactura(f.fecha)) +
    "</div>" +
    "<div>Vendedor: " +
    escapeHtml(f.vendedor) +
    "</div>" +
    "<div>Cliente: " +
    escapeHtml(f.cliente) +
    "</div>" +
    (f.carnet ? "<div>CI/NIT: " + escapeHtml(f.carnet) + "</div>" : "") +
    linea +
    filas +
    linea +
    (f.descuento > 0
      ? '<div class="tk-fila"><span>Subtotal</span><span>' +
        numeroBs(f.total + f.descuento) +
        "</span></div>" +
        '<div class="tk-fila"><span>Descuento</span><span>-' +
        numeroBs(f.descuento) +
        "</span></div>"
      : "") +
    '<div class="tk-fila tk-total"><span>TOTAL Bs</span><span>' +
    numeroBs(f.total) +
    "</span></div>" +
    linea +
    '<div class="tk-centro">Gracias por su compra</div>'
  );
}
