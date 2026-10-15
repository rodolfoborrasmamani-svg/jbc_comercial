/* =====================================================
   JBC COMERCIAL — VENTAS
   Login de usuarios y registro de ventas con varios productos.
   Requiere `sup` (supabase-client.js) y utilidades.js
===================================================== */

// =====================================================
// COLUMNAS DE LA TABLA `clientes` (selector de cliente en la venta)
// Si en tu base se llaman distinto, cámbialas SOLO aquí.
// =====================================================

const COL = {
  clientes: {
    nombre: "nombres",
    carnet: "carnet",
    // La clave primaria se detecta sola (id_cliente, id_clientes o id).
    // Si falla, escribe aquí su nombre, por ejemplo: id: "id_cliente"
    id: null,
  },
};

// =====================================================
// VARIABLES
// =====================================================

let usuarioActual = null;

// Productos de la base (para validar existencia)
let productosCache = [];

// Carrito de la venta: [{ id, nombre, precio, cantidad }]
let carrito = [];

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const selectProducto = document.querySelector("#campo-producto");
const campoCantidad = document.querySelector("#campo-cantidad");
const btnAnadir = document.querySelector("#btn-anadir");
const mensajeVenta = document.querySelector("#mensaje-venta");
const listaVenta = document.querySelector("#lista-venta");
const totalVenta = document.querySelector("#total-venta");
const vendedorVenta = document.querySelector("#vendedor-venta");
const selectCliente = document.querySelector("#campo-cliente");

const formLogin = document.querySelector("#form-login");
const campoUsuario = document.querySelector("#campo-usuario");
const campoPassword = document.querySelector("#campo-password");
const mensajeLogin = document.querySelector("#mensaje-login");
const usuarioActualDiv = document.querySelector("#usuario-actual");
const nombreUsuarioActual = document.querySelector("#nombre-usuario-actual");
const btnCerrarSesion = document.querySelector("#btn-cerrar-sesion");

// Refresca el resumen de ventas (js/resumen.js) si la página lo tiene
function refrescarResumen() {
  if (typeof cargarResumen === "function") cargarResumen();
}

// =====================================================
// SESIÓN (Supabase Auth: correo y contraseña)
// =====================================================

function mostrarUsuario() {
  if (usuarioActual) {
    nombreUsuarioActual.textContent =
      usuarioActual.nombres + " · " + usuarioActual.email;
    vendedorVenta.textContent = usuarioActual.nombres;
    usuarioActualDiv.style.display = "flex";
  } else {
    usuarioActualDiv.style.display = "none";
    vendedorVenta.textContent = "Inicie sesión para vender";
  }
}

// Al abrir la página: recupera la sesión que Supabase ya tenga guardada
async function restaurarSesion() {
  usuarioActual = await obtenerPerfilActual();
  mostrarUsuario();
}

// Traduce los errores de Supabase Auth a mensajes claros
function textoErrorLogin(error) {
  const msg = String(error.message || "").toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (msg.includes("email not confirmed")) {
    return "Debe confirmar su correo antes de iniciar sesión.";
  }
  if (msg.includes("rate limit") || error.status === 429) {
    return "Demasiados intentos. Espere unos minutos.";
  }
  return "No se pudo iniciar sesión. Revise su conexión.";
}

if (formLogin) {
  formLogin.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = campoUsuario.value.trim().toLowerCase();
    const password = campoPassword.value;

    if (!email) {
      mostrarMensaje(mensajeLogin, "Ingrese su correo electrónico.", "error");
      return;
    }

    if (!password) {
      mostrarMensaje(mensajeLogin, "Ingrese su contraseña.", "error");
      return;
    }

    const boton = formLogin.querySelector('button[type="submit"]');
    boton.disabled = true;
    mostrarMensaje(mensajeLogin, "Verificando usuario...");

    try {
      // 1) Autenticación con Supabase Auth
      const acceso = await sup.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (acceso.error) {
        console.error("Error al iniciar sesión:", acceso.error);
        mostrarMensaje(mensajeLogin, textoErrorLogin(acceso.error), "error");
        return;
      }

      // 2) Perfil del sistema (id_usuarios, nombre y rol)
      const perfil = await obtenerPerfilActual();

      if (!perfil) {
        await sup.auth.signOut();
        mostrarMensaje(
          mensajeLogin,
          "Su cuenta no está vinculada a un usuario del sistema. Avise al administrador.",
          "error",
        );
        return;
      }

      usuarioActual = perfil;

      mostrarUsuario();
      mostrarMensaje(mensajeLogin, "Sesión iniciada correctamente.", "ok");
      cargarClientes();
      refrescarResumen();
      campoPassword.value = "";
    } finally {
      boton.disabled = false;
    }
  });
}

btnCerrarSesion.addEventListener("click", async function () {
  await sup.auth.signOut();
  usuarioActual = null;

  mostrarUsuario();
  campoUsuario.value = "";
  campoPassword.value = "";
  mostrarMensaje(mensajeLogin, "Sesión cerrada.");
  cargarClientes();
  refrescarResumen();
});

// =====================================================
// PRODUCTOS
// =====================================================

async function cargarProductos() {
  // Solo productos activos (los dados de baja no se pueden vender)
  let resultado = await sup
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  // Si todavía no existe la columna `activo`, carga todos
  if (resultado.error && resultado.error.code === "42703") {
    resultado = await sup
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });
  }

  if (resultado.error) {
    console.error("Error al leer productos:", resultado.error);
    mostrarMensaje(
      mensajeVenta,
      "No se pudieron cargar los productos.",
      "error",
    );
    return;
  }

  productosCache = resultado.data || [];
  llenarSelectProductos();
}

function llenarSelectProductos() {
  const previo = selectProducto.value;

  selectProducto.innerHTML = '<option value="">Seleccionar producto</option>';

  productosCache.forEach(function (p) {
    const option = document.createElement("option");
    const agotado = Number(p.existencia) <= 0;

    option.value = p.id_productos;
    option.disabled = agotado;
    option.textContent =
      p.nombre +
      " - " +
      numeroBs(p.precio) +
      " Bs" +
      (agotado ? " (agotado)" : " · disp. " + p.existencia);

    selectProducto.appendChild(option);
  });

  if (previo) selectProducto.value = previo;
}

function buscarProducto(id) {
  return productosCache.find(function (p) {
    return Number(p.id_productos) === Number(id);
  });
}

// =====================================================
// CLIENTES
// =====================================================

// Busca el nombre de la clave primaria en una fila de `clientes`
function detectarClaveCliente(fila) {
  if (COL.clientes.id) return COL.clientes.id;

  const candidatos = ["id_cliente", "id_clientes", "id"];

  for (const c of candidatos) {
    if (c in fila) return c;
  }

  return (
    Object.keys(fila).find(function (k) {
      return k.startsWith("id");
    }) || null
  );
}

async function cargarClientes() {
  const resultado = await sup
    .from("clientes")
    .select("*")
    .order(COL.clientes.nombre, { ascending: true });

  if (resultado.error) {
    console.error("Error al leer clientes:", resultado.error);
    selectCliente.innerHTML =
      '<option value="">No se pudieron cargar los clientes</option>';
    return;
  }

  const clientes = resultado.data || [];

  if (clientes.length === 0) {
    selectCliente.innerHTML = usuarioActual
      ? '<option value="">No hay clientes registrados</option>'
      : '<option value="">Inicie sesión para ver los clientes</option>';
    return;
  }

  const clavePk = detectarClaveCliente(clientes[0]);

  if (!clavePk) {
    console.error(
      "No se encontró la clave primaria de clientes. Columnas:",
      Object.keys(clientes[0]),
    );
    selectCliente.innerHTML =
      '<option value="">Revise COL.clientes.id en ventas.js</option>';
    return;
  }

  const previo = selectCliente.value;

  selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';

  clientes.forEach(function (c) {
    const option = document.createElement("option");

    option.value = c[clavePk];
    option.textContent =
      c[COL.clientes.nombre] +
      (c[COL.clientes.carnet] ? " — CI " + c[COL.clientes.carnet] : "");

    selectCliente.appendChild(option);
  });

  if (previo) selectCliente.value = previo;
}

// =====================================================
// CARRITO
// =====================================================

function totalCarrito() {
  return carrito.reduce(function (suma, item) {
    return suma + item.precio * item.cantidad;
  }, 0);
}

function renderizarCarrito() {
  if (carrito.length === 0) {
    listaVenta.innerHTML =
      '<p class="lista-vacia">Aún no añadió productos a la venta.</p>';
    totalVenta.textContent = "0,00 Bs";
    return;
  }

  listaVenta.innerHTML = carrito
    .map(function (item) {
      return (
        '<div class="producto-venta">' +
        '<div class="producto-venta-info">' +
        "<strong>" +
        escapeHtml(item.nombre) +
        "</strong>" +
        "<small>" +
        item.cantidad +
        " × " +
        numeroBs(item.precio) +
        " Bs</small>" +
        "</div>" +
        '<span class="precio">' +
        numeroBs(item.precio * item.cantidad) +
        " Bs</span>" +
        '<button type="button" class="btn-quitar" data-id="' +
        escapeHtml(item.id) +
        '" aria-label="Quitar ' +
        escapeHtml(item.nombre) +
        '">✕</button>' +
        "</div>"
      );
    })
    .join("");

  totalVenta.textContent = numeroBs(totalCarrito()) + " Bs";
}

function anadirAlCarrito() {
  const producto = buscarProducto(selectProducto.value);
  const cantidad = Number(campoCantidad.value);

  if (!producto) {
    mostrarMensaje(mensajeVenta, "Seleccione un producto.", "error");
    return;
  }

  if (!Number.isInteger(cantidad) || cantidad < 1) {
    mostrarMensaje(mensajeVenta, "Ingrese una cantidad válida.", "error");
    return;
  }

  const existente = carrito.find(function (i) {
    return i.id === producto.id_productos;
  });

  // La cantidad total del producto en la venta no puede superar la existencia
  const yaEnCarrito = existente ? existente.cantidad : 0;

  if (yaEnCarrito + cantidad > Number(producto.existencia)) {
    mostrarMensaje(
      mensajeVenta,
      "No hay suficiente existencia de " +
        producto.nombre +
        ". Disponible: " +
        producto.existencia +
        (yaEnCarrito ? " (ya añadió " + yaEnCarrito + ")" : ""),
      "error",
    );
    return;
  }

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id_productos,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: cantidad,
      categoria: producto.id_categorias,
    });
  }

  renderizarCarrito();
  mostrarMensaje(mensajeVenta, "Producto añadido a la venta.", "ok");

  // Listo para añadir otro
  selectProducto.value = "";
  campoCantidad.value = 1;
}

btnAnadir.addEventListener("click", anadirAlCarrito);

listaVenta.addEventListener("click", function (e) {
  const boton = e.target.closest(".btn-quitar");
  if (!boton) return;

  carrito = carrito.filter(function (i) {
    return String(i.id) !== boton.dataset.id;
  });

  renderizarCarrito();
  mostrarMensaje(mensajeVenta, "");
});

function vaciarVenta() {
  carrito = [];
  selectCliente.value = "";
  selectProducto.value = "";
  campoCantidad.value = 1;
  renderizarCarrito();
}

document.querySelector("#btn-cancelar").addEventListener("click", function () {
  vaciarVenta();
  mostrarMensaje(mensajeVenta, "");
});

// =====================================================
// CONFIRMAR VENTA
// =====================================================

document
  .querySelector("#form-venta")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!usuarioActual) {
      mostrarMensaje(
        mensajeVenta,
        "Debe iniciar sesión antes de registrar una venta.",
        "error",
      );
      return;
    }

    if (!selectCliente.value) {
      mostrarMensaje(mensajeVenta, "Seleccione el cliente.", "error");
      return;
    }

    if (carrito.length === 0) {
      mostrarMensaje(mensajeVenta, "Añada al menos un producto.", "error");
      return;
    }

    const boton = event.currentTarget.querySelector('button[type="submit"]');
    boton.disabled = true;
    mostrarMensaje(mensajeVenta, "Registrando venta...");

    try {
      // La función registrar_venta (en Supabase) hace todo en una transacción:
      // crea la venta, guarda el detalle, toma los precios de la base y
      // descuenta la existencia. Si algo falla, no se guarda nada.
      const items = carrito.map(function (item) {
        return { id_productos: item.id, cantidad: item.cantidad };
      });

      const resultado = await sup.rpc("registrar_venta", {
        p_cliente: Number(selectCliente.value),
        p_items: items,
      });

      if (resultado.error) {
        console.error("Error al registrar venta:", resultado.error);

        mostrarMensaje(
          mensajeVenta,
          "No se pudo registrar la venta: " + resultado.error.message,
          "error",
        );

        // La existencia pudo cambiar: se vuelve a leer
        await cargarProductos();
        return;
      }

      const total = totalCarrito();

      mostrarMensaje(
        mensajeVenta,
        "Venta N.º " +
          resultado.data +
          " registrada correctamente. Vendedor: " +
          usuarioActual.nombres +
          " | Total: " +
          numeroBs(total) +
          " Bs",
        "ok",
      );

      vaciarVenta();
      await cargarProductos();
      refrescarResumen();
    } finally {
      boton.disabled = false;
    }
  });

// =====================================================
// INICIAR
// =====================================================

restaurarSesion();
renderizarCarrito();
cargarProductos();
cargarClientes();
