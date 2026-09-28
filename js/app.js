let productosCache = [];

function llenarSelectProductos(productos) {
  const select = document.querySelector("#campo-producto");

  select.innerHTML = productos
    .map(function (p) {
      return '<option value="' + p.id + '">' + p.nombre + "</option>";
    })
    .join("");
}

async function iniciar() {
  const cuerpoTabla = document.querySelector("#cuerpo-productos");

  cuerpoTabla.innerHTML = '<tr><td colspan="3">Cargando productos...</td></tr>';

  const resultado = await sup.from("productos").select();

  const data = resultado.data;
  const error = resultado.error;

  if (error) {
    console.error("Error al leer productos:", error);

    cuerpoTabla.innerHTML =
      '<tr><td colspan="3">No se pudo cargar el listado.</td></tr>';

    return;
  }

  if (data.length === 0) {
    cuerpoTabla.innerHTML =
      '<tr><td colspan="3">Todavia no hay productos registrados.</td></tr>';

    return;
  }

  productosCache = data;

  const filas = data
    .map(function (producto) {
      return (
        "<tr>" +
        "<td>" +
        producto.nombre +
        "</td>" +
        "<td>" +
        producto.precio +
        "</td>" +
        "<td>" +
        producto.existencia +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  cuerpoTabla.innerHTML = filas;

  llenarSelectProductos(data);
}

document
  .querySelector("#form-venta")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const idProducto = Number(document.querySelector("#campo-producto").value);

    const cantidad = Number(document.querySelector("#campo-cantidad").value);

    const producto = productosCache.find(function (p) {
      return p.id === idProducto;
    });

    if (!producto) {
      document.querySelector("#mensaje-venta").textContent =
        "No se encontro el producto.";

      return;
    }

    const resultadoVenta = await sup
      .from("ventas")
      .insert({
        id_usuario: 1,
        total: producto.precio * cantidad,
      })
      .select()
      .single();

    const venta = resultadoVenta.data;
    const errorVenta = resultadoVenta.error;

    if (errorVenta) {
      console.error(errorVenta);

      document.querySelector("#mensaje-venta").textContent =
        "Ocurrio un problema al registrar la venta.";

      return;
    }

    const resultadoDetalle = await sup.from("detalle_venta").insert({
      id_venta: venta.id,
      id_producto: idProducto,
      cantidad: cantidad,
      precio_unitario: producto.precio,
    });

    const errorDetalle = resultadoDetalle.error;

    if (errorDetalle) {
      console.error(errorDetalle);

      document.querySelector("#mensaje-venta").textContent =
        "Ocurrio un problema al guardar el detalle.";

      return;
    }

    document.querySelector("#mensaje-venta").textContent =
      "Venta registrada correctamente.";

    document.querySelector("#form-venta").reset();
  });

iniciar();
