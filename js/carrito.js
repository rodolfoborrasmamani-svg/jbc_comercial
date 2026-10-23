/* =====================================================
   JBC COMERCIAL — CARRITO COMPARTIDO
   El carrito se guarda en el navegador (localStorage) para que lo
   puedan usar Productos y Ventas. Cada elemento:
     { id, nombre, precio, cantidad, categoria, existencia }
   Los precios guardados son solo para mostrar: al confirmar, la función
   registrar_venta de Supabase toma los precios REALES de la base.
   Se carga antes de ventas.js / carrito-productos.js.
===================================================== */

const CLAVE_CARRITO = "jbc_carrito";

function leerCarrito() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || "[]");

    if (!Array.isArray(lista)) return [];

    // Descarta elementos dañados
    return lista
      .filter(function (i) {
        return (
          i &&
          i.id !== undefined &&
          Number.isInteger(Number(i.cantidad)) &&
          Number(i.cantidad) >= 1 &&
          Number.isFinite(Number(i.precio))
        );
      })
      .map(function (i) {
        return {
          id: i.id,
          nombre: String(i.nombre || ""),
          precio: Number(i.precio),
          cantidad: Number(i.cantidad),
          categoria: i.categoria,
          existencia: Number.isFinite(Number(i.existencia))
            ? Number(i.existencia)
            : null,
        };
      });
  } catch (e) {
    return []; // almacenamiento no disponible o contenido inválido
  }
}

function guardarCarrito(lista) {
  try {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(lista));
  } catch (e) {
    /* sin almacenamiento: el carrito vive solo en esta página */
  }
}

function vaciarCarritoGuardado() {
  guardarCarrito([]);
}

// Llena un <select> con los clientes (la clave primaria se detecta sola)
async function llenarSelectClientes(select) {
  const r = await sup
    .from("clientes")
    .select("*")
    .order("nombres", { ascending: true });

  if (r.error) {
    console.error("Error al leer clientes:", r.error);
    select.innerHTML =
      '<option value="">No se pudieron cargar los clientes</option>';
    return;
  }

  const filas = r.data || [];

  if (filas.length === 0) {
    select.innerHTML = '<option value="">No hay clientes registrados</option>';
    return;
  }

  const pk = ["id_cliente", "id_clientes", "id"].find(function (c) {
    return c in filas[0];
  });

  if (!pk) {
    select.innerHTML =
      '<option value="">No se encontró la clave de clientes</option>';
    return;
  }

  const previo = select.value;

  select.innerHTML = '<option value="">Seleccionar cliente</option>';

  filas.forEach(function (c) {
    const op = document.createElement("option");
    op.value = c[pk];
    op.textContent = c.nombres + (c.carnet ? " — CI " + c.carnet : "");
    select.appendChild(op);
  });

  if (previo) select.value = previo;
}
