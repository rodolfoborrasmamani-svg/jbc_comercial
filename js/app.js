/* =====================================================
   JBC COMERCIAL
   SISTEMA DE VENTAS
===================================================== */

// =====================================================
// VARIABLES
// =====================================================

let productosCache = [];

let usuarioActual = null;

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const cuerpoTabla = document.querySelector("#cuerpo-productos");

const selectProducto = document.querySelector("#campo-producto");

const selectCategoria = document.querySelector("#campo-categoria");

const mensajeProducto = document.querySelector("#mensaje-producto");

const mensajeVenta = document.querySelector("#mensaje-venta");

const listaVenta = document.querySelector("#lista-venta");

const totalVenta = document.querySelector("#total-venta");

// =====================================================
// ELEMENTOS DEL LOGIN
// =====================================================

const formLogin = document.querySelector("#form-login");

const campoUsuario = document.querySelector("#campo-usuario");

const campoPassword = document.querySelector("#campo-password");

const mensajeLogin = document.querySelector("#mensaje-login");

const usuarioActualDiv = document.querySelector("#usuario-actual");

const nombreUsuarioActual = document.querySelector("#nombre-usuario-actual");

const btnCerrarSesion = document.querySelector("#btn-cerrar-sesion");

// =====================================================
// CARGAR PRODUCTOS EN EL SELECT
// =====================================================

function llenarSelectProductos(productos) {
  selectProducto.innerHTML = '<option value="">Seleccionar producto</option>';

  productos.forEach(function (producto) {
    const option = document.createElement("option");

    option.value = producto.id_productos;

    option.textContent =
      producto.nombre + " - " + Number(producto.precio).toFixed(2) + " Bs";

    selectProducto.appendChild(option);
  });
}

// =====================================================
// CARGAR CATEGORÍAS
// =====================================================

async function cargarCategorias() {
  const resultado = await sup
    .from("categorias")
    .select("*")
    .order("id_categorias", {
      ascending: true,
    });

  const categorias = resultado.data;

  const error = resultado.error;

  if (error) {
    console.error("Error al cargar categorías:", error);

    return;
  }

  selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';

  categorias.forEach(function (categoria) {
    const option = document.createElement("option");

    option.value = categoria.id_categorias;

    option.textContent = categoria.nombres + " - " + categoria.marca;

    selectCategoria.appendChild(option);
  });
}

// =====================================================
// CARGAR PRODUCTOS
// =====================================================

async function cargarProductos() {
  cuerpoTabla.innerHTML = '<tr><td colspan="3">Cargando productos...</td></tr>';

  const resultado = await sup
    .from("productos")
    .select("*")
    .order("id_productos", {
      ascending: true,
    });

  const data = resultado.data;

  const error = resultado.error;

  if (error) {
    console.error("Error al leer productos:", error);

    cuerpoTabla.innerHTML =
      '<tr><td colspan="3">No se pudo cargar el listado.</td></tr>';

    return;
  }

  productosCache = data;

  if (data.length === 0) {
    cuerpoTabla.innerHTML =
      '<tr><td colspan="3">Todavía no hay productos registrados.</td></tr>';

    llenarSelectProductos([]);

    return;
  }

  // =================================================
  // CREAR FILAS
  // =================================================

  const filas = data
    .map(function (producto) {
      return (
        "<tr>" +
        "<td>" +
        producto.nombre +
        "</td>" +
        "<td>" +
        Number(producto.precio).toFixed(2) +
        " Bs" +
        "</td>" +
        "<td>" +
        producto.existencia +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  cuerpoTabla.innerHTML = filas;

  // =================================================
  // LLENAR SELECT
  // =================================================

  llenarSelectProductos(data);
}

// =====================================================
// LOGIN DE USUARIO
// =====================================================

if (formLogin) {
  formLogin.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nombre = campoUsuario.value.trim();

    const password = campoPassword.value;

    // ===============================================
    // VALIDAR CAMPOS
    // ===============================================

    if (!nombre) {
      mensajeLogin.textContent = "Ingrese su usuario.";

      return;
    }

    if (!password) {
      mensajeLogin.textContent = "Ingrese su contraseña.";

      return;
    }

    mensajeLogin.textContent = "Verificando usuario...";

    // ===============================================
    // BUSCAR USUARIO EN SUPABASE
    // ===============================================

    const resultado = await sup
      .from("usuarios")
      .select("id_usuarios, nombres, id_roles, password")
      .eq("nombres", nombre)
      .eq("password", password)
      .maybeSingle();

    const usuario = resultado.data;

    const error = resultado.error;

    // ===============================================
    // ERROR DE SUPABASE
    // ===============================================

    if (error) {
      console.error("Error al iniciar sesión:", error);

      mensajeLogin.textContent = "No se pudo verificar el usuario.";

      return;
    }

    // ===============================================
    // USUARIO INCORRECTO
    // ===============================================

    if (!usuario) {
      mensajeLogin.textContent = "Usuario o contraseña incorrectos.";

      return;
    }

    // ===============================================
    // GUARDAR USUARIO ACTUAL
    // ===============================================

    usuarioActual = {
      id_usuarios: usuario.id_usuarios,

      nombres: usuario.nombres,

      id_roles: usuario.id_roles,
    };

    // ===============================================
    // MOSTRAR USUARIO
    // ===============================================

    nombreUsuarioActual.textContent =
      usuarioActual.nombres + " (ID: " + usuarioActual.id_usuarios + ")";

    usuarioActualDiv.style.display = "block";

    mensajeLogin.textContent = "Sesión iniciada correctamente.";

    // ===============================================
    // LIMPIAR CONTRASEÑA
    // ===============================================

    campoPassword.value = "";

    console.log("Usuario conectado:", usuarioActual);
  });
}

// =====================================================
// CERRAR SESIÓN
// =====================================================

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", function () {
    usuarioActual = null;

    usuarioActualDiv.style.display = "none";

    campoUsuario.value = "";

    campoPassword.value = "";

    mensajeLogin.textContent = "Sesión cerrada.";
  });
}

// =====================================================
// INGRESAR PRODUCTO
// =====================================================

document
  .querySelector("#form-producto")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    // =============================================
    // OBTENER DATOS
    // =============================================

    const codigo = document.querySelector("#campo-codigo").value.trim();

    const cantidad = Number(
      document.querySelector("#campo-cantidad-producto").value,
    );

    const nombre = document
      .querySelector("#campo-nombre-producto")
      .value.trim();

    const precio = Number(
      document.querySelector("#campo-precio-producto").value,
    );

    const idCategoria = Number(
      document.querySelector("#campo-categoria").value,
    );

    // =============================================
    // VALIDACIONES
    // =============================================

    if (!nombre) {
      mensajeProducto.textContent = "Ingrese el nombre del producto.";

      return;
    }

    if (!cantidad || cantidad < 1) {
      mensajeProducto.textContent = "La cantidad debe ser mayor a 0.";

      return;
    }

    if (!precio || precio < 0) {
      mensajeProducto.textContent = "Ingrese un precio válido.";

      return;
    }

    if (!idCategoria) {
      mensajeProducto.textContent = "Seleccione una categoría.";

      return;
    }

    mensajeProducto.textContent = "Guardando producto...";

    // =============================================
    // PREPARAR PRODUCTO
    // =============================================

    const productoNuevo = {
      nombre: nombre,

      precio: precio,

      existencia: cantidad,

      id_categorias: idCategoria,
    };

    // =============================================
    // CÓDIGO
    // =============================================

    if (codigo !== "") {
      const idCodigo = Number(codigo);

      if (!Number.isNaN(idCodigo)) {
        productoNuevo.id_productos = idCodigo;
      }
    }

    // =============================================
    // INSERTAR
    // =============================================

    const resultado = await sup
      .from("productos")
      .insert(productoNuevo)
      .select()
      .single();

    const productoGuardado = resultado.data;

    const error = resultado.error;

    // =============================================
    // ERROR
    // =============================================

    if (error) {
      console.error("Error al ingresar producto:", error);

      mensajeProducto.textContent = "No se pudo registrar el producto.";

      return;
    }

    // =============================================
    // MENSAJE
    // =============================================

    mensajeProducto.textContent = "Producto registrado correctamente.";

    console.log("Producto guardado:", productoGuardado);

    // =============================================
    // LIMPIAR
    // =============================================

    document.querySelector("#form-producto").reset();

    // =============================================
    // RECARGAR
    // =============================================

    await cargarProductos();
  });

// =====================================================
// CAMBIAR PRODUCTO
// =====================================================

selectProducto.addEventListener("change", function () {
  const idProducto = Number(this.value);

  const producto = productosCache.find(function (p) {
    return p.id_productos === idProducto;
  });

  if (!producto) {
    listaVenta.innerHTML = "";

    totalVenta.textContent = "0,00 Bs";

    return;
  }

  mostrarProductoVenta(producto);
});

// =====================================================
// MOSTRAR PRODUCTO EN VENTA
// =====================================================

function mostrarProductoVenta(producto) {
  const cantidad = Number(document.querySelector("#campo-cantidad").value) || 1;

  const total = Number(producto.precio) * cantidad;

  listaVenta.innerHTML =
    '<div class="producto-venta">' +
    "<span>" +
    cantidad +
    " " +
    producto.nombre +
    "</span>" +
    '<span class="precio">' +
    "X" +
    cantidad +
    " - " +
    total.toFixed(2) +
    " Bs" +
    "</span>" +
    "</div>";

  totalVenta.textContent = total.toFixed(2) + " Bs";
}

// =====================================================
// CAMBIAR CANTIDAD
// =====================================================

document
  .querySelector("#campo-cantidad")
  .addEventListener("input", function () {
    const idProducto = Number(selectProducto.value);

    const producto = productosCache.find(function (p) {
      return p.id_productos === idProducto;
    });

    if (producto) {
      mostrarProductoVenta(producto);
    }
  });

// =====================================================
// REGISTRAR VENTA
// =====================================================

document
  .querySelector("#form-venta")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    // =============================================
    // COMPROBAR USUARIO
    // =============================================

    if (!usuarioActual) {
      mensajeVenta.textContent =
        "Debe iniciar sesión antes de registrar una venta.";

      return;
    }

    // =============================================
    // ID DEL USUARIO
    // =============================================

    const idUsuario = usuarioActual.id_usuarios;

    console.log("ID del usuario que vende:", idUsuario);

    // =============================================
    // PRODUCTO
    // =============================================

    const idProducto = Number(selectProducto.value);

    // =============================================
    // CANTIDAD
    // =============================================

    const cantidad = Number(document.querySelector("#campo-cantidad").value);

    // =============================================
    // BUSCAR PRODUCTO
    // =============================================

    const producto = productosCache.find(function (p) {
      return p.id_productos === idProducto;
    });

    if (!producto) {
      mensajeVenta.textContent = "Seleccione un producto.";

      return;
    }

    // =============================================
    // VALIDAR CANTIDAD
    // =============================================

    if (!cantidad || cantidad < 1) {
      mensajeVenta.textContent = "Ingrese una cantidad válida.";

      return;
    }

    // =============================================
    // COMPROBAR EXISTENCIA
    // =============================================

    if (cantidad > producto.existencia) {
      mensajeVenta.textContent =
        "No hay suficiente existencia. Disponible: " + producto.existencia;

      return;
    }

    // =============================================
    // CALCULAR TOTAL
    // =============================================

    const total = Number(producto.precio) * cantidad;

    mensajeVenta.textContent = "Registrando venta...";

    // =============================================
    // CREAR VENTA
    // =============================================

    const resultadoVenta = await sup
      .from("ventas")
      .insert({
        id_usuario: idUsuario,

        total: total,
      })
      .select()
      .single();

    const venta = resultadoVenta.data;

    const errorVenta = resultadoVenta.error;

    // =============================================
    // COMPROBAR ERROR
    // =============================================

    if (errorVenta) {
      console.error("Error al registrar venta:", errorVenta);

      mensajeVenta.textContent = "Ocurrió un problema al registrar la venta.";

      return;
    }

    console.log("Venta creada:", venta);

    // =============================================
    // CREAR DETALLE DE VENTA
    // =============================================

    const resultadoDetalle = await sup.from("detalle_ventas").insert({
      id_venta: venta.id,

      id_producto: idProducto,

      cantidad: cantidad,

      precio_unitario: producto.precio,
    });

    const errorDetalle = resultadoDetalle.error;

    // =============================================
    // ERROR DETALLE
    // =============================================

    if (errorDetalle) {
      console.error("Error al guardar detalle:", errorDetalle);

      mensajeVenta.textContent = "Ocurrió un problema al guardar el detalle.";

      return;
    }

    // =============================================
    // ACTUALIZAR EXISTENCIA
    // =============================================

    const nuevaExistencia = producto.existencia - cantidad;

    const resultadoStock = await sup
      .from("productos")
      .update({
        existencia: nuevaExistencia,
      })
      .eq("id_productos", idProducto);

    const errorStock = resultadoStock.error;

    if (errorStock) {
      console.error("Error al actualizar existencia:", errorStock);
    }

    // =============================================
    // MOSTRAR RESULTADO
    // =============================================

    mensajeVenta.textContent =
      "Venta registrada correctamente. " +
      "Vendedor: " +
      usuarioActual.nombres +
      " | Total: " +
      total.toFixed(2) +
      " Bs";

    // =============================================
    // LIMPIAR
    // =============================================

    document.querySelector("#form-venta").reset();

    listaVenta.innerHTML = "";

    totalVenta.textContent = "0,00 Bs";

    // =============================================
    // ACTUALIZAR PRODUCTOS
    // =============================================

    await cargarProductos();
  });

// =====================================================
// BOTÓN CANCELAR
// =====================================================

document.querySelector("#btn-cancelar").addEventListener("click", function () {
  document.querySelector("#form-venta").reset();

  listaVenta.innerHTML = "";

  totalVenta.textContent = "0,00 Bs";

  mensajeVenta.textContent = "";
});

// =====================================================
// INICIAR SISTEMA
// =====================================================

async function iniciar() {
  await cargarCategorias();

  await cargarProductos();
}

// =====================================================
// EJECUTAR
// =====================================================

iniciar();
