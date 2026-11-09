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

// =====================================================
// DESCUENTO AL CLIENTE (opcional)
// El navegador solo MUESTRA el descuento. Quien lo valida y calcula de
// verdad, con los precios de la base, es registrar_venta (sql/descuentos.sql).
// =====================================================

// subtotal en Bs, texto escrito (puede ser "" o "10,5"), tipo "monto" o "porcentaje"
// Devuelve { descuento (Bs), valor (número escrito), error ("" si está bien) }
function calcularDescuento(subtotal, texto, tipo) {
  const limpio = String(texto || "")
    .trim()
    .replace(",", ".");

  if (limpio === "") return { descuento: 0, valor: 0, error: "" };

  const valor = Number(limpio);

  if (!Number.isFinite(valor) || valor < 0) {
    return {
      descuento: 0,
      valor: 0,
      error: "Ingrese un descuento válido (número positivo).",
    };
  }

  const base = Math.round(subtotal * 100) / 100;
  let descuento;

  if (tipo === "porcentaje") {
    if (valor > 100) {
      return {
        descuento: 0,
        valor: valor,
        error: "El porcentaje no puede pasar de 100.",
      };
    }

    descuento = Math.round(base * valor) / 100; // = base × valor / 100, a centavos
  } else {
    descuento = Math.round(valor * 100) / 100;
  }

  if (descuento > base) {
    return {
      descuento: 0,
      valor: valor,
      error:
        "El descuento no puede ser mayor al subtotal (" +
        numeroBs(base) +
        " Bs).",
    };
  }

  return { descuento: descuento, valor: valor, error: "" };
}

// Parámetros extra para registrar_venta: solo si hay descuento
// (sin descuento se llama como siempre, así funciona aunque falte actualizar la base)
function parametrosDescuento(resultado, tipo) {
  return resultado.descuento > 0
    ? {
        p_descuento: resultado.valor,
        p_tipo_descuento: tipo === "porcentaje" ? "porcentaje" : "monto",
      }
    : {};
}

// Muestra subtotal, descuento y total final. `ids` = { valor, tipo, resumen, total }
// Devuelve el resultado de calcularDescuento (más `total` a cobrar).
function pintarTotalesConDescuento(subtotal, ids) {
  const r = calcularDescuento(subtotal, ids.valor.value, ids.tipo.value);
  const resumen = ids.resumen;

  resumen.classList.toggle("error", !!r.error);

  if (r.error) {
    resumen.textContent = r.error;
    r.total = subtotal;
  } else if (r.descuento > 0) {
    resumen.textContent =
      "Subtotal " +
      numeroBs(subtotal) +
      " Bs − Descuento " +
      numeroBs(r.descuento) +
      " Bs";
    r.total = Math.round((subtotal - r.descuento) * 100) / 100;
  } else {
    resumen.textContent = "";
    r.total = subtotal;
  }

  ids.total.textContent = numeroBs(r.total) + " Bs";

  return r;
}
