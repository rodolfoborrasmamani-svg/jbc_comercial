// /* =====================================================
//    JBC COMERCIAL
//    SISTEMA DE VENTAS
//    (incluye filtro de productos por categoría)
//    Requiere `sup` de js/supabase-client.js
// ===================================================== */

// // =====================================================
// // VARIABLES
// // =====================================================

// // Todos los productos (sin filtrar): los usa el formulario de ventas
// let productosCache = [];

// let usuarioActual = null;

// // Estado del catálogo
// const estado = {
//   categoriaActiva: null, // nombre de categoría (ej. "Micrófonos") o null = todas
//   categorias: [], // filas de la tabla `categorias`
//   grupos: new Map(), // clave normalizada -> { nombre, ids: [] }
//   porId: new Map(), // id_categorias -> fila de categorias
//   peticion: 0, // descarta respuestas viejas si se cambia rápido de filtro
// };

// const STOCK_BAJO = 5;

// // =====================================================
// // ELEMENTOS DEL HTML
// // =====================================================

// const cuerpoTabla = document.querySelector("#cuerpo-productos");
// const selectProducto = document.querySelector("#campo-producto");
// const selectCategoria = document.querySelector("#campo-categoria");
// const mensajeProducto = document.querySelector("#mensaje-producto");
// const mensajeVenta = document.querySelector("#mensaje-venta");
// const listaVenta = document.querySelector("#lista-venta");
// const totalVenta = document.querySelector("#total-venta");

// // Catálogo (filtro)
// const filtroCategoria = document.querySelector("#filtro-categoria");
// const contadorProductos = document.querySelector("#contador-productos");
// const seccionProductos = document.querySelector("#productos");
// const tarjetas = document.querySelectorAll(".categoria");

// // Login
// const formLogin = document.querySelector("#form-login");
// const campoUsuario = document.querySelector("#campo-usuario");
// const campoPassword = document.querySelector("#campo-password");
// const mensajeLogin = document.querySelector("#mensaje-login");
// const usuarioActualDiv = document.querySelector("#usuario-actual");
// const nombreUsuarioActual = document.querySelector("#nombre-usuario-actual");
// const btnCerrarSesion = document.querySelector("#btn-cerrar-sesion");
// const vendedorVenta = document.querySelector("#vendedor-venta");

// // =====================================================
// // UTILIDADES
// // =====================================================

// // Evita inyección de HTML al pintar datos de la base
// function escapeHtml(valor) {
//   return String(valor ?? "").replace(/[&<>"']/g, function (c) {
//     return {
//       "&": "&amp;",
//       "<": "&lt;",
//       ">": "&gt;",
//       '"': "&quot;",
//       "'": "&#39;",
//     }[c];
//   });
// }

// // "Micrófonos" y "microfonos" -> "microfonos"
// function clave(texto) {
//   return String(texto ?? "")
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .toLowerCase()
//     .trim();
// }

// // 1250 -> "Bs 1.250,00"
// function formatearBs(valor) {
//   return (
//     "Bs " +
//     (Number(valor) || 0).toLocaleString("es-BO", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })
//   );
// }

// // =====================================================
// // CATEGORÍAS (tabla `categorias`)
// // =====================================================

// async function cargarCategorias() {
//   const resultado = await sup
//     .from("categorias")
//     .select("*")
//     .order("id_categorias", { ascending: true });

//   if (resultado.error) {
//     console.error("Error al cargar categorías:", resultado.error);
//     return;
//   }

//   estado.categorias = resultado.data || [];
//   estado.grupos = new Map();
//   estado.porId = new Map();

//   // Agrupa por nombre: "Micrófonos" puede tener varias marcas/ids
//   estado.categorias.forEach(function (cat) {
//     estado.porId.set(cat.id_categorias, cat);

//     const k = clave(cat.nombres);
//     if (!estado.grupos.has(k)) {
//       estado.grupos.set(k, { nombre: cat.nombres, ids: [] });
//     }
//     estado.grupos.get(k).ids.push(cat.id_categorias);
//   });

//   poblarSelects();
// }

// function poblarSelects() {
//   // Select del formulario de productos (guarda id_categorias)
//   selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';

//   estado.categorias.forEach(function (cat) {
//     const option = document.createElement("option");
//     option.value = cat.id_categorias;
//     option.textContent = cat.nombres + " - " + cat.marca;
//     selectCategoria.appendChild(option);
//   });

//   // Filtro de la tabla (un item por nombre de categoría)
//   filtroCategoria.innerHTML =
//     '<option value="">Todas las categorías</option>' +
//     Array.from(estado.grupos.values())
//       .map(function (g) {
//         return (
//           '<option value="' +
//           escapeHtml(g.nombre) +
//           '">' +
//           escapeHtml(g.nombre) +
//           "</option>"
//         );
//       })
//       .join("");

//   filtroCategoria.value = estado.categoriaActiva || "";
// }

// // =====================================================
// // OBTENER PRODUCTOS (con filtro opcional)
// // =====================================================

// async function obtenerProductos(categoria = null) {
//   let consulta = sup.from("productos").select("*");

//   if (categoria) {
//     const grupo = estado.grupos.get(clave(categoria));

//     // Categoría sin filas en la tabla `categorias`: no hay nada que buscar
//     if (!grupo) return [];

//     // Equivale a .eq() pero admite varios ids con el mismo nombre
//     consulta =
//       grupo.ids.length === 1
//         ? consulta.eq("id_categorias", grupo.ids[0])
//         : consulta.in("id_categorias", grupo.ids);
//   }

//   const resultado = await consulta.order("id_productos", { ascending: true });

//   if (resultado.error) throw resultado.error;

//   return resultado.data || [];
// }

// // =====================================================
// // RENDER DE LA TABLA
// // =====================================================

// function mostrarCargando() {
//   const fila =
//     '<tr class="estado-fila" aria-hidden="true">' +
//     '<td><span class="skeleton"></span><span class="skeleton corto" style="margin-top:8px"></span></td>' +
//     '<td><span class="skeleton corto"></span></td>' +
//     '<td><span class="skeleton derecha"></span></td>' +
//     '<td><span class="skeleton derecha"></span></td>' +
//     "</tr>";

//   cuerpoTabla.innerHTML = fila.repeat(5);
//   cuerpoTabla.setAttribute("aria-busy", "true");
//   contadorProductos.textContent = "Cargando…";
// }

// function mostrarVacio() {
//   const cat = estado.categoriaActiva;

//   cuerpoTabla.innerHTML =
//     '<tr class="estado-fila"><td colspan="4"><div class="estado-vacio">' +
//     '<div class="icono">🎧</div>' +
//     "<h4>" +
//     (cat
//       ? "No hay productos en “" + escapeHtml(cat) + "”"
//       : "Todavía no hay productos registrados") +
//     "</h4>" +
//     "<p>" +
//     (cat
//       ? "Prueba con otra categoría o registra un producto nuevo."
//       : "Registra tu primer producto con el formulario.") +
//     "</p>" +
//     (cat
//       ? '<button type="button" data-accion="ver-todas">Ver todas las categorías</button>'
//       : "") +
//     "</div></td></tr>";

//   contadorProductos.textContent = "0 productos";
// }

// function mostrarError(mensaje) {
//   cuerpoTabla.innerHTML =
//     '<tr class="estado-fila"><td colspan="4"><div class="estado-vacio">' +
//     '<div class="icono">⚠️</div>' +
//     "<h4>No se pudo cargar el listado</h4>" +
//     "<p>" +
//     escapeHtml(mensaje || "Revisa tu conexión e inténtalo de nuevo.") +
//     "</p>" +
//     '<button type="button" data-accion="reintentar">Reintentar</button>' +
//     "</div></td></tr>";

//   contadorProductos.textContent = "";
// }

// function renderizarTabla(productos) {
//   if (productos.length === 0) {
//     mostrarVacio();
//     return;
//   }

//   cuerpoTabla.innerHTML = productos
//     .map(function (p) {
//       const cat = estado.porId.get(p.id_categorias);
//       const existencia = Number(p.existencia) || 0;
//       const claseStock =
//         existencia <= 0 ? "agotado" : existencia <= STOCK_BAJO ? "bajo" : "";

//       return (
//         '<tr class="fila-dato">' +
//         "<td>" +
//         '<span class="prod-nombre">' +
//         escapeHtml(p.nombre) +
//         "</span>" +
//         '<span class="prod-codigo">Cód. ' +
//         escapeHtml(p.id_productos) +
//         "</span>" +
//         "</td>" +
//         "<td>" +
//         (cat
//           ? '<span class="badge-categoria">' +
//             escapeHtml(cat.nombres) +
//             "</span>" +
//             '<span class="prod-codigo">' +
//             escapeHtml(cat.marca) +
//             "</span>"
//           : '<span class="prod-codigo">Sin categoría</span>') +
//         "</td>" +
//         '<td class="num">' +
//         formatearBs(p.precio) +
//         "</td>" +
//         '<td class="num"><span class="stock ' +
//         claseStock +
//         '">' +
//         existencia +
//         "</span></td>" +
//         "</tr>"
//       );
//     })
//     .join("");

//   contadorProductos.textContent =
//     productos.length + (productos.length === 1 ? " producto" : " productos");
// }

// // =====================================================
// // CARGAR PRODUCTOS (tabla filtrada + cache completo)
// // =====================================================

// async function cargarProductos() {
//   const idPeticion = ++estado.peticion;
//   const filtro = estado.categoriaActiva;

//   mostrarCargando();

//   try {
//     // La tabla muestra el filtro; el cache siempre tiene todos
//     // (el formulario de ventas necesita ver todos los productos)
//     const resultados = await Promise.all([
//       obtenerProductos(filtro),
//       filtro ? obtenerProductos() : null,
//     ]);

//     if (idPeticion !== estado.peticion) return; // llegó una petición más nueva

//     const visibles = resultados[0];
//     productosCache = resultados[1] || visibles;

//     renderizarTabla(visibles);
//     llenarSelectProductos(productosCache);
//   } catch (error) {
//     if (idPeticion !== estado.peticion) return;

//     console.error("Error al leer productos:", error);
//     mostrarError(error.message);
//   } finally {
//     if (idPeticion === estado.peticion) {
//       cuerpoTabla.removeAttribute("aria-busy");
//     }
//   }
// }

// // =====================================================
// // SELECT DE PRODUCTOS (ventas)
// // =====================================================

// function llenarSelectProductos(productos) {
//   selectProducto.innerHTML = '<option value="">Seleccionar producto</option>';

//   productos.forEach(function (producto) {
//     const option = document.createElement("option");

//     option.value = producto.id_productos;

//     option.textContent =
//       producto.nombre + " - " + Number(producto.precio).toFixed(2) + " Bs";

//     selectProducto.appendChild(option);
//   });
// }

// // =====================================================
// // FILTRO: dropdown y tarjetas
// // =====================================================

// function sincronizarTarjetas() {
//   tarjetas.forEach(function (t) {
//     const nombre = t.dataset.categoria || t.querySelector("h3").textContent;
//     const activa =
//       estado.categoriaActiva !== null &&
//       clave(nombre) === clave(estado.categoriaActiva);

//     t.classList.toggle("activa", activa);
//     t.setAttribute("aria-pressed", String(activa));
//   });
// }

// function aplicarFiltro(categoria, opciones) {
//   const hacerScroll = opciones && opciones.scroll;

//   // Usa el nombre tal como está en la base, si existe
//   const grupo = categoria ? estado.grupos.get(clave(categoria)) : null;
//   estado.categoriaActiva = categoria
//     ? grupo
//       ? grupo.nombre
//       : categoria
//     : null;

//   filtroCategoria.value = estado.categoriaActiva || "";
//   sincronizarTarjetas();
//   cargarProductos();

//   if (hacerScroll) {
//     seccionProductos.scrollIntoView({ behavior: "smooth", block: "start" });
//   }
// }

// filtroCategoria.addEventListener("change", function () {
//   aplicarFiltro(filtroCategoria.value);
// });

// tarjetas.forEach(function (tarjeta) {
//   // Accesibilidad: se comportan como botones
//   tarjeta.setAttribute("role", "button");
//   tarjeta.setAttribute("tabindex", "0");
//   tarjeta.setAttribute("aria-pressed", "false");

//   function activar() {
//     const nombre =
//       tarjeta.dataset.categoria ||
//       tarjeta.querySelector("h3").textContent.trim();

//     const yaActiva =
//       estado.categoriaActiva !== null &&
//       clave(estado.categoriaActiva) === clave(nombre);

//     // Segundo clic sobre la misma tarjeta = quitar filtro
//     aplicarFiltro(yaActiva ? null : nombre, { scroll: true });
//   }

//   tarjeta.addEventListener("click", activar);

//   tarjeta.addEventListener("keydown", function (e) {
//     if (e.key === "Enter" || e.key === " ") {
//       e.preventDefault();
//       activar();
//     }
//   });
// });

// // Botones dentro de los estados vacío / error
// cuerpoTabla.addEventListener("click", function (e) {
//   const boton = e.target.closest("[data-accion]");
//   if (!boton) return;

//   if (boton.dataset.accion === "ver-todas") aplicarFiltro(null);
//   if (boton.dataset.accion === "reintentar") cargarProductos();
// });

// // =====================================================
// // LOGIN DE USUARIO
// // =====================================================

// if (formLogin) {
//   formLogin.addEventListener("submit", async function (event) {
//     event.preventDefault();

//     const nombre = campoUsuario.value.trim();
//     const password = campoPassword.value;

//     if (!nombre) {
//       mensajeLogin.textContent = "Ingrese su usuario.";
//       return;
//     }

//     if (!password) {
//       mensajeLogin.textContent = "Ingrese su contraseña.";
//       return;
//     }

//     mensajeLogin.textContent = "Verificando usuario...";

//     const resultado = await sup
//       .from("usuarios")
//       .select("id_usuarios, nombres, id_roles, password")
//       .eq("nombres", nombre)
//       .eq("password", password)
//       .maybeSingle();

//     const usuario = resultado.data;
//     const error = resultado.error;

//     if (error) {
//       console.error("Error al iniciar sesión:", error);
//       mensajeLogin.textContent = "No se pudo verificar el usuario.";
//       return;
//     }

//     if (!usuario) {
//       mensajeLogin.textContent = "Usuario o contraseña incorrectos.";
//       return;
//     }

//     usuarioActual = {
//       id_usuarios: usuario.id_usuarios,
//       nombres: usuario.nombres,
//       id_roles: usuario.id_roles,
//     };

//     nombreUsuarioActual.textContent =
//       usuarioActual.nombres + " (ID: " + usuarioActual.id_usuarios + ")";

//     // Muestra el vendedor en el formulario de ventas
//     if (vendedorVenta) vendedorVenta.textContent = usuarioActual.nombres;

//     usuarioActualDiv.style.display = "flex";

//     mensajeLogin.textContent = "Sesión iniciada correctamente.";

//     campoPassword.value = "";

//     console.log("Usuario conectado:", usuarioActual);
//   });
// }

// // =====================================================
// // CERRAR SESIÓN
// // =====================================================

// if (btnCerrarSesion) {
//   btnCerrarSesion.addEventListener("click", function () {
//     usuarioActual = null;

//     usuarioActualDiv.style.display = "none";

//     if (vendedorVenta) vendedorVenta.textContent = "Inicie sesión para vender";

//     campoUsuario.value = "";
//     campoPassword.value = "";

//     mensajeLogin.textContent = "Sesión cerrada.";
//   });
// }

// // =====================================================
// // INGRESAR PRODUCTO
// // =====================================================

// document
//   .querySelector("#form-producto")
//   .addEventListener("submit", async function (event) {
//     event.preventDefault();

//     const codigo = document.querySelector("#campo-codigo").value.trim();
//     const cantidad = Number(
//       document.querySelector("#campo-cantidad-producto").value,
//     );
//     const nombre = document
//       .querySelector("#campo-nombre-producto")
//       .value.trim();
//     const precio = Number(
//       document.querySelector("#campo-precio-producto").value,
//     );
//     const idCategoria = Number(
//       document.querySelector("#campo-categoria").value,
//     );

//     // Validaciones
//     if (!nombre) {
//       mensajeProducto.textContent = "Ingrese el nombre del producto.";
//       return;
//     }

//     if (!cantidad || cantidad < 1) {
//       mensajeProducto.textContent = "La cantidad debe ser mayor a 0.";
//       return;
//     }

//     if (!precio || precio < 0) {
//       mensajeProducto.textContent = "Ingrese un precio válido.";
//       return;
//     }

//     if (!idCategoria) {
//       mensajeProducto.textContent = "Seleccione una categoría.";
//       return;
//     }

//     mensajeProducto.textContent = "Guardando producto...";

//     const productoNuevo = {
//       nombre: nombre,
//       precio: precio,
//       existencia: cantidad,
//       id_categorias: idCategoria,
//     };

//     // Código = id_productos (si se escribió uno numérico)
//     if (codigo !== "") {
//       const idCodigo = Number(codigo);

//       if (!Number.isNaN(idCodigo)) {
//         productoNuevo.id_productos = idCodigo;
//       }
//     }

//     const resultado = await sup
//       .from("productos")
//       .insert(productoNuevo)
//       .select()
//       .single();

//     const productoGuardado = resultado.data;
//     const error = resultado.error;

//     if (error) {
//       console.error("Error al ingresar producto:", error);
//       mensajeProducto.textContent = "No se pudo registrar el producto.";
//       return;
//     }

//     mensajeProducto.textContent = "Producto registrado correctamente.";

//     console.log("Producto guardado:", productoGuardado);

//     document.querySelector("#form-producto").reset();

//     // Si estabas filtrando otra categoría, pasa a la del producto nuevo
//     // para que lo veas de inmediato; si veías "Todas", se mantiene.
//     const catNueva = estado.porId.get(idCategoria);

//     if (
//       estado.categoriaActiva &&
//       catNueva &&
//       clave(catNueva.nombres) !== clave(estado.categoriaActiva)
//     ) {
//       aplicarFiltro(catNueva.nombres);
//     } else {
//       await cargarProductos();
//     }
//   });

// // =====================================================
// // CAMBIAR PRODUCTO (ventas)
// // =====================================================

// selectProducto.addEventListener("change", function () {
//   const idProducto = Number(this.value);

//   const producto = productosCache.find(function (p) {
//     return p.id_productos === idProducto;
//   });

//   if (!producto) {
//     listaVenta.innerHTML = "";
//     totalVenta.textContent = "0,00 Bs";
//     return;
//   }

//   mostrarProductoVenta(producto);
// });

// // =====================================================
// // MOSTRAR PRODUCTO EN VENTA
// // =====================================================

// function mostrarProductoVenta(producto) {
//   const cantidad = Number(document.querySelector("#campo-cantidad").value) || 1;

//   const total = Number(producto.precio) * cantidad;

//   listaVenta.innerHTML =
//     '<div class="producto-venta">' +
//     "<span>" +
//     cantidad +
//     " " +
//     escapeHtml(producto.nombre) +
//     "</span>" +
//     '<span class="precio">' +
//     "X" +
//     cantidad +
//     " - " +
//     total.toFixed(2) +
//     " Bs" +
//     "</span>" +
//     "</div>";

//   totalVenta.textContent = total.toFixed(2) + " Bs";
// }

// // =====================================================
// // CAMBIAR CANTIDAD (ventas)
// // =====================================================

// document
//   .querySelector("#campo-cantidad")
//   .addEventListener("input", function () {
//     const idProducto = Number(selectProducto.value);

//     const producto = productosCache.find(function (p) {
//       return p.id_productos === idProducto;
//     });

//     if (producto) {
//       mostrarProductoVenta(producto);
//     }
//   });

// // =====================================================
// // REGISTRAR VENTA
// // =====================================================

// document
//   .querySelector("#form-venta")
//   .addEventListener("submit", async function (event) {
//     event.preventDefault();

//     if (!usuarioActual) {
//       mensajeVenta.textContent =
//         "Debe iniciar sesión antes de registrar una venta.";
//       return;
//     }

//     const idUsuario = usuarioActual.id_usuarios;

//     console.log("ID del usuario que vende:", idUsuario);

//     const idProducto = Number(selectProducto.value);
//     const cantidad = Number(document.querySelector("#campo-cantidad").value);

//     const producto = productosCache.find(function (p) {
//       return p.id_productos === idProducto;
//     });

//     if (!producto) {
//       mensajeVenta.textContent = "Seleccione un producto.";
//       return;
//     }

//     if (!cantidad || cantidad < 1) {
//       mensajeVenta.textContent = "Ingrese una cantidad válida.";
//       return;
//     }

//     if (cantidad > producto.existencia) {
//       mensajeVenta.textContent =
//         "No hay suficiente existencia. Disponible: " + producto.existencia;
//       return;
//     }

//     const total = Number(producto.precio) * cantidad;

//     mensajeVenta.textContent = "Registrando venta...";

//     // Crear venta
//     const resultadoVenta = await sup
//       .from("ventas")
//       .insert({
//         id_usuario: idUsuario,
//         total: total,
//       })
//       .select()
//       .single();

//     const venta = resultadoVenta.data;
//     const errorVenta = resultadoVenta.error;

//     if (errorVenta) {
//       console.error("Error al registrar venta:", errorVenta);
//       mensajeVenta.textContent = "Ocurrió un problema al registrar la venta.";
//       return;
//     }

//     console.log("Venta creada:", venta);

//     // Crear detalle de venta
//     const resultadoDetalle = await sup.from("detalle_ventas").insert({
//       id_venta: venta.id,
//       id_producto: idProducto,
//       cantidad: cantidad,
//       precio_unitario: producto.precio,
//     });

//     const errorDetalle = resultadoDetalle.error;

//     if (errorDetalle) {
//       console.error("Error al guardar detalle:", errorDetalle);
//       mensajeVenta.textContent = "Ocurrió un problema al guardar el detalle.";
//       return;
//     }

//     // Actualizar existencia
//     const nuevaExistencia = producto.existencia - cantidad;

//     const resultadoStock = await sup
//       .from("productos")
//       .update({
//         existencia: nuevaExistencia,
//       })
//       .eq("id_productos", idProducto);

//     const errorStock = resultadoStock.error;

//     if (errorStock) {
//       console.error("Error al actualizar existencia:", errorStock);
//     }

//     mensajeVenta.textContent =
//       "Venta registrada correctamente. " +
//       "Vendedor: " +
//       usuarioActual.nombres +
//       " | Total: " +
//       total.toFixed(2) +
//       " Bs";

//     document.querySelector("#form-venta").reset();

//     listaVenta.innerHTML = "";
//     totalVenta.textContent = "0,00 Bs";

//     // Actualiza tabla (respetando el filtro activo) y cache
//     await cargarProductos();
//   });

// // =====================================================
// // BOTÓN CANCELAR
// // =====================================================

// document.querySelector("#btn-cancelar").addEventListener("click", function () {
//   document.querySelector("#form-venta").reset();

//   listaVenta.innerHTML = "";
//   totalVenta.textContent = "0,00 Bs";
//   mensajeVenta.textContent = "";
// });

// // =====================================================
// // INICIAR SISTEMA
// // =====================================================

// async function iniciar() {
//   // Primero las categorías: el filtro necesita los ids para consultar
//   await cargarCategorias();

//   await cargarProductos();
// }

// iniciar();
