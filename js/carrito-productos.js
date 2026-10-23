/* =====================================================
   JBC COMERCIAL — CARRITO EN LA PÁGINA PRODUCTOS
   Botón «+ Añadir» en cada producto, carrito flotante y ventana para
   elegir el cliente y CONFIRMAR la venta sin salir de Productos.
   Al confirmar abre la factura de la venta.
   Requiere productos.js (estado), carrito.js y utilidades.js
===================================================== */

const cpFlotante = document.querySelector("#carrito-flotante");
const cpModal = document.querySelector("#modal-carrito");
const cpForm = document.querySelector("#form-carrito");
const cpLista = document.querySelector("#carrito-lista");
const cpTotal = document.querySelector("#carrito-total");
const cpCliente = document.querySelector("#carrito-cliente");
const cpMensaje = document.querySelector("#mensaje-carrito");
const cpConfirmar = document.querySelector("#carrito-confirmar");

let cpItems = leerCarrito();
let cpClientesCargados = false;

function cpTotalBs() {
  return cpItems.reduce(function (s, i) {
    return s + i.precio * i.cantidad;
  }, 0);
}

function cpGuardarYPintar() {
  guardarCarrito(cpItems);
  cpPintarFlotante();
  if (!cpModal.hidden) cpPintarLista();
}

function cpPintarFlotante() {
  const unidades = cpItems.reduce(function (s, i) {
    return s + i.cantidad;
  }, 0);

  document.querySelector("#carrito-cantidad").textContent = unidades;
  document.querySelector("#carrito-total-flotante").textContent =
    formatearBs(cpTotalBs());
}

function cpPintarLista() {
  cpTotal.textContent = numeroBs(cpTotalBs()) + " Bs";
  cpConfirmar.disabled = cpItems.length === 0;

  if (cpItems.length === 0) {
    cpLista.innerHTML =
      '<p class="lista-vacia">El carrito está vacío. Añada productos desde la tabla.</p>';
    return;
  }

  cpLista.innerHTML = cpItems
    .map(function (i) {
      const id = escapeHtml(i.id);

      return (
        '<div class="producto-venta">' +
        '<div class="producto-venta-info">' +
        "<strong>" +
        escapeHtml(i.nombre) +
        "</strong>" +
        "<small>" +
        numeroBs(i.precio) +
        " Bs c/u</small>" +
        "</div>" +
        '<div class="cantidad-control">' +
        '<button type="button" class="btn-cant" data-cambio="-1" data-id="' +
        id +
        '" aria-label="Quitar una unidad de ' +
        escapeHtml(i.nombre) +
        '">−</button>' +
        "<span>" +
        i.cantidad +
        "</span>" +
        '<button type="button" class="btn-cant" data-cambio="1" data-id="' +
        id +
        '" aria-label="Añadir una unidad de ' +
        escapeHtml(i.nombre) +
        '">+</button>' +
        "</div>" +
        '<span class="precio">' +
        numeroBs(i.precio * i.cantidad) +
        " Bs</span>" +
        '<button type="button" class="btn-quitar" data-id="' +
        id +
        '" aria-label="Quitar ' +
        escapeHtml(i.nombre) +
        '">✕</button>' +
        "</div>"
      );
    })
    .join("");
}

// =====================================================
// AÑADIR DESDE LA TABLA
// =====================================================

function cpAnadir(producto) {
  const existencia = Number(producto.existencia) || 0;
  const existente = cpItems.find(function (i) {
    return String(i.id) === String(producto.id_productos);
  });
  const yaEnCarrito = existente ? existente.cantidad : 0;

  if (yaEnCarrito + 1 > existencia) {
    mostrarMensaje(
      mensajeAdmin,
      "No hay más existencia de " +
        producto.nombre +
        " (disponible: " +
        existencia +
        ").",
      "error",
    );
    return;
  }

  if (existente) {
    existente.cantidad += 1;
    existente.existencia = existencia;
    existente.precio = Number(producto.precio);
  } else {
    cpItems.push({
      id: producto.id_productos,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: 1,
      categoria: producto.id_categorias,
      existencia: existencia,
    });
  }

  cpGuardarYPintar();
  mostrarMensaje(
    mensajeAdmin,
    "«" + producto.nombre + "» añadido al carrito.",
    "ok",
  );
}

cuerpoTabla.addEventListener("click", function (e) {
  const boton = e.target.closest("[data-agregar]");
  if (!boton) return;

  const producto = estado.lista.find(function (p) {
    return String(p.id_productos) === boton.dataset.agregar;
  });

  if (producto) cpAnadir(producto);
});

// =====================================================
// VENTANA DEL CARRITO
// =====================================================

async function cpAbrir() {
  cpItems = leerCarrito(); // por si cambió en otra pestaña
  mostrarMensaje(cpMensaje, "");
  cpPintarLista();
  cpModal.hidden = false;
  document.body.classList.add("modal-abierto");

  if (!cpClientesCargados) {
    await llenarSelectClientes(cpCliente);
    cpClientesCargados = true;
  }
}

function cpCerrar() {
  cpModal.hidden = true;
  document.body.classList.remove("modal-abierto");
}

cpFlotante.addEventListener("click", cpAbrir);
document.querySelector("#carrito-seguir").addEventListener("click", cpCerrar);

cpModal.addEventListener("click", function (e) {
  if (e.target === cpModal) cpCerrar();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !cpModal.hidden) cpCerrar();
});

cpLista.addEventListener("click", function (e) {
  const quitar = e.target.closest(".btn-quitar");
  const cambio = e.target.closest(".btn-cant");

  if (quitar) {
    cpItems = cpItems.filter(function (i) {
      return String(i.id) !== quitar.dataset.id;
    });
  } else if (cambio) {
    const item = cpItems.find(function (i) {
      return String(i.id) === cambio.dataset.id;
    });

    if (!item) return;

    const nueva = item.cantidad + Number(cambio.dataset.cambio);

    if (nueva < 1) {
      cpItems = cpItems.filter(function (i) {
        return i !== item;
      });
    } else if (item.existencia !== null && nueva > item.existencia) {
      mostrarMensaje(
        cpMensaje,
        "No hay más existencia de " +
          item.nombre +
          " (disponible: " +
          item.existencia +
          ").",
        "error",
      );
      return;
    } else {
      item.cantidad = nueva;
    }
  } else {
    return;
  }

  mostrarMensaje(cpMensaje, "");
  cpGuardarYPintar();
});

document
  .querySelector("#carrito-vaciar")
  .addEventListener("click", function () {
    cpItems = [];
    cpGuardarYPintar();
    mostrarMensaje(cpMensaje, "");
  });

// =====================================================
// CONFIRMAR LA VENTA
// =====================================================

cpForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!usuarioSesion) {
    mostrarMensaje(
      cpMensaje,
      "Debe iniciar sesión para registrar la venta.",
      "error",
    );
    return;
  }

  if (!cpCliente.value) {
    mostrarMensaje(cpMensaje, "Seleccione el cliente.", "error");
    return;
  }

  if (cpItems.length === 0) {
    mostrarMensaje(cpMensaje, "El carrito está vacío.", "error");
    return;
  }

  cpConfirmar.disabled = true;
  mostrarMensaje(cpMensaje, "Registrando venta...");

  try {
    // registrar_venta crea la venta, toma los precios de la base y descuenta
    // la existencia en una sola transacción (si algo falla, no se guarda nada)
    const r = await sup.rpc("registrar_venta", {
      p_cliente: Number(cpCliente.value),
      p_items: cpItems.map(function (i) {
        return { id_productos: i.id, cantidad: i.cantidad };
      }),
    });

    if (r.error) {
      console.error("Error al registrar la venta:", r.error);
      mostrarMensaje(
        cpMensaje,
        "No se pudo registrar la venta: " + r.error.message,
        "error",
      );
      await cargarProductos(); // la existencia pudo cambiar
      return;
    }

    cpItems = [];
    guardarCarrito(cpItems);
    mostrarMensaje(
      cpMensaje,
      "Venta N.º " + r.data + " registrada. Abriendo la factura...",
      "ok",
    );
    window.location.href =
      "facturacion.html?venta=" + encodeURIComponent(r.data) + "&nueva=1";
  } catch (error) {
    console.error("Error de conexión al registrar la venta:", error);
    mostrarMensaje(
      cpMensaje,
      "No se pudo conectar. Revise su internet. La venta NO se registró.",
      "error",
    );
  } finally {
    cpConfirmar.disabled = cpItems.length === 0;
  }
});

cpPintarFlotante();
