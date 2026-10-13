/* =====================================================
   JBC COMERCIAL — PRODUCTOS
   Categorías, filtro, búsqueda, ingreso de productos y
   administración (editar, dar de baja, reactivar, eliminar).
   Requiere `sup` (supabase-client.js) y utilidades.js
===================================================== */

// =====================================================
// CONFIGURACIÓN
// =====================================================

// Nombre de la columna de descripción en `productos`
// (si en tu base no lleva tilde, cámbiala a "descripcion")
const COL_DESC = "descripción";

const STOCK_BAJO = 5;

// Solo el administrador ve las acciones de editar / baja / eliminar.
// Se resuelven al iniciar, con la sesión de Supabase Auth.
let usuarioSesion = null;
let esAdmin = false;

// Columnas de la tabla (para los mensajes de vacío / error)
let COLUMNAS = 4;

// =====================================================
// ESTADO
// =====================================================

const estado = {
  categoriaActiva: null, // nombre (ej. "Micrófonos") o null = todas
  categorias: [], // filas de la tabla `categorias`
  grupos: new Map(), // clave normalizada -> { nombre, ids: [] }
  porId: new Map(), // id_categorias -> fila de categorias
  peticion: 0, // descarta respuestas viejas si se cambia rápido de filtro
  lista: [], // productos cargados (según categoría y bajas)
  busqueda: "", // texto del buscador
  verBajas: false, // el administrador ve también los dados de baja
  tieneActivo: true, // false si la columna `activo` aún no existe
};

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const cuerpoTabla = document.querySelector("#cuerpo-productos");
const selectCategoria = document.querySelector("#campo-categoria");
const mensajeProducto = document.querySelector("#mensaje-producto");
const mensajeAdmin = document.querySelector("#mensaje-admin");
const seccionProductos = document.querySelector("#productos");
const tarjetas = document.querySelectorAll(".categoria");
const buscarProducto = document.querySelector("#buscar-producto");

// Si el HTML no trae el filtro o el contador, la página sigue funcionando
const filtroCategoria =
  document.querySelector("#filtro-categoria") ||
  document.createElement("select");
const contadorProductos = document.querySelector("#contador-productos") || {
  textContent: "",
};

// Ventana de edición
const modalEditar = document.querySelector("#modal-editar");
const formEditar = document.querySelector("#form-editar-producto");
const mensajeEdicion = document.querySelector("#mensaje-edicion");

// Diagnóstico: avisa en la consola qué elementos faltan en el HTML
(function comprobarHtml() {
  const necesarios = [
    "cuerpo-productos",
    "campo-categoria",
    "mensaje-producto",
    "productos",
    "form-producto",
    "modal-editar",
    "form-editar-producto",
  ];

  const faltan = necesarios.filter(function (id) {
    return !document.getElementById(id);
  });

  if (faltan.length > 0) {
    console.error(
      "productos.js: faltan estos elementos en " +
        window.location.pathname +
        " -> #" +
        faltan.join(", #") +
        ". Reemplaza pages/productos.html por la versión completa.",
    );
  }
})();

// =====================================================
// MODO ADMINISTRADOR (mostrar / ocultar controles)
// =====================================================

function iniciarAdmin() {
  const barra = document.querySelector("#admin-barra");
  const aviso = document.querySelector("#aviso-admin");
  const colAcciones = document.querySelector(".col-acciones");
  const nombre = document.querySelector("#admin-nombre");
  const verBajas = document.querySelector("#ver-bajas");

  // Solo el administrador ve el formulario de ingreso de productos
  const panelIngreso = document.querySelector("#ingresar-producto");
  if (panelIngreso) panelIngreso.hidden = !esAdmin;

  if (colAcciones) colAcciones.hidden = !esAdmin;
  if (barra) barra.hidden = !esAdmin;
  if (aviso) aviso.hidden = esAdmin;

  if (esAdmin && nombre) {
    nombre.textContent = "· " + usuarioSesion.nombres;
  }

  if (verBajas) {
    verBajas.addEventListener("change", function () {
      estado.verBajas = verBajas.checked;
      cargarProductos();
    });
  }
}

// =====================================================
// CATEGORÍAS (tabla `categorias`)
// =====================================================

async function cargarCategorias() {
  const resultado = await sup
    .from("categorias")
    .select("*")
    .order("id_categorias", { ascending: true });

  if (resultado.error) {
    console.error("Error al cargar categorías:", resultado.error);
    return;
  }

  estado.categorias = resultado.data || [];
  estado.grupos = new Map();
  estado.porId = new Map();

  // Agrupa por nombre: "Micrófonos" puede tener varias marcas/ids
  estado.categorias.forEach(function (cat) {
    estado.porId.set(cat.id_categorias, cat);

    const k = clave(cat.nombres);
    if (!estado.grupos.has(k)) {
      estado.grupos.set(k, { nombre: cat.nombres, ids: [] });
    }
    estado.grupos.get(k).ids.push(cat.id_categorias);
  });

  poblarSelects();
}

function poblarSelects() {
  // Select del formulario de productos (guarda id_categorias)
  selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';

  estado.categorias.forEach(function (cat) {
    const option = document.createElement("option");
    option.value = cat.id_categorias;
    option.textContent = cat.nombres + " - " + cat.marca;
    selectCategoria.appendChild(option);
  });

  // Mismo listado en la ventana de edición
  const selectEditar = document.querySelector("#editar-categoria");
  if (selectEditar) selectEditar.innerHTML = selectCategoria.innerHTML;

  // Filtro de la tabla (un item por nombre de categoría)
  filtroCategoria.innerHTML =
    '<option value="">Todas las categorías</option>' +
    Array.from(estado.grupos.values())
      .map(function (g) {
        return (
          '<option value="' +
          escapeHtml(g.nombre) +
          '">' +
          escapeHtml(g.nombre) +
          "</option>"
        );
      })
      .join("");

  filtroCategoria.value = estado.categoriaActiva || "";

  // Sugerencias para el campo Marca (se puede escribir cualquier otra)
  const lista = document.querySelector("#lista-marcas");

  if (lista) {
    const marcas = Array.from(
      new Set(
        estado.categorias
          .map(function (c) {
            return (c.marca || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b, "es");
    });

    lista.innerHTML = marcas
      .map(function (m) {
        return '<option value="' + escapeHtml(m) + '"></option>';
      })
      .join("");
  }
}

// =====================================================
// OBTENER PRODUCTOS (con filtro opcional)
// =====================================================

async function consultarProductos(categoria, incluirBajas) {
  let consulta = sup.from("productos").select("*");

  if (categoria) {
    const grupo = estado.grupos.get(clave(categoria));

    // Categoría sin filas en la tabla `categorias`: no hay nada que buscar
    if (!grupo) return [];

    // Equivale a .eq() pero admite varios ids con el mismo nombre
    consulta =
      grupo.ids.length === 1
        ? consulta.eq("id_categorias", grupo.ids[0])
        : consulta.in("id_categorias", grupo.ids);
  }

  // Los dados de baja solo los ve el administrador (si lo pide)
  if (estado.tieneActivo && !incluirBajas) {
    consulta = consulta.eq("activo", true);
  }

  const resultado = await consulta.order("id_productos", { ascending: true });

  if (resultado.error) throw resultado.error;

  return resultado.data || [];
}

async function obtenerProductos(categoria = null) {
  const incluirBajas = esAdmin && estado.verBajas;

  try {
    return await consultarProductos(categoria, incluirBajas);
  } catch (error) {
    // 42703 = la columna `activo` todavía no existe: carga todo sin filtrar
    if (estado.tieneActivo && error.code === "42703") {
      estado.tieneActivo = false;
      console.warn("La columna `activo` no existe. Ejecute el SQL de bajas.");
      return consultarProductos(categoria, incluirBajas);
    }
    throw error;
  }
}

// =====================================================
// RENDER DE LA TABLA
// =====================================================

function mostrarCargando() {
  const fila =
    '<tr class="estado-fila" aria-hidden="true">' +
    '<td><span class="skeleton"></span><span class="skeleton corto" style="margin-top:8px"></span></td>' +
    '<td><span class="skeleton corto"></span></td>' +
    '<td><span class="skeleton derecha"></span></td>' +
    '<td><span class="skeleton derecha"></span></td>' +
    (esAdmin ? '<td><span class="skeleton derecha"></span></td>' : "") +
    "</tr>";

  cuerpoTabla.innerHTML = fila.repeat(5);
  cuerpoTabla.setAttribute("aria-busy", "true");
  contadorProductos.textContent = "Cargando…";
}

function mostrarVacio() {
  const cat = estado.categoriaActiva;
  const texto = estado.busqueda.trim();
  let titulo;
  let detalle;
  let boton = "";

  if (texto) {
    titulo = "Sin resultados para “" + escapeHtml(texto) + "”";
    detalle = "Prueba con otro código, nombre o marca.";
  } else if (cat) {
    titulo = "No hay productos en “" + escapeHtml(cat) + "”";
    detalle = "Prueba con otra categoría o registra un producto nuevo.";
    boton =
      '<button type="button" data-accion="ver-todas">Ver todas las categorías</button>';
  } else {
    titulo = "Todavía no hay productos registrados";
    detalle = "Registra tu primer producto con el formulario.";
  }

  cuerpoTabla.innerHTML =
    '<tr class="estado-fila"><td colspan="' +
    COLUMNAS +
    '"><div class="estado-vacio">' +
    '<div class="icono">🎧</div>' +
    "<h4>" +
    titulo +
    "</h4>" +
    "<p>" +
    detalle +
    "</p>" +
    boton +
    "</div></td></tr>";

  contadorProductos.textContent = "0 productos";
}

function mostrarError(mensaje) {
  cuerpoTabla.innerHTML =
    '<tr class="estado-fila"><td colspan="' +
    COLUMNAS +
    '"><div class="estado-vacio">' +
    '<div class="icono">⚠️</div>' +
    "<h4>No se pudo cargar el listado</h4>" +
    "<p>" +
    escapeHtml(mensaje || "Revisa tu conexión e inténtalo de nuevo.") +
    "</p>" +
    '<button type="button" data-accion="reintentar">Reintentar</button>' +
    "</div></td></tr>";

  contadorProductos.textContent = "";
}

// Botones de administración de una fila
function botonesAdmin(p, baja) {
  const id = escapeHtml(p.id_productos);

  return (
    '<td class="acciones">' +
    '<button type="button" class="btn-tabla" data-accion="editar" data-id="' +
    id +
    '">Editar</button>' +
    (baja
      ? '<button type="button" class="btn-tabla" data-accion="reactivar" data-id="' +
        id +
        '">Reactivar</button>'
      : '<button type="button" class="btn-tabla btn-aviso" data-accion="baja" data-id="' +
        id +
        '">Dar de baja</button>') +
    '<button type="button" class="btn-tabla btn-peligro" data-accion="eliminar" data-id="' +
    id +
    '">Eliminar</button>' +
    "</td>"
  );
}

function renderizarTabla(productos) {
  if (productos.length === 0) {
    mostrarVacio();
    return;
  }

  cuerpoTabla.innerHTML = productos
    .map(function (p) {
      const cat = estado.porId.get(p.id_categorias);
      const existencia = Number(p.existencia) || 0;
      const baja = p.activo === false;
      const claseStock =
        existencia <= 0 ? "agotado" : existencia <= STOCK_BAJO ? "bajo" : "";
      const descripcion = p[COL_DESC]
        ? '<span class="prod-desc">' + escapeHtml(p[COL_DESC]) + "</span>"
        : "";

      return (
        '<tr class="fila-dato' +
        (baja ? " fila-baja" : "") +
        '">' +
        "<td>" +
        '<span class="prod-nombre">' +
        escapeHtml(p.nombre) +
        (baja ? '<span class="badge-baja">BAJA</span>' : "") +
        "</span>" +
        '<span class="prod-codigo">Cód. ' +
        escapeHtml(p.id_productos) +
        "</span>" +
        descripcion +
        "</td>" +
        "<td>" +
        (cat
          ? '<span class="badge-categoria">' +
            escapeHtml(cat.nombres) +
            "</span>" +
            '<span class="prod-codigo">' +
            escapeHtml(p.marca || cat.marca) +
            "</span>"
          : '<span class="prod-codigo">Sin categoría' +
            (p.marca ? " · " + escapeHtml(p.marca) : "") +
            "</span>") +
        "</td>" +
        '<td class="num">' +
        formatearBs(p.precio) +
        "</td>" +
        '<td class="num"><span class="stock ' +
        claseStock +
        '">' +
        existencia +
        "</span></td>" +
        (esAdmin ? botonesAdmin(p, baja) : "") +
        "</tr>"
      );
    })
    .join("");

  contadorProductos.textContent =
    productos.length + (productos.length === 1 ? " producto" : " productos");
}

// Aplica el buscador (código, nombre o marca) sobre la lista cargada
function productosFiltrados() {
  const texto = clave(estado.busqueda);

  if (!texto) return estado.lista;

  return estado.lista.filter(function (p) {
    return (
      String(p.id_productos).includes(texto) ||
      clave(p.nombre).includes(texto) ||
      clave(p.marca).includes(texto)
    );
  });
}

function pintarTabla() {
  renderizarTabla(productosFiltrados());
}

async function cargarProductos() {
  const idPeticion = ++estado.peticion;

  mostrarCargando();

  try {
    const productos = await obtenerProductos(estado.categoriaActiva);

    if (idPeticion !== estado.peticion) return; // llegó una petición más nueva

    estado.lista = productos;
    pintarTabla();
  } catch (error) {
    if (idPeticion !== estado.peticion) return;

    console.error("Error al leer productos:", error);
    mostrarError(error.message);
  } finally {
    if (idPeticion === estado.peticion) {
      cuerpoTabla.removeAttribute("aria-busy");
    }
  }
}

// =====================================================
// BUSCADOR
// =====================================================

if (buscarProducto) {
  buscarProducto.addEventListener("input", function () {
    estado.busqueda = buscarProducto.value;
    pintarTabla();
  });
}

// =====================================================
// FILTRO: dropdown y tarjetas
// =====================================================

function sincronizarTarjetas() {
  tarjetas.forEach(function (t) {
    const nombre = t.dataset.categoria || t.querySelector("h3").textContent;
    const activa =
      estado.categoriaActiva !== null &&
      clave(nombre) === clave(estado.categoriaActiva);

    t.classList.toggle("activa", activa);
    t.setAttribute("aria-pressed", String(activa));
  });
}

function aplicarFiltro(categoria, opciones) {
  const hacerScroll = opciones && opciones.scroll;

  // Usa el nombre tal como está en la base, si existe
  const grupo = categoria ? estado.grupos.get(clave(categoria)) : null;
  estado.categoriaActiva = categoria
    ? grupo
      ? grupo.nombre
      : categoria
    : null;

  filtroCategoria.value = estado.categoriaActiva || "";
  sincronizarTarjetas();
  cargarProductos();

  if (hacerScroll) {
    seccionProductos.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

filtroCategoria.addEventListener("change", function () {
  aplicarFiltro(filtroCategoria.value);
});

tarjetas.forEach(function (tarjeta) {
  // Accesibilidad: se comportan como botones
  tarjeta.setAttribute("role", "button");
  tarjeta.setAttribute("tabindex", "0");
  tarjeta.setAttribute("aria-pressed", "false");

  function activar() {
    const nombre =
      tarjeta.dataset.categoria ||
      tarjeta.querySelector("h3").textContent.trim();

    const yaActiva =
      estado.categoriaActiva !== null &&
      clave(estado.categoriaActiva) === clave(nombre);

    // Segundo clic sobre la misma tarjeta = quitar filtro
    aplicarFiltro(yaActiva ? null : nombre, { scroll: true });
  }

  tarjeta.addEventListener("click", activar);

  tarjeta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activar();
    }
  });
});

// =====================================================
// ADMINISTRAR: editar, dar de baja, reactivar, eliminar
// =====================================================

function buscarEnLista(id) {
  return estado.lista.find(function (p) {
    return String(p.id_productos) === String(id);
  });
}

// ---------- Editar ----------

function abrirEdicion(producto) {
  document.querySelector("#editar-codigo").value = producto.id_productos;
  document.querySelector("#editar-nombre").value = producto.nombre || "";
  document.querySelector("#editar-marca").value = producto.marca || "";
  document.querySelector("#editar-descripcion").value =
    producto[COL_DESC] || "";
  document.querySelector("#editar-precio").value = producto.precio;
  document.querySelector("#editar-existencia").value = producto.existencia;
  document.querySelector("#editar-categoria").value =
    producto.id_categorias || "";

  mostrarMensaje(mensajeEdicion, "");
  modalEditar.hidden = false;
  document.body.classList.add("modal-abierto");
  document.querySelector("#editar-nombre").focus();
}

function cerrarEdicion() {
  modalEditar.hidden = true;
  document.body.classList.remove("modal-abierto");
}

document
  .querySelector("#btn-cancelar-edicion")
  .addEventListener("click", cerrarEdicion);

// Clic fuera de la caja o tecla Esc cierran la ventana
modalEditar.addEventListener("click", function (e) {
  if (e.target === modalEditar) cerrarEdicion();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !modalEditar.hidden) cerrarEdicion();
});

formEditar.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!esAdmin) return;

  const id = Number(document.querySelector("#editar-codigo").value);
  const nombre = document.querySelector("#editar-nombre").value.trim();
  const marca = document.querySelector("#editar-marca").value.trim();
  const descripcion = document
    .querySelector("#editar-descripcion")
    .value.trim();
  const precio = Number(document.querySelector("#editar-precio").value);
  const existencia = Number(document.querySelector("#editar-existencia").value);
  const idCategoria = Number(document.querySelector("#editar-categoria").value);

  if (!nombre) {
    mostrarMensaje(mensajeEdicion, "Ingrese el nombre del producto.", "error");
    return;
  }

  if (!marca) {
    mostrarMensaje(mensajeEdicion, "Ingrese la marca del producto.", "error");
    return;
  }

  if (Number.isNaN(precio) || precio < 0) {
    mostrarMensaje(mensajeEdicion, "Ingrese un precio válido.", "error");
    return;
  }

  if (!Number.isInteger(existencia) || existencia < 0) {
    mostrarMensaje(
      mensajeEdicion,
      "La existencia debe ser un número entero.",
      "error",
    );
    return;
  }

  if (!idCategoria) {
    mostrarMensaje(mensajeEdicion, "Seleccione una categoría.", "error");
    return;
  }

  const cambios = {
    nombre: nombre,
    marca: marca,
    precio: precio,
    existencia: existencia,
    id_categorias: idCategoria,
  };
  cambios[COL_DESC] = descripcion || null;

  const boton = formEditar.querySelector('button[type="submit"]');
  boton.disabled = true;
  mostrarMensaje(mensajeEdicion, "Guardando cambios...");

  const resultado = await sup
    .from("productos")
    .update(cambios)
    .eq("id_productos", id)
    .select();

  boton.disabled = false;

  if (resultado.error) {
    console.error("Error al editar producto:", resultado.error);
    mostrarMensaje(
      mensajeEdicion,
      "No se pudo guardar: " + resultado.error.message,
      "error",
    );
    return;
  }

  // Sin filas devueltas = la base no permitió el cambio (permisos / RLS)
  if (!resultado.data || resultado.data.length === 0) {
    mostrarMensaje(
      mensajeEdicion,
      "No se guardó ningún cambio. Revise los permisos (RLS) de la tabla productos.",
      "error",
    );
    return;
  }

  cerrarEdicion();
  mostrarMensaje(
    mensajeAdmin,
    "Producto " + id + " actualizado correctamente.",
    "ok",
  );
  await cargarProductos();
});

// ---------- Dar de baja / reactivar ----------

async function cambiarEstado(producto, activo) {
  if (!estado.tieneActivo) {
    mostrarMensaje(
      mensajeAdmin,
      "Falta la columna 'activo' en la tabla productos. Ejecute el SQL de bajas en Supabase.",
      "error",
    );
    return;
  }

  const pregunta = activo
    ? '¿Reactivar "' +
      producto.nombre +
      '" (código ' +
      producto.id_productos +
      ")?"
    : '¿Dar de baja "' +
      producto.nombre +
      '" (código ' +
      producto.id_productos +
      ")?\n\nDejará de mostrarse y de venderse, pero se conserva su historial de ventas.";

  if (!window.confirm(pregunta)) return;

  const resultado = await sup
    .from("productos")
    .update({ activo: activo })
    .eq("id_productos", producto.id_productos)
    .select();

  if (resultado.error) {
    console.error("Error al cambiar el estado:", resultado.error);
    mostrarMensaje(
      mensajeAdmin,
      "No se pudo actualizar: " + resultado.error.message,
      "error",
    );
    return;
  }

  if (!resultado.data || resultado.data.length === 0) {
    mostrarMensaje(
      mensajeAdmin,
      "No se guardó ningún cambio. Revise los permisos (RLS) de la tabla productos.",
      "error",
    );
    return;
  }

  mostrarMensaje(
    mensajeAdmin,
    "Producto " +
      producto.id_productos +
      (activo ? " reactivado." : " dado de baja."),
    "ok",
  );
  await cargarProductos();
}

// ---------- Eliminar ----------

async function eliminarProducto(producto) {
  const pregunta =
    '¿ELIMINAR "' +
    producto.nombre +
    '" (código ' +
    producto.id_productos +
    ")?\n\nEsta acción no se puede deshacer.";

  if (!window.confirm(pregunta)) return;

  const resultado = await sup
    .from("productos")
    .delete()
    .eq("id_productos", producto.id_productos)
    .select();

  if (resultado.error) {
    console.error("Error al eliminar producto:", resultado.error);

    // 23503 = otra tabla (detalle_ventas) usa este producto
    const texto =
      resultado.error.code === "23503"
        ? "No se puede eliminar: el producto tiene ventas registradas. Use «Dar de baja»."
        : "No se pudo eliminar: " + resultado.error.message;

    mostrarMensaje(mensajeAdmin, texto, "error");
    return;
  }

  if (!resultado.data || resultado.data.length === 0) {
    mostrarMensaje(
      mensajeAdmin,
      "No se eliminó ningún producto. Revise los permisos (RLS) de la tabla productos.",
      "error",
    );
    return;
  }

  mostrarMensaje(
    mensajeAdmin,
    "Producto " + producto.id_productos + " eliminado.",
    "ok",
  );
  await cargarProductos();
}

// =====================================================
// CLICS DENTRO DE LA TABLA (un solo listener)
// =====================================================

cuerpoTabla.addEventListener("click", async function (e) {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;

  const accion = boton.dataset.accion;

  if (accion === "ver-todas") return aplicarFiltro(null);
  if (accion === "reintentar") return cargarProductos();

  // Acciones de administrador
  if (!esAdmin) return;

  const producto = buscarEnLista(boton.dataset.id);
  if (!producto) return;

  if (accion === "editar") abrirEdicion(producto);
  if (accion === "baja") await cambiarEstado(producto, false);
  if (accion === "reactivar") await cambiarEstado(producto, true);
  if (accion === "eliminar") await eliminarProducto(producto);
});

// =====================================================
// INGRESAR PRODUCTO
// =====================================================

document
  .querySelector("#form-producto")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const codigo = document.querySelector("#campo-codigo").value.trim();
    const cantidad = Number(
      document.querySelector("#campo-cantidad-producto").value,
    );
    const nombre = document
      .querySelector("#campo-nombre-producto")
      .value.trim();
    const marca = document
      .querySelector("#campo-marca-producto")
      .value.trim()
      .replace(/\s+/g, " ");
    const precio = Number(
      document.querySelector("#campo-precio-producto").value,
    );
    const idCategoria = Number(selectCategoria.value);

    // Validaciones
    if (!nombre) {
      mostrarMensaje(
        mensajeProducto,
        "Ingrese el nombre del producto.",
        "error",
      );
      return;
    }

    if (!marca) {
      mostrarMensaje(
        mensajeProducto,
        "Ingrese la marca del producto.",
        "error",
      );
      return;
    }

    if (!cantidad || cantidad < 1) {
      mostrarMensaje(
        mensajeProducto,
        "La cantidad debe ser mayor a 0.",
        "error",
      );
      return;
    }

    if (!precio || precio < 0) {
      mostrarMensaje(mensajeProducto, "Ingrese un precio válido.", "error");
      return;
    }

    if (!idCategoria) {
      mostrarMensaje(mensajeProducto, "Seleccione una categoría.", "error");
      return;
    }

    mostrarMensaje(mensajeProducto, "Guardando producto...");

    const productoNuevo = {
      nombre: nombre,
      precio: precio,
      existencia: cantidad,
      id_categorias: idCategoria,
      marca: marca,
    };

    // Código = id_productos (si se escribió uno numérico)
    if (codigo !== "") {
      const idCodigo = Number(codigo);

      if (!Number.isNaN(idCodigo)) {
        productoNuevo.id_productos = idCodigo;
      }
    }

    const resultado = await sup
      .from("productos")
      .insert(productoNuevo)
      .select()
      .single();

    if (resultado.error) {
      console.error("Error al ingresar producto:", resultado.error);

      const err = resultado.error;
      let texto = "No se pudo registrar el producto.";

      if (err.code === "42501") {
        // RLS: la base rechazó el ingreso
        texto = "Solo el administrador puede ingresar productos.";
      } else if (err.code === "23505") {
        // Clave duplicada
        texto = codigo
          ? "Ya existe un producto con el código " +
            codigo +
            ". Use otro código o déjelo vacío."
          : "La base asignó un código que ya existe. Avise al administrador (secuencia de id_productos desfasada).";
      } else if (
        err.code === "23502" &&
        String(err.message).includes("id_productos")
      ) {
        texto = "Ingrese un código: la tabla no lo genera automáticamente.";
      }

      mostrarMensaje(mensajeProducto, texto, "error");
      return;
    }

    mostrarMensaje(mensajeProducto, "Producto registrado correctamente.", "ok");

    document.querySelector("#form-producto").reset();

    // Si estabas filtrando otra categoría, pasa a la del producto nuevo
    // para que lo veas de inmediato; si veías "Todas", se mantiene.
    const catNueva = estado.porId.get(idCategoria);

    if (
      estado.categoriaActiva &&
      catNueva &&
      clave(catNueva.nombres) !== clave(estado.categoriaActiva)
    ) {
      aplicarFiltro(catNueva.nombres);
    } else {
      await cargarProductos();
    }
  });

// =====================================================
// INICIAR
// =====================================================

async function iniciar() {
  // Quién está conectado (Supabase Auth) y si es administrador
  usuarioSesion = await obtenerPerfilActual();
  esAdmin = esAdministrador(usuarioSesion);
  COLUMNAS = esAdmin ? 5 : 4;

  iniciarAdmin();

  // Primero las categorías: el filtro necesita los ids para consultar
  await cargarCategorias();

  // Si llegas desde index.html?categoria=Parlantes, se filtra y baja a la tabla
  const categoriaUrl = new URLSearchParams(window.location.search).get(
    "categoria",
  );

  if (categoriaUrl) {
    aplicarFiltro(categoriaUrl, { scroll: true });
  } else {
    await cargarProductos();
  }
}

iniciar();
